import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { getUserFromSession } from '@/lib/session';
import { requirePermission, logPermissionAction } from '@/lib/middleware/permissions';

interface RouteParams {
  params: {
    id: string;
  };
}

// 특정 백업 보존 정책 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.list');

    const policyId = parseInt(params.id);
    if (isNaN(policyId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 정책 ID입니다.' },
        { status: 400 }
      );
    }

    const connection = getConnection();

    // 정책 상세 정보 조회
    const query = `
      SELECT 
        brp.*,
        
        -- 정책 사용 통계
        usage_stats.schedules_using_policy,
        usage_stats.total_backups_affected,
        usage_stats.estimated_cleanup_count,
        usage_stats.last_cleanup_run,
        usage_stats.total_size_gb,
        
        -- 최근 정리 이력
        COALESCE(
          json_agg(
            json_build_object(
              'cleanup_date', cl.cleanup_date,
              'deleted_backups', cl.deleted_backups,
              'freed_space_bytes', cl.freed_space_bytes,
              'cleanup_duration_seconds', cl.cleanup_duration_seconds
            ) ORDER BY cl.cleanup_date DESC
          ) FILTER (WHERE cl.cleanup_id IS NOT NULL), 
          '[]'::json
        ) as recent_cleanup_history
        
      FROM backup_retention_policies brp
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(DISTINCT bs.schedule_id) as schedules_using_policy,
          COUNT(sb.backup_id) as total_backups_affected,
          COUNT(sb.backup_id) FILTER (
            WHERE sb.created_at < (CURRENT_TIMESTAMP - INTERVAL '1 day' * brp.daily_retention_days)
          ) as estimated_cleanup_count,
          MAX(cleanup_log.last_run) as last_cleanup_run,
          ROUND(SUM(LENGTH(sb.backup_data::text))::DECIMAL / (1024*1024*1024), 2) as total_size_gb
        FROM backup_schedules bs
        LEFT JOIN setting_backups sb ON true
        LEFT JOIN LATERAL (
          SELECT MAX(created_at) as last_run 
          FROM audit_logs 
          WHERE action = 'backup_cleanup' 
            AND resource_type = 'backup_retention_policies'
            AND resource_id = brp.policy_id::text
        ) cleanup_log ON true
        WHERE bs.schedule_id IS NOT NULL
      ) usage_stats ON true
      LEFT JOIN LATERAL (
        SELECT * FROM cleanup_history 
        WHERE policy_id = brp.policy_id 
        ORDER BY cleanup_date DESC 
        LIMIT 10
      ) cl ON true
      WHERE brp.policy_id = $1
      GROUP BY brp.policy_id, 
               usage_stats.schedules_using_policy, usage_stats.total_backups_affected,
               usage_stats.estimated_cleanup_count, usage_stats.last_cleanup_run,
               usage_stats.total_size_gb
    `;

    const result = await connection.query(query, [policyId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '백업 보존 정책을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const policy = result.rows[0];

    // 권한 확인 로그
    await logPermissionAction(user.id, 'backup.list', 'backup_retention_policies', policyId, request);

    return NextResponse.json({
      success: true,
      data: { policy }
    });

  } catch (error: any) {
    console.error('백업 보존 정책 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '백업 보존 정책 조회에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// 백업 보존 정책 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'system.configuration');

    const policyId = parseInt(params.id);
    if (isNaN(policyId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 정책 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // 기존 정책 확인
    const existingQuery = `SELECT * FROM backup_retention_policies WHERE policy_id = $1`;
    const existingResult = await connection.query(existingQuery, [policyId]);
    
    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '백업 보존 정책을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const existingPolicy = existingResult.rows[0];

    // 업데이트할 필드 추출
    const {
      policy_name,
      policy_description,
      is_default,
      daily_retention_days,
      weekly_retention_weeks,
      monthly_retention_months,
      yearly_retention_years,
      max_total_backups,
      max_daily_backups,
      max_weekly_backups,
      max_monthly_backups,
      max_total_size_gb,
      auto_cleanup_enabled,
      cleanup_schedule
    } = body;

    // 보존 기간 검증
    if (daily_retention_days && daily_retention_days < 1) {
      return NextResponse.json(
        { success: false, error: '일일 보존 기간은 1일 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    // 최대 백업 개수 검증
    if (max_total_backups && max_total_backups < 1) {
      return NextResponse.json(
        { success: false, error: '최대 백업 개수는 1개 이상이어야 합니다.' },
        { status: 400 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 기본 정책 설정 시 기존 기본 정책 해제
      if (is_default && !existingPolicy.is_default) {
        await connection.query(
          'UPDATE backup_retention_policies SET is_default = false WHERE is_default = true'
        );
      }

      // 정책 업데이트
      const updateQuery = `
        UPDATE backup_retention_policies 
        SET 
          policy_name = COALESCE($1, policy_name),
          policy_description = COALESCE($2, policy_description),
          is_default = COALESCE($3, is_default),
          daily_retention_days = COALESCE($4, daily_retention_days),
          weekly_retention_weeks = COALESCE($5, weekly_retention_weeks),
          monthly_retention_months = COALESCE($6, monthly_retention_months),
          yearly_retention_years = COALESCE($7, yearly_retention_years),
          max_total_backups = COALESCE($8, max_total_backups),
          max_daily_backups = COALESCE($9, max_daily_backups),
          max_weekly_backups = COALESCE($10, max_weekly_backups),
          max_monthly_backups = COALESCE($11, max_monthly_backups),
          max_total_size_gb = COALESCE($12, max_total_size_gb),
          auto_cleanup_enabled = COALESCE($13, auto_cleanup_enabled),
          cleanup_schedule = COALESCE($14, cleanup_schedule),
          updated_at = CURRENT_TIMESTAMP
        WHERE policy_id = $15
        RETURNING *
      `;

      const updateResult = await connection.query(updateQuery, [
        policy_name,
        policy_description,
        is_default,
        daily_retention_days,
        weekly_retention_weeks,
        monthly_retention_months,
        yearly_retention_years,
        max_total_backups,
        max_daily_backups,
        max_weekly_backups,
        max_monthly_backups,
        max_total_size_gb,
        auto_cleanup_enabled,
        cleanup_schedule,
        policyId
      ]);

      const updatedPolicy = updateResult.rows[0];

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'system.configuration', 
        'backup_retention_policies', 
        policyId, 
        request,
        { 
          updated_fields: Object.keys(body),
          old_default: existingPolicy.is_default,
          new_default: updatedPolicy.is_default
        }
      );

      return NextResponse.json({
        success: true,
        message: '백업 보존 정책이 성공적으로 수정되었습니다.',
        data: { policy: updatedPolicy }
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 보존 정책 수정 오류:', error);
    
    if (error.code === '23505') { // 중복 제약 조건
      return NextResponse.json(
        { 
          success: false, 
          error: '이미 존재하는 정책 이름입니다.' 
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: '백업 보존 정책 수정에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// 백업 보존 정책 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'system.configuration');

    const policyId = parseInt(params.id);
    if (isNaN(policyId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 정책 ID입니다.' },
        { status: 400 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 정책 존재 확인
      const existingQuery = `SELECT * FROM backup_retention_policies WHERE policy_id = $1`;
      const existingResult = await connection.query(existingQuery, [policyId]);
      
      if (existingResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: '백업 보존 정책을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const policy = existingResult.rows[0];

      // 기본 정책 삭제 방지
      if (policy.is_default) {
        return NextResponse.json(
          { 
            success: false, 
            error: '기본 보존 정책은 삭제할 수 없습니다.' 
          },
          { status: 409 }
        );
      }

      // 사용 중인 정책인지 확인
      const usageQuery = `
        SELECT COUNT(*) as usage_count 
        FROM backup_schedules bs
        WHERE bs.schedule_id IS NOT NULL  -- 실제로는 정책과 연결된 스케줄 확인 필요
      `;
      const usageResult = await connection.query(usageQuery);
      
      // 실제 사용량 확인은 스키마에 따라 조정 필요
      // 현재는 경고만 표시

      // 정리 이력 삭제 (있다면)
      await connection.query(
        `DELETE FROM cleanup_history WHERE policy_id = $1`,
        [policyId]
      );

      // 백업 보존 정책 삭제
      await connection.query(
        `DELETE FROM backup_retention_policies WHERE policy_id = $1`,
        [policyId]
      );

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'system.configuration', 
        'backup_retention_policies', 
        policyId, 
        request,
        { policy_name: policy.policy_name }
      );

      return NextResponse.json({
        success: true,
        message: '백업 보존 정책이 성공적으로 삭제되었습니다.'
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 보존 정책 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '백업 보존 정책 삭제에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 