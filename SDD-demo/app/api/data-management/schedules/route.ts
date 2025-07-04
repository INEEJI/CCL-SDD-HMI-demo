import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireOperator } from '@/lib/auth-middleware';

// GET /api/data-management/schedules - 스케줄 목록 조회 (데이터 관리용)
export async function GET(request: NextRequest) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const customerId = searchParams.get('customer_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const searchTerm = searchParams.get('search');
    const includeStats = searchParams.get('include_stats') === 'true';

    let query = `
      SELECT 
        s.*,
        c.name as customer_name,
        c.code as customer_code,
        b.material_type,
        b.thickness,
        b.width,
        b.length,
        ${includeStats ? `
        (SELECT COUNT(*) FROM image_files img WHERE img.schedule_id = s.id) as image_count,
        (SELECT COUNT(*) FROM defect_detections dd WHERE dd.schedule_id = s.id) as defect_count,
        (SELECT AVG(dd.confidence_score) FROM defect_detections dd WHERE dd.schedule_id = s.id) as avg_confidence
        ` : '0 as image_count, 0 as defect_count, 0 as avg_confidence'}
      FROM schedules s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN boms b ON s.bom_id = b.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (customerId) {
      query += ` AND s.customer_id = $${paramIndex}`;
      params.push(parseInt(customerId));
      paramIndex++;
    }

    if (dateFrom) {
      query += ` AND s.start_time >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND s.start_time <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    if (searchTerm) {
      query += ` AND (s.coil_id ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR b.material_type ILIKE $${paramIndex})`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    query += ` ORDER BY s.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    // 전체 개수 조회
    let countQuery = `
      SELECT COUNT(*) 
      FROM schedules s
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN boms b ON s.bom_id = b.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (status) {
      countQuery += ` AND s.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (customerId) {
      countQuery += ` AND s.customer_id = $${countParamIndex}`;
      countParams.push(parseInt(customerId));
      countParamIndex++;
    }

    if (dateFrom) {
      countQuery += ` AND s.start_time >= $${countParamIndex}`;
      countParams.push(dateFrom);
      countParamIndex++;
    }

    if (dateTo) {
      countQuery += ` AND s.start_time <= $${countParamIndex}`;
      countParams.push(dateTo);
      countParamIndex++;
    }

    if (searchTerm) {
      countQuery += ` AND (s.coil_id ILIKE $${countParamIndex} OR c.name ILIKE $${countParamIndex} OR b.material_type ILIKE $${countParamIndex})`;
      countParams.push(`%${searchTerm}%`);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('스케줄 목록 조회 중 오류:', error);
    return NextResponse.json(
      { error: '스케줄 목록 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/data-management/schedules - 스케줄 일괄 작업
export async function POST(request: NextRequest) {
  // 인증 확인 (검사원 이상 권한 필요)
  const authResult = await requireOperator(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { action, schedule_ids, parameters } = body;

    // 필수 필드 검증
    if (!action || !schedule_ids || !Array.isArray(schedule_ids) || schedule_ids.length === 0) {
      return NextResponse.json(
        { error: '작업 유형과 스케줄 ID 목록은 필수입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 작업 유형 검증
    const allowedActions = ['update_status', 'update_progress', 'archive', 'delete', 'export_data'];
    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: '지원되지 않는 작업 유형입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 스케줄 정보 조회
    const scheduleQuery = `
      SELECT s.*, c.name as customer_name
      FROM schedules s
      LEFT JOIN customers c ON s.customer_id = c.id
      WHERE s.id = ANY($1::int[])
    `;
    const scheduleResult = await pool.query(scheduleQuery, [schedule_ids]);

    if (scheduleResult.rows.length === 0) {
      return NextResponse.json(
        { error: '선택된 스케줄을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    let results: any[] = [];

    // 작업 유형별 처리
    switch (action) {
      case 'update_status':
        if (!parameters?.new_status) {
          return NextResponse.json(
            { error: '새로운 상태는 필수입니다.', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }
        results = await updateScheduleStatus(scheduleResult.rows, parameters.new_status);
        break;

      case 'update_progress':
        if (parameters?.progress_percentage === undefined) {
          return NextResponse.json(
            { error: '진행률은 필수입니다.', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }
        results = await updateScheduleProgress(scheduleResult.rows, parameters.progress_percentage);
        break;

      case 'archive':
        results = await archiveSchedules(scheduleResult.rows);
        break;

      case 'delete':
        results = await deleteSchedules(scheduleResult.rows);
        break;

      case 'export_data':
        results = await exportScheduleData(scheduleResult.rows, parameters);
        break;
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `작업 완료: 성공 ${successCount}개, 실패 ${errorCount}개`,
      data: {
        total: results.length,
        success: successCount,
        errors: errorCount,
        results: results
      }
    });

  } catch (error) {
    console.error('스케줄 일괄 작업 중 오류:', error);
    return NextResponse.json(
      { error: '스케줄 일괄 작업 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// 스케줄 상태 업데이트 함수
async function updateScheduleStatus(schedules: any[], newStatus: string): Promise<any[]> {
  const results = [];
  
  // 상태 유효성 검증
  const validStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
  if (!validStatuses.includes(newStatus)) {
    return schedules.map(schedule => ({
      success: false,
      schedule_id: schedule.id,
      error: '유효하지 않은 상태입니다.'
    }));
  }

  for (const schedule of schedules) {
    try {
      // 상태 변경 가능 여부 검증
      if (schedule.status === 'completed' && newStatus !== 'completed') {
        results.push({
          success: false,
          schedule_id: schedule.id,
          error: '완료된 스케줄은 다른 상태로 변경할 수 없습니다.'
        });
        continue;
      }

      let updateQuery = 'UPDATE schedules SET status = $1';
      const queryParams = [newStatus, schedule.id];
      
      if (newStatus === 'completed') {
        updateQuery += ', end_time = CURRENT_TIMESTAMP, progress_percentage = 100';
      } else if (newStatus === 'in_progress' && !schedule.start_time) {
        updateQuery += ', start_time = CURRENT_TIMESTAMP';
      }
      
      updateQuery += ' WHERE id = $2 RETURNING *';

      await pool.query(updateQuery, queryParams);

      results.push({
        success: true,
        schedule_id: schedule.id,
        old_status: schedule.status,
        new_status: newStatus
      });
    } catch (error) {
      results.push({
        success: false,
        schedule_id: schedule.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 스케줄 진행률 업데이트 함수
async function updateScheduleProgress(schedules: any[], progressPercentage: number): Promise<any[]> {
  const results = [];
  
  // 진행률 유효성 검증
  if (progressPercentage < 0 || progressPercentage > 100) {
    return schedules.map(schedule => ({
      success: false,
      schedule_id: schedule.id,
      error: '진행률은 0~100 사이의 값이어야 합니다.'
    }));
  }

  for (const schedule of schedules) {
    try {
      let updateQuery = 'UPDATE schedules SET progress_percentage = $1';
      const queryParams = [progressPercentage, schedule.id];
      
      if (progressPercentage === 100) {
        updateQuery += ', status = \'completed\', end_time = CURRENT_TIMESTAMP';
      } else if (progressPercentage > 0 && schedule.status === 'scheduled') {
        updateQuery += ', status = \'in_progress\', start_time = CURRENT_TIMESTAMP';
      }
      
      updateQuery += ' WHERE id = $2 RETURNING *';

      await pool.query(updateQuery, queryParams);

      results.push({
        success: true,
        schedule_id: schedule.id,
        old_progress: schedule.progress_percentage,
        new_progress: progressPercentage
      });
    } catch (error) {
      results.push({
        success: false,
        schedule_id: schedule.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 스케줄 아카이브 함수
async function archiveSchedules(schedules: any[]): Promise<any[]> {
  const results = [];
  
  for (const schedule of schedules) {
    try {
      // 완료되지 않은 스케줄은 아카이브 불가
      if (schedule.status !== 'completed' && schedule.status !== 'cancelled') {
        results.push({
          success: false,
          schedule_id: schedule.id,
          error: '완료되거나 취소된 스케줄만 아카이브할 수 있습니다.'
        });
        continue;
      }

      // 실제 구현에서는 별도의 아카이브 테이블로 이동하거나 플래그 설정
      // 여기서는 시스템 설정에 아카이브 목록 저장
      const archiveQuery = `
        INSERT INTO system_settings (setting_key, setting_value, setting_type, description)
        VALUES ($1, $2, 'json', 'Archived schedule data')
        ON CONFLICT (setting_key) 
        DO UPDATE SET setting_value = $2
      `;

      const archiveData = JSON.stringify({
        schedule_id: schedule.id,
        coil_id: schedule.coil_id,
        customer_name: schedule.customer_name,
        archived_at: new Date().toISOString()
      });

      await pool.query(archiveQuery, [`archived_schedule_${schedule.id}`, archiveData]);

      results.push({
        success: true,
        schedule_id: schedule.id,
        archived_at: new Date().toISOString()
      });
    } catch (error) {
      results.push({
        success: false,
        schedule_id: schedule.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 스케줄 삭제 함수
async function deleteSchedules(schedules: any[]): Promise<any[]> {
  const results = [];
  
  for (const schedule of schedules) {
    try {
      // 진행 중인 스케줄은 삭제 불가
      if (schedule.status === 'in_progress') {
        results.push({
          success: false,
          schedule_id: schedule.id,
          error: '진행 중인 스케줄은 삭제할 수 없습니다.'
        });
        continue;
      }

      // 관련 데이터 삭제 (CASCADE로 처리되지만 명시적으로 확인)
      await pool.query('DELETE FROM image_files WHERE schedule_id = $1', [schedule.id]);
      await pool.query('DELETE FROM defect_detections WHERE schedule_id = $1', [schedule.id]);
      await pool.query('DELETE FROM schedules WHERE id = $1', [schedule.id]);

      results.push({
        success: true,
        schedule_id: schedule.id,
        deleted_coil_id: schedule.coil_id
      });
    } catch (error) {
      results.push({
        success: false,
        schedule_id: schedule.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 스케줄 데이터 내보내기 함수
async function exportScheduleData(schedules: any[], parameters: any): Promise<any[]> {
  const results = [];
  
  for (const schedule of schedules) {
    try {
      // 스케줄 상세 데이터 조회
      const detailQuery = `
        SELECT 
          s.*,
          c.name as customer_name,
          c.code as customer_code,
          b.material_type,
          b.thickness,
          b.width,
          b.length,
          COUNT(img.id) as image_count,
          COUNT(dd.id) as defect_count,
          AVG(dd.confidence_score) as avg_confidence
        FROM schedules s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN boms b ON s.bom_id = b.id
        LEFT JOIN image_files img ON img.schedule_id = s.id
        LEFT JOIN defect_detections dd ON dd.schedule_id = s.id
        WHERE s.id = $1
        GROUP BY s.id, c.id, b.id
      `;

      const detailResult = await pool.query(detailQuery, [schedule.id]);
      
      if (detailResult.rows.length > 0) {
        const exportData = {
          schedule: detailResult.rows[0],
          export_format: parameters?.format || 'json',
          exported_at: new Date().toISOString()
        };

        results.push({
          success: true,
          schedule_id: schedule.id,
          export_data: exportData
        });
      } else {
        results.push({
          success: false,
          schedule_id: schedule.id,
          error: '스케줄 데이터를 찾을 수 없습니다.'
        });
      }
    } catch (error) {
      results.push({
        success: false,
        schedule_id: schedule.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
} 