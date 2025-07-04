import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { getUserFromSession } from '@/lib/session';
import { requirePermission, logPermissionAction } from '@/lib/middleware/permissions';

// 백업 알림 설정 조회
export async function GET(request: NextRequest) {
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.list');

    const connection = getConnection();
    const { searchParams } = new URL(request.url);
    
    const scheduleId = searchParams.get('schedule_id');
    const notificationType = searchParams.get('type');
    const enabled = searchParams.get('enabled');

    // 조건절 구성
    let whereConditions = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (scheduleId) {
      whereConditions.push(`bn.schedule_id = $${paramIndex}`);
      queryParams.push(parseInt(scheduleId));
      paramIndex++;
    }

    if (notificationType) {
      whereConditions.push(`bn.notification_type = $${paramIndex}`);
      queryParams.push(notificationType);
      paramIndex++;
    }

    if (enabled !== null && enabled !== '') {
      whereConditions.push(`bn.is_enabled = $${paramIndex}`);
      queryParams.push(enabled === 'true');
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 알림 설정 조회
    const query = `
      SELECT 
        bn.*,
        bs.schedule_name,
        bs.schedule_description,
        bs.is_enabled as schedule_enabled,
        
        -- 최근 알림 통계
        recent_stats.notifications_sent_today,
        recent_stats.last_notification_sent,
        recent_stats.notifications_sent_this_week
        
      FROM backup_notifications bn
      JOIN backup_schedules bs ON bn.schedule_id = bs.schedule_id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as notifications_sent_today,
          MAX(created_at) as last_notification_sent,
          COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') as notifications_sent_this_week
        FROM notification_logs 
        WHERE notification_id = bn.notification_id
      ) recent_stats ON true
      ${whereClause}
      ORDER BY bn.notification_id
    `;

    const result = await connection.query(query, queryParams);

    // 권한 확인 로그
    await logPermissionAction(user.id, 'backup.list', 'backup_notifications', null, request);

    return NextResponse.json({
      success: true,
      data: {
        notifications: result.rows
      }
    });

  } catch (error: any) {
    console.error('백업 알림 설정 조회 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '백업 알림 설정 조회에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// 새 백업 알림 설정 생성
export async function POST(request: NextRequest) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.create');

    const body = await request.json();
    
    // 입력 데이터 검증
    const {
      schedule_id,
      notification_type,
      is_enabled = true,
      notify_on_success = false,
      notify_on_failure = true,
      notify_on_retry = false,
      notify_on_schedule_disabled = true,
      recipient_emails = [],
      webhook_url,
      notification_template,
      max_notifications_per_hour = 10,
      silence_duration_minutes = 60
    } = body;

    // 필수 필드 검증
    if (!schedule_id || !notification_type) {
      return NextResponse.json(
        { 
          success: false, 
          error: '스케줄 ID와 알림 타입은 필수입니다.' 
        },
        { status: 400 }
      );
    }

    // 알림 타입별 검증
    if (notification_type === 'email' && (!recipient_emails || recipient_emails.length === 0)) {
      return NextResponse.json(
        { 
          success: false, 
          error: '이메일 알림의 경우 수신자 이메일이 필요합니다.' 
        },
        { status: 400 }
      );
    }

    if (notification_type === 'webhook' && !webhook_url) {
      return NextResponse.json(
        { 
          success: false, 
          error: '웹훅 알림의 경우 웹훅 URL이 필요합니다.' 
        },
        { status: 400 }
      );
    }

    // 스케줄 존재 확인
    const scheduleCheck = await connection.query(
      'SELECT schedule_id FROM backup_schedules WHERE schedule_id = $1',
      [schedule_id]
    );

    if (scheduleCheck.rows.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '존재하지 않는 백업 스케줄입니다.' 
        },
        { status: 404 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 알림 설정 생성
      const insertQuery = `
        INSERT INTO backup_notifications (
          schedule_id, notification_type, is_enabled, notify_on_success,
          notify_on_failure, notify_on_retry, notify_on_schedule_disabled,
          recipient_emails, webhook_url, notification_template,
          max_notifications_per_hour, silence_duration_minutes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;

      const insertResult = await connection.query(insertQuery, [
        schedule_id,
        notification_type,
        is_enabled,
        notify_on_success,
        notify_on_failure,
        notify_on_retry,
        notify_on_schedule_disabled,
        recipient_emails,
        webhook_url,
        notification_template,
        max_notifications_per_hour,
        silence_duration_minutes
      ]);

      const newNotification = insertResult.rows[0];

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'backup.create', 
        'backup_notifications', 
        newNotification.notification_id, 
        request,
        { schedule_id, notification_type }
      );

      return NextResponse.json({
        success: true,
        message: '백업 알림 설정이 성공적으로 생성되었습니다.',
        data: { notification: newNotification }
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 알림 설정 생성 오류:', error);
    
    if (error.code === '23505') { // 중복 제약 조건
      return NextResponse.json(
        { 
          success: false, 
          error: '이미 동일한 알림 설정이 존재합니다.' 
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: '백업 알림 설정 생성에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 