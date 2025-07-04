import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { getUserFromSession } from '@/lib/session';
import { requirePermission, logPermissionAction } from '@/lib/middleware/permissions';

interface RouteParams {
  params: {
    id: string;
  };
}

// 특정 백업 알림 설정 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.list');

    const notificationId = parseInt(params.id);
    if (isNaN(notificationId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 알림 ID입니다.' },
        { status: 400 }
      );
    }

    const connection = getConnection();

    // 알림 설정 상세 정보 조회
    const query = `
      SELECT 
        bn.*,
        bs.schedule_name,
        bs.schedule_description,
        bs.is_enabled as schedule_enabled,
        bs.cron_expression,
        
        -- 알림 발송 통계
        notif_stats.total_notifications,
        notif_stats.notifications_today,
        notif_stats.notifications_this_week,
        notif_stats.notifications_this_month,
        notif_stats.last_notification_sent,
        notif_stats.successful_notifications,
        notif_stats.failed_notifications,
        
        -- 최근 알림 로그 (최근 10개)
        COALESCE(
          json_agg(
            json_build_object(
              'log_id', nl.log_id,
              'notification_type', nl.notification_type,
              'status', nl.status,
              'sent_at', nl.sent_at,
              'recipient', nl.recipient,
              'message_subject', nl.message_subject,
              'error_message', nl.error_message
            ) ORDER BY nl.sent_at DESC
          ) FILTER (WHERE nl.log_id IS NOT NULL), 
          '[]'::json
        ) as recent_notification_logs
        
      FROM backup_notifications bn
      JOIN backup_schedules bs ON bn.schedule_id = bs.schedule_id
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) as total_notifications,
          COUNT(*) FILTER (WHERE sent_at >= CURRENT_DATE) as notifications_today,
          COUNT(*) FILTER (WHERE sent_at >= CURRENT_DATE - INTERVAL '7 days') as notifications_this_week,
          COUNT(*) FILTER (WHERE sent_at >= CURRENT_DATE - INTERVAL '30 days') as notifications_this_month,
          MAX(sent_at) as last_notification_sent,
          COUNT(*) FILTER (WHERE status = 'sent') as successful_notifications,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_notifications
        FROM notification_logs 
        WHERE notification_id = bn.notification_id
      ) notif_stats ON true
      LEFT JOIN LATERAL (
        SELECT * FROM notification_logs 
        WHERE notification_id = bn.notification_id 
        ORDER BY sent_at DESC 
        LIMIT 10
      ) nl ON true
      WHERE bn.notification_id = $1
      GROUP BY bn.notification_id, bs.schedule_id, 
               notif_stats.total_notifications, notif_stats.notifications_today,
               notif_stats.notifications_this_week, notif_stats.notifications_this_month,
               notif_stats.last_notification_sent, notif_stats.successful_notifications,
               notif_stats.failed_notifications
    `;

    const result = await connection.query(query, [notificationId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '백업 알림 설정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const notification = result.rows[0];

    // 권한 확인 로그
    await logPermissionAction(user.id, 'backup.list', 'backup_notifications', notificationId, request);

    return NextResponse.json({
      success: true,
      data: { notification }
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

// 백업 알림 설정 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.create');

    const notificationId = parseInt(params.id);
    if (isNaN(notificationId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 알림 ID입니다.' },
        { status: 400 }
      );
    }

    const body = await request.json();
    
    // 기존 알림 설정 확인
    const existingQuery = `SELECT * FROM backup_notifications WHERE notification_id = $1`;
    const existingResult = await connection.query(existingQuery, [notificationId]);
    
    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '백업 알림 설정을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const existingNotification = existingResult.rows[0];

    // 업데이트할 필드 추출
    const {
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
    } = body;

    // 알림 타입별 검증
    const finalNotificationType = notification_type || existingNotification.notification_type;
    const finalRecipientEmails = recipient_emails !== undefined ? recipient_emails : existingNotification.recipient_emails;
    const finalWebhookUrl = webhook_url !== undefined ? webhook_url : existingNotification.webhook_url;

    if (finalNotificationType === 'email' && (!finalRecipientEmails || finalRecipientEmails.length === 0)) {
      return NextResponse.json(
        { 
          success: false, 
          error: '이메일 알림의 경우 수신자 이메일이 필요합니다.' 
        },
        { status: 400 }
      );
    }

    if (finalNotificationType === 'webhook' && !finalWebhookUrl) {
      return NextResponse.json(
        { 
          success: false, 
          error: '웹훅 알림의 경우 웹훅 URL이 필요합니다.' 
        },
        { status: 400 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 알림 설정 업데이트
      const updateQuery = `
        UPDATE backup_notifications 
        SET 
          notification_type = COALESCE($1, notification_type),
          is_enabled = COALESCE($2, is_enabled),
          notify_on_success = COALESCE($3, notify_on_success),
          notify_on_failure = COALESCE($4, notify_on_failure),
          notify_on_retry = COALESCE($5, notify_on_retry),
          notify_on_schedule_disabled = COALESCE($6, notify_on_schedule_disabled),
          recipient_emails = COALESCE($7, recipient_emails),
          webhook_url = COALESCE($8, webhook_url),
          notification_template = COALESCE($9, notification_template),
          max_notifications_per_hour = COALESCE($10, max_notifications_per_hour),
          silence_duration_minutes = COALESCE($11, silence_duration_minutes),
          updated_at = CURRENT_TIMESTAMP
        WHERE notification_id = $12
        RETURNING *
      `;

      const updateResult = await connection.query(updateQuery, [
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
        silence_duration_minutes,
        notificationId
      ]);

      const updatedNotification = updateResult.rows[0];

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'backup.create', 
        'backup_notifications', 
        notificationId, 
        request,
        { 
          updated_fields: Object.keys(body),
          old_enabled: existingNotification.is_enabled,
          new_enabled: updatedNotification.is_enabled
        }
      );

      return NextResponse.json({
        success: true,
        message: '백업 알림 설정이 성공적으로 수정되었습니다.',
        data: { notification: updatedNotification }
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 알림 설정 수정 오류:', error);

    return NextResponse.json(
      { 
        success: false, 
        error: '백업 알림 설정 수정에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// 백업 알림 설정 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.delete');

    const notificationId = parseInt(params.id);
    if (isNaN(notificationId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 알림 ID입니다.' },
        { status: 400 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 알림 설정 존재 확인
      const existingQuery = `
        SELECT bn.*, bs.schedule_name 
        FROM backup_notifications bn
        JOIN backup_schedules bs ON bn.schedule_id = bs.schedule_id
        WHERE bn.notification_id = $1
      `;
      const existingResult = await connection.query(existingQuery, [notificationId]);
      
      if (existingResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: '백업 알림 설정을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const notification = existingResult.rows[0];

      // 관련 알림 로그 삭제 (또는 보관 정책에 따라 유지)
      await connection.query(
        `DELETE FROM notification_logs WHERE notification_id = $1`,
        [notificationId]
      );

      // 백업 알림 설정 삭제
      await connection.query(
        `DELETE FROM backup_notifications WHERE notification_id = $1`,
        [notificationId]
      );

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'backup.delete', 
        'backup_notifications', 
        notificationId, 
        request,
        { 
          schedule_name: notification.schedule_name,
          notification_type: notification.notification_type
        }
      );

      return NextResponse.json({
        success: true,
        message: '백업 알림 설정이 성공적으로 삭제되었습니다.'
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 알림 설정 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '백업 알림 설정 삭제에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 