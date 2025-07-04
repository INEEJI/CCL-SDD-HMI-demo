import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';

// GET /api/audit-logs/stats - 감사 로그 통계 조회
export async function GET(request: NextRequest) {
  // 인증 확인 (관리자 권한 필요)
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d
    const groupBy = searchParams.get('groupBy') || 'action'; // action, user, table, date

    // 기간별 날짜 계산
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // 1. 전체 통계 요약
    const overallStats = await pool.query(`
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT table_name) as affected_tables,
        COUNT(DISTINCT action) as action_types,
        MIN(created_at) as earliest_log,
        MAX(created_at) as latest_log
      FROM audit_logs 
      WHERE created_at >= $1
    `, [startDate.toISOString()]);

    // 2. 액션별 통계
    const actionStats = await pool.query(`
      SELECT 
        action,
        COUNT(*) as count,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT table_name) as affected_tables,
        MIN(created_at) as first_occurrence,
        MAX(created_at) as last_occurrence
      FROM audit_logs 
      WHERE created_at >= $1
      GROUP BY action
      ORDER BY count DESC
    `, [startDate.toISOString()]);

    // 3. 사용자별 활동 통계
    const userStats = await pool.query(`
      SELECT 
        u.username,
        u.role,
        al.user_id,
        COUNT(*) as total_actions,
        COUNT(DISTINCT al.action) as action_types,
        COUNT(DISTINCT al.table_name) as affected_tables,
        MIN(al.created_at) as first_activity,
        MAX(al.created_at) as last_activity,
        STRING_AGG(DISTINCT al.action, ', ' ORDER BY al.action) as actions_performed
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= $1
      GROUP BY al.user_id, u.username, u.role
      ORDER BY total_actions DESC
      LIMIT 20
    `, [startDate.toISOString()]);

    // 4. 테이블별 변경 통계
    const tableStats = await pool.query(`
      SELECT 
        table_name,
        COUNT(*) as total_changes,
        COUNT(DISTINCT user_id) as users_involved,
        COUNT(CASE WHEN action = 'CREATE' THEN 1 END) as creates,
        COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) as updates,
        COUNT(CASE WHEN action = 'DELETE' THEN 1 END) as deletes,
        MIN(created_at) as first_change,
        MAX(created_at) as last_change
      FROM audit_logs 
      WHERE created_at >= $1
      GROUP BY table_name
      ORDER BY total_changes DESC
    `, [startDate.toISOString()]);

    // 5. 시간대별 활동 패턴
    const hourlyPattern = await pool.query(`
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as activity_count,
        COUNT(DISTINCT user_id) as active_users,
        STRING_AGG(DISTINCT action, ', ') as actions
      FROM audit_logs 
      WHERE created_at >= $1
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY hour
    `, [startDate.toISOString()]);

    // 6. 일별 활동 트렌드
    const dailyTrend = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_logs,
        COUNT(DISTINCT user_id) as active_users,
        COUNT(CASE WHEN action = 'LOGIN' THEN 1 END) as logins,
        COUNT(CASE WHEN action = 'CREATE' THEN 1 END) as creates,
        COUNT(CASE WHEN action = 'UPDATE' THEN 1 END) as updates,
        COUNT(CASE WHEN action = 'DELETE' THEN 1 END) as deletes
      FROM audit_logs 
      WHERE created_at >= $1
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [startDate.toISOString()]);

    // 7. 보안 관련 이벤트
    const securityEvents = await pool.query(`
      SELECT 
        al.*,
        u.username,
        u.role
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= $1
        AND (al.action IN ('LOGIN', 'LOGOUT', 'DELETE') 
             OR al.table_name IN ('users', 'system_settings', 'ai_models'))
      ORDER BY al.created_at DESC
      LIMIT 50
    `, [startDate.toISOString()]);

    // 8. 최고 활동 시간대 및 사용자
    const peakActivity = await pool.query(`
      SELECT 
        'peak_hour' as type,
        EXTRACT(HOUR FROM created_at) as value,
        COUNT(*) as count
      FROM audit_logs 
      WHERE created_at >= $1
      GROUP BY EXTRACT(HOUR FROM created_at)
      ORDER BY count DESC
      LIMIT 1
      
      UNION ALL
      
      SELECT 
        'most_active_user' as type,
        u.username as value,
        COUNT(*) as count
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.created_at >= $1
      GROUP BY al.user_id, u.username
      ORDER BY count DESC
      LIMIT 1
    `, [startDate.toISOString()]);

    return NextResponse.json({
      data: {
        overview: overallStats.rows[0],
        byAction: actionStats.rows,
        byUser: userStats.rows,
        byTable: tableStats.rows,
        hourlyPattern: hourlyPattern.rows,
        dailyTrend: dailyTrend.rows,
        securityEvents: securityEvents.rows,
        peakActivity: peakActivity.rows.reduce((acc: any, row: any) => {
          acc[row.type] = { value: row.value, count: row.count };
          return acc;
        }, {}),
        period,
        generatedAt: new Date().toISOString(),
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('감사 로그 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '감사 로그 통계 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 