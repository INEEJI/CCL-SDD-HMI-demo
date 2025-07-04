import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { getUserFromSession } from '@/lib/session';
import { requirePermission, logPermissionAction } from '@/lib/middleware/permissions';

// 백업 보존 정책 목록 조회
export async function GET(request: NextRequest) {
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.list');

    const connection = getConnection();
    const { searchParams } = new URL(request.url);
    
    const includeUsage = searchParams.get('include_usage') === 'true';

    let query = `
      SELECT 
        brp.*,
        ${includeUsage ? `
        -- 정책 사용 통계
        usage_stats.schedules_using_policy,
        usage_stats.total_backups_affected,
        usage_stats.estimated_cleanup_count,
        usage_stats.last_cleanup_run
        ` : ''}
        
      FROM backup_retention_policies brp
      ${includeUsage ? `
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(DISTINCT bs.schedule_id) as schedules_using_policy,
          COUNT(sb.backup_id) as total_backups_affected,
          COUNT(sb.backup_id) FILTER (
            WHERE sb.created_at < (CURRENT_TIMESTAMP - INTERVAL '1 day' * brp.daily_retention_days)
          ) as estimated_cleanup_count,
          MAX(cleanup_log.last_run) as last_cleanup_run
        FROM backup_schedules bs
        LEFT JOIN setting_backups sb ON true  -- 모든 백업 (실제로는 스케줄별 필터링 필요)
        LEFT JOIN LATERAL (
          SELECT MAX(created_at) as last_run 
          FROM audit_logs 
          WHERE action = 'backup_cleanup' 
            AND resource_type = 'backup_retention_policies'
            AND resource_id = brp.policy_id::text
        ) cleanup_log ON true
        WHERE bs.schedule_id IS NOT NULL  -- 실제로는 정책과 연결된 스케줄만
      ) usage_stats ON true
      ` : ''}
      ORDER BY 
        brp.is_default DESC,
        brp.policy_name
    `;

    const result = await connection.query(query);

    // 권한 확인 로그
    await logPermissionAction(user.id, 'backup.list', 'backup_retention_policies', null, request);

    return NextResponse.json({
      success: true,
      data: {
        policies: result.rows
      }
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

// 새 백업 보존 정책 생성
export async function POST(request: NextRequest) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'system.configuration');

    const body = await request.json();
    
    // 입력 데이터 검증
    const {
      policy_name,
      policy_description,
      is_default = false,
      daily_retention_days = 7,
      weekly_retention_weeks = 4,
      monthly_retention_months = 12,
      yearly_retention_years = 3,
      max_total_backups = 100,
      max_daily_backups = 1,
      max_weekly_backups = 1,
      max_monthly_backups = 1,
      max_total_size_gb,
      auto_cleanup_enabled = true,
      cleanup_schedule = '0 3 * * 0' // 매주 일요일 오전 3시
    } = body;

    // 필수 필드 검증
    if (!policy_name) {
      return NextResponse.json(
        { 
          success: false, 
          error: '정책 이름은 필수입니다.' 
        },
        { status: 400 }
      );
    }

    // 보존 기간 검증
    if (daily_retention_days < 1 || weekly_retention_weeks < 1 || 
        monthly_retention_months < 1 || yearly_retention_years < 1) {
      return NextResponse.json(
        { 
          success: false, 
          error: '보존 기간은 1 이상이어야 합니다.' 
        },
        { status: 400 }
      );
    }

    // 최대 백업 개수 검증
    if (max_total_backups < 1 || max_daily_backups < 1) {
      return NextResponse.json(
        { 
          success: false, 
          error: '최대 백업 개수는 1 이상이어야 합니다.' 
        },
        { status: 400 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 기본 정책 설정 시 기존 기본 정책 해제
      if (is_default) {
        await connection.query(
          'UPDATE backup_retention_policies SET is_default = false WHERE is_default = true'
        );
      }

      // 보존 정책 생성
      const insertQuery = `
        INSERT INTO backup_retention_policies (
          policy_name, policy_description, is_default,
          daily_retention_days, weekly_retention_weeks, monthly_retention_months, yearly_retention_years,
          max_total_backups, max_daily_backups, max_weekly_backups, max_monthly_backups,
          max_total_size_gb, auto_cleanup_enabled, cleanup_schedule
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const insertResult = await connection.query(insertQuery, [
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
      ]);

      const newPolicy = insertResult.rows[0];

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'system.configuration', 
        'backup_retention_policies', 
        newPolicy.policy_id, 
        request,
        { policy_name, is_default }
      );

      return NextResponse.json({
        success: true,
        message: '백업 보존 정책이 성공적으로 생성되었습니다.',
        data: { policy: newPolicy }
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 보존 정책 생성 오류:', error);
    
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
        error: '백업 보존 정책 생성에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 