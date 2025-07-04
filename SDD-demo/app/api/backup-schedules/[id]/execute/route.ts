import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { getUserFromSession } from '@/lib/session';
import { requirePermission, logPermissionAction } from '@/lib/middleware/permissions';
import { BackupSchedule } from '@/lib/services/backup-scheduler';
import { BackupApi } from '@/lib/api/backupApi';

interface RouteParams {
  params: {
    id: string;
  };
}

// 백업 스케줄 수동 실행
export async function POST(request: NextRequest, { params }: RouteParams) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.create');

    const scheduleId = parseInt(params.id);
    if (isNaN(scheduleId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 스케줄 ID입니다.' },
        { status: 400 }
      );
    }

    // 스케줄 존재 확인
    const scheduleQuery = `SELECT * FROM backup_schedules WHERE schedule_id = $1`;
    const scheduleResult = await connection.query(scheduleQuery, [scheduleId]);
    
    if (scheduleResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '백업 스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const schedule = scheduleResult.rows[0] as BackupSchedule;

    // 이미 실행 중인 백업이 있는지 확인
    const runningQuery = `
      SELECT COUNT(*) as running_count 
      FROM backup_executions 
      WHERE schedule_id = $1 AND status = 'running'
    `;
    const runningResult = await connection.query(runningQuery, [scheduleId]);
    
    if (parseInt(runningResult.rows[0].running_count) > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: '이미 실행 중인 백업이 있습니다.' 
        },
        { status: 409 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 실행 기록 생성
      const executionQuery = `
        INSERT INTO backup_executions (
          schedule_id, execution_type, status, started_at, 
          retry_count, max_retries, triggered_by, execution_metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING execution_id
      `;

      const executionResult = await connection.query(executionQuery, [
        scheduleId,
        'manual',
        'running',
        new Date().toISOString(),
        0,
        3,
        user.id,
        JSON.stringify({
          schedule_name: schedule.schedule_name,
          backup_type: schedule.backup_type,
          categories: schedule.backup_categories,
          manual_execution: true,
          triggered_by_user: user.username
        })
      ]);

      const executionId = executionResult.rows[0].execution_id;

      // 백업 실행 (비동기)
      executeBackupAsync(executionId, schedule, user.id).catch(error => {
        console.error('백업 실행 오류:', error);
      });

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'backup.create', 
        'backup_schedules', 
        scheduleId, 
        request,
        { 
          action: 'manual_execution',
          execution_id: executionId,
          schedule_name: schedule.schedule_name
        }
      );

      return NextResponse.json({
        success: true,
        message: '백업 실행이 시작되었습니다.',
        data: { 
          execution_id: executionId,
          schedule_name: schedule.schedule_name,
          status: 'running'
        }
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 수동 실행 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '백업 실행에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// 비동기 백업 실행 함수
async function executeBackupAsync(
  executionId: number, 
  schedule: BackupSchedule, 
  userId: number
): Promise<void> {
  const connection = getConnection();
  const startTime = Date.now();

  try {
    console.log(`수동 백업 실행 시작: ${schedule.schedule_name} (실행 ID: ${executionId})`);

    // 백업 실행
    const backupResult = await performBackup(schedule);

    // 실행 완료 처리
    const completedAt = new Date();
    const duration = Math.floor((completedAt.getTime() - startTime) / 1000);

    const updateQuery = `
      UPDATE backup_executions 
      SET 
        backup_id = $1,
        status = $2,
        completed_at = $3,
        duration_seconds = $4,
        settings_count = $5,
        backup_size_bytes = $6
      WHERE execution_id = $7
    `;

    await connection.query(updateQuery, [
      backupResult.backupId,
      'completed',
      completedAt.toISOString(),
      duration,
      backupResult.backup?.settingsCount || 0,
      calculateBackupSize(backupResult.backup),
      executionId
    ]);

    // 백업 메타데이터 추가
    await addBackupMetadata(backupResult.backupId, executionId, schedule.schedule_id);

    // 성공 알림 발송
    await sendNotification(schedule, executionId, 'success', {
      backup_id: backupResult.backupId,
      duration_seconds: duration,
      settings_count: backupResult.backup?.settingsCount || 0,
      manual_execution: true
    });

    console.log(`수동 백업 실행 완료: ${schedule.schedule_name} (백업 ID: ${backupResult.backupId})`);

  } catch (error: any) {
    console.error(`수동 백업 실행 오류 (${schedule.schedule_name}):`, error);

    // 실패 처리
    const failureQuery = `
      UPDATE backup_executions 
      SET 
        status = $1,
        completed_at = $2,
        error_message = $3,
        error_details = $4
      WHERE execution_id = $5
    `;

    await connection.query(failureQuery, [
      'failed',
      new Date().toISOString(),
      error.message || '알 수 없는 오류',
      JSON.stringify({
        stack: error.stack,
        code: error.code,
        details: error.details,
        manual_execution: true
      }),
      executionId
    ]);

    // 실패 알림 발송
    await sendNotification(schedule, executionId, 'failure', {
      error_message: error.message,
      manual_execution: true
    });
  }
}

// 실제 백업 수행
async function performBackup(schedule: BackupSchedule): Promise<any> {
  try {
    // 카테고리별 백업 또는 전체 백업
    if (schedule.backup_categories && schedule.backup_categories.length > 0) {
      // 특정 카테고리만 백업 (향후 구현)
      console.log(`카테고리별 백업: ${schedule.backup_categories.join(', ')}`);
      return await BackupApi.createBackup();
    } else {
      // 전체 백업
      return await BackupApi.createBackup();
    }
  } catch (error) {
    console.error('백업 수행 오류:', error);
    throw error;
  }
}

// 백업 메타데이터 추가
async function addBackupMetadata(
  backupId: string, 
  executionId: number, 
  scheduleId: number
): Promise<void> {
  const connection = getConnection();

  try {
    const query = `
      INSERT INTO backup_metadata (
        backup_id, schedule_id, tags, backup_category, 
        backup_priority, source_system_version, backup_tool_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    await connection.query(query, [
      backupId,
      scheduleId,
      ['manual', 'user-triggered'],
      'manual',
      'normal',
      process.env.SYSTEM_VERSION || '1.0.0',
      '1.0.0'
    ]);

  } catch (error) {
    console.error('백업 메타데이터 추가 오류:', error);
  }
}

// 알림 발송
async function sendNotification(
  schedule: BackupSchedule,
  executionId: number,
  type: 'success' | 'failure',
  data: any
): Promise<void> {
  const connection = getConnection();

  try {
    // 알림 설정 조회
    const notificationQuery = `
      SELECT * FROM backup_notifications 
      WHERE schedule_id = $1 AND is_enabled = true
    `;
    
    const result = await connection.query(notificationQuery, [schedule.schedule_id]);
    const notifications = result.rows;

    for (const notification of notifications) {
      const shouldSend = (type === 'success' && notification.notify_on_success) ||
                        (type === 'failure' && notification.notify_on_failure);
      
      if (shouldSend) {
        await sendNotificationMessage(notification, schedule, executionId, type, data);
      }
    }

  } catch (error) {
    console.error('알림 발송 오류:', error);
  }
}

// 실제 알림 메시지 발송
async function sendNotificationMessage(
  notification: any,
  schedule: BackupSchedule,
  executionId: number,
  type: 'success' | 'failure',
  data: any
): Promise<void> {
  try {
    const message = {
      schedule_name: schedule.schedule_name,
      execution_id: executionId,
      execution_type: 'manual',
      status: type === 'success' ? 'completed' : 'failed',
      type: type,
      manual_execution: true,
      ...data
    };

    switch (notification.notification_type) {
      case 'email':
        await sendEmailNotification(notification.recipient_emails, message);
        break;
      case 'webhook':
        if (notification.webhook_url) {
          await sendWebhookNotification(notification.webhook_url, message);
        }
        break;
    }

  } catch (error) {
    console.error('알림 메시지 발송 오류:', error);
  }
}

// 이메일 알림 발송
async function sendEmailNotification(recipients: string[], message: any): Promise<void> {
  // 실제 이메일 발송 로직 구현
  console.log('이메일 알림 발송:', { recipients, message });
}

// 웹훅 알림 발송
async function sendWebhookNotification(webhookUrl: string, message: any): Promise<void> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(`웹훅 발송 실패: ${response.status} ${response.statusText}`);
    }

  } catch (error) {
    console.error('웹훅 알림 발송 오류:', error);
  }
}

// 백업 크기 계산
function calculateBackupSize(backup: any): bigint {
  if (!backup) return BigInt(0);
  
  try {
    const backupString = JSON.stringify(backup);
    return BigInt(Buffer.byteLength(backupString, 'utf8'));
  } catch {
    return BigInt(0);
  }
} 