import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { getUserFromSession } from '@/lib/session';
import { requirePermission, logPermissionAction } from '@/lib/middleware/permissions';
import { BackupSchedule, backupScheduler } from '@/lib/services/backup-scheduler';

// 백업 스케줄 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.list');

    const connection = getConnection();
    const { searchParams } = new URL(request.url);
    
    // 쿼리 파라미터
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const enabled = searchParams.get('enabled');
    const search = searchParams.get('search');
    
    const offset = (page - 1) * limit;

    // 조건절 구성
    let whereConditions = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (enabled !== null && enabled !== '') {
      whereConditions.push(`bs.is_enabled = $${paramIndex}`);
      queryParams.push(enabled === 'true');
      paramIndex++;
    }

    if (search) {
      whereConditions.push(`(bs.schedule_name ILIKE $${paramIndex} OR bs.schedule_description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 백업 스케줄 조회 (상태 정보 포함)
    const query = `
      SELECT 
        bs.*,
        u.username as created_by_username,
        
        -- 최근 실행 정보
        recent_exec.execution_id as last_execution_id,
        recent_exec.status as last_execution_status,
        recent_exec.started_at as last_execution_time,
        recent_exec.completed_at as last_execution_completed,
        recent_exec.duration_seconds as last_execution_duration,
        recent_exec.error_message as last_error_message,
        recent_exec.backup_id as last_backup_id,
        
        -- 실행 통계 (최근 30일)
        COALESCE(exec_stats.total_executions, 0) as total_executions,
        COALESCE(exec_stats.successful_executions, 0) as successful_executions,
        COALESCE(exec_stats.failed_executions, 0) as failed_executions,
        CASE 
          WHEN exec_stats.total_executions > 0 
          THEN ROUND((exec_stats.successful_executions::DECIMAL / exec_stats.total_executions) * 100, 2)
          ELSE NULL 
        END as success_rate_percentage,
        
        -- 다음 실행까지 남은 시간
        CASE 
          WHEN bs.is_enabled AND bs.next_run_at > CURRENT_TIMESTAMP 
          THEN EXTRACT(EPOCH FROM (bs.next_run_at - CURRENT_TIMESTAMP))
          ELSE NULL 
        END as seconds_until_next_run,
        
        -- 알림 설정 개수
        COALESCE(notif_count.notification_count, 0) as notification_count
        
      FROM backup_schedules bs
      LEFT JOIN users u ON bs.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT 
          execution_id, status, started_at, completed_at, 
          duration_seconds, error_message, backup_id
        FROM backup_executions 
        WHERE schedule_id = bs.schedule_id 
        ORDER BY started_at DESC 
        LIMIT 1
      ) recent_exec ON true
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) as total_executions,
          COUNT(*) FILTER (WHERE status = 'completed') as successful_executions,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_executions
        FROM backup_executions 
        WHERE schedule_id = bs.schedule_id
          AND started_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
      ) exec_stats ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as notification_count
        FROM backup_notifications
        WHERE schedule_id = bs.schedule_id AND is_enabled = true
      ) notif_count ON true
      ${whereClause}
      ORDER BY bs.schedule_name
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await connection.query(query, queryParams);

    // 총 개수 조회
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM backup_schedules bs 
      ${whereClause}
    `;
    
    const countResult = await connection.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    // 권한 확인 로그
    await logPermissionAction(user.id, 'backup.list', 'backup_schedules', null, request);

    return NextResponse.json({
      success: true,
      data: {
        schedules: result.rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error: any) {
    console.error('백업 스케줄 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '백업 스케줄 조회에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// 새 백업 스케줄 생성
export async function POST(request: NextRequest) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.create');

    const body = await request.json();
    
    // 입력 데이터 검증
    const {
      schedule_name,
      schedule_description,
      cron_expression,
      timezone = 'Asia/Seoul',
      is_enabled = true,
      backup_type = 'full',
      backup_categories,
      max_backup_count = 10,
      retention_days = 30,
      compression_enabled = true,
      encryption_enabled = false
    } = body;

    // 필수 필드 검증
    if (!schedule_name || !cron_expression) {
      return NextResponse.json(
        { 
          success: false, 
          error: '스케줄 이름과 크론 표현식은 필수입니다.' 
        },
        { status: 400 }
      );
    }

    // 크론 표현식 검증 (간단한 검증)
    const cronPattern = /^(\*|[0-5]?\d|\*\/\d+)\s+(\*|1?\d|2[0-3]|\*\/\d+)\s+(\*|[12]?\d|3[01]|\*\/\d+)\s+(\*|[1-9]|1[0-2]|\*\/\d+)\s+(\*|[0-6]|\*\/\d+)$/;
    if (!cronPattern.test(cron_expression)) {
      return NextResponse.json(
        { 
          success: false, 
          error: '잘못된 크론 표현식 형식입니다.' 
        },
        { status: 400 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 스케줄 생성
      const insertQuery = `
        INSERT INTO backup_schedules (
          schedule_name, schedule_description, cron_expression, timezone,
          is_enabled, backup_type, backup_categories, max_backup_count,
          retention_days, compression_enabled, encryption_enabled, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const insertResult = await connection.query(insertQuery, [
        schedule_name,
        schedule_description,
        cron_expression,
        timezone,
        is_enabled,
        backup_type,
        backup_categories,
        max_backup_count,
        retention_days,
        compression_enabled,
        encryption_enabled,
        user.id
      ]);

      const newSchedule = insertResult.rows[0] as BackupSchedule;

      // 스케줄러에 새 작업 등록
      if (is_enabled) {
        await backupScheduler.updateSchedule(newSchedule.schedule_id);
      }

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'backup.create', 
        'backup_schedules', 
        newSchedule.schedule_id, 
        request,
        { schedule_name, cron_expression }
      );

      return NextResponse.json({
        success: true,
        message: '백업 스케줄이 성공적으로 생성되었습니다.',
        data: { schedule: newSchedule }
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 스케줄 생성 오류:', error);
    
    if (error.code === '23505') { // 중복 제약 조건
      return NextResponse.json(
        { 
          success: false, 
          error: '이미 존재하는 스케줄 이름입니다.' 
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: '백업 스케줄 생성에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 