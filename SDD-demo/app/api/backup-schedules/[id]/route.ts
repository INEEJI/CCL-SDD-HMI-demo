import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { getUserFromSession } from '@/lib/session';
import { requirePermission, logPermissionAction } from '@/lib/middleware/permissions';
import { BackupSchedule, backupScheduler } from '@/lib/services/backup-scheduler';

interface RouteParams {
  params: {
    id: string;
  };
}

// 특정 백업 스케줄 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.list');

    const scheduleId = parseInt(params.id);
    if (isNaN(scheduleId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 스케줄 ID입니다.' },
        { status: 400 }
      );
    }

    const connection = getConnection();

    // 스케줄 상세 정보 조회
    const query = `
      SELECT 
        bs.*,
        u.username as created_by_username,
        
        -- 최근 실행 이력 (최근 10개)
        COALESCE(
          json_agg(
            json_build_object(
              'execution_id', be.execution_id,
              'status', be.status,
              'started_at', be.started_at,
              'completed_at', be.completed_at,
              'duration_seconds', be.duration_seconds,
              'backup_id', be.backup_id,
              'error_message', be.error_message,
              'execution_type', be.execution_type,
              'retry_count', be.retry_count
            ) ORDER BY be.started_at DESC
          ) FILTER (WHERE be.execution_id IS NOT NULL), 
          '[]'::json
        ) as recent_executions,
        
        -- 실행 통계
        exec_stats.total_executions,
        exec_stats.successful_executions,
        exec_stats.failed_executions,
        exec_stats.avg_duration_seconds,
        exec_stats.success_rate_percentage,
        
        -- 알림 설정
        COALESCE(
          json_agg(
            json_build_object(
              'notification_id', bn.notification_id,
              'notification_type', bn.notification_type,
              'is_enabled', bn.is_enabled,
              'notify_on_success', bn.notify_on_success,
              'notify_on_failure', bn.notify_on_failure,
              'recipient_emails', bn.recipient_emails,
              'webhook_url', bn.webhook_url
            )
          ) FILTER (WHERE bn.notification_id IS NOT NULL),
          '[]'::json
        ) as notifications
        
      FROM backup_schedules bs
      LEFT JOIN users u ON bs.created_by = u.id
      LEFT JOIN LATERAL (
        SELECT * FROM backup_executions 
        WHERE schedule_id = bs.schedule_id 
        ORDER BY started_at DESC 
        LIMIT 10
      ) be ON true
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(*) as total_executions,
          COUNT(*) FILTER (WHERE status = 'completed') as successful_executions,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_executions,
          AVG(duration_seconds) FILTER (WHERE status = 'completed') as avg_duration_seconds,
          CASE 
            WHEN COUNT(*) > 0 
            THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed')::DECIMAL / COUNT(*)) * 100, 2)
            ELSE NULL 
          END as success_rate_percentage
        FROM backup_executions 
        WHERE schedule_id = bs.schedule_id
          AND started_at > CURRENT_TIMESTAMP - INTERVAL '30 days'
      ) exec_stats ON true
      LEFT JOIN backup_notifications bn ON bs.schedule_id = bn.schedule_id
      WHERE bs.schedule_id = $1
      GROUP BY bs.schedule_id, u.username, exec_stats.total_executions, 
               exec_stats.successful_executions, exec_stats.failed_executions,
               exec_stats.avg_duration_seconds, exec_stats.success_rate_percentage
    `;

    const result = await connection.query(query, [scheduleId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '백업 스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const schedule = result.rows[0];

    // 다음 실행 시간 계산
    if (schedule.is_enabled && schedule.next_run_at) {
      const nextRun = new Date(schedule.next_run_at);
      const now = new Date();
      schedule.seconds_until_next_run = Math.max(0, Math.floor((nextRun.getTime() - now.getTime()) / 1000));
    }

    // 권한 확인 로그
    await logPermissionAction(user.id, 'backup.list', 'backup_schedules', scheduleId, request);

    return NextResponse.json({
      success: true,
      data: { schedule }
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

// 백업 스케줄 수정
export async function PUT(request: NextRequest, { params }: RouteParams) {
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

    const body = await request.json();
    
    // 기존 스케줄 확인
    const existingQuery = `SELECT * FROM backup_schedules WHERE schedule_id = $1`;
    const existingResult = await connection.query(existingQuery, [scheduleId]);
    
    if (existingResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: '백업 스케줄을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const existingSchedule = existingResult.rows[0] as BackupSchedule;

    // 업데이트할 필드 추출
    const {
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
      encryption_enabled
    } = body;

    // 크론 표현식 검증 (변경된 경우)
    if (cron_expression && cron_expression !== existingSchedule.cron_expression) {
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
    }

    await connection.query('BEGIN');

    try {
      // 스케줄 업데이트
      const updateQuery = `
        UPDATE backup_schedules 
        SET 
          schedule_name = COALESCE($1, schedule_name),
          schedule_description = COALESCE($2, schedule_description),
          cron_expression = COALESCE($3, cron_expression),
          timezone = COALESCE($4, timezone),
          is_enabled = COALESCE($5, is_enabled),
          backup_type = COALESCE($6, backup_type),
          backup_categories = COALESCE($7, backup_categories),
          max_backup_count = COALESCE($8, max_backup_count),
          retention_days = COALESCE($9, retention_days),
          compression_enabled = COALESCE($10, compression_enabled),
          encryption_enabled = COALESCE($11, encryption_enabled),
          updated_at = CURRENT_TIMESTAMP
        WHERE schedule_id = $12
        RETURNING *
      `;

      const updateResult = await connection.query(updateQuery, [
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
        scheduleId
      ]);

      const updatedSchedule = updateResult.rows[0] as BackupSchedule;

      // 스케줄러 업데이트
      await backupScheduler.updateSchedule(scheduleId);

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'backup.create', 
        'backup_schedules', 
        scheduleId, 
        request,
        { 
          updated_fields: Object.keys(body),
          old_enabled: existingSchedule.is_enabled,
          new_enabled: updatedSchedule.is_enabled
        }
      );

      return NextResponse.json({
        success: true,
        message: '백업 스케줄이 성공적으로 수정되었습니다.',
        data: { schedule: updatedSchedule }
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 스케줄 수정 오류:', error);
    
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
        error: '백업 스케줄 수정에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// 백업 스케줄 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const user = await getUserFromSession(request);
    await requirePermission(user, 'backup.delete');

    const scheduleId = parseInt(params.id);
    if (isNaN(scheduleId)) {
      return NextResponse.json(
        { success: false, error: '잘못된 스케줄 ID입니다.' },
        { status: 400 }
      );
    }

    await connection.query('BEGIN');

    try {
      // 스케줄 존재 확인
      const existingQuery = `SELECT * FROM backup_schedules WHERE schedule_id = $1`;
      const existingResult = await connection.query(existingQuery, [scheduleId]);
      
      if (existingResult.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: '백업 스케줄을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      const schedule = existingResult.rows[0] as BackupSchedule;

      // 실행 중인 백업이 있는지 확인
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
            error: '실행 중인 백업이 있어 스케줄을 삭제할 수 없습니다.' 
          },
          { status: 409 }
        );
      }

      // 스케줄러에서 제거
      backupScheduler.removeSchedule(scheduleId);

      // 관련 알림 설정 삭제
      await connection.query(
        `DELETE FROM backup_notifications WHERE schedule_id = $1`,
        [scheduleId]
      );

      // 백업 메타데이터에서 스케줄 참조 제거
      await connection.query(
        `UPDATE backup_metadata SET schedule_id = NULL WHERE schedule_id = $1`,
        [scheduleId]
      );

      // 백업 스케줄 삭제 (cascade로 실행 이력도 함께 삭제됨)
      await connection.query(
        `DELETE FROM backup_schedules WHERE schedule_id = $1`,
        [scheduleId]
      );

      await connection.query('COMMIT');

      // 권한 확인 로그
      await logPermissionAction(
        user.id, 
        'backup.delete', 
        'backup_schedules', 
        scheduleId, 
        request,
        { schedule_name: schedule.schedule_name }
      );

      return NextResponse.json({
        success: true,
        message: '백업 스케줄이 성공적으로 삭제되었습니다.'
      });

    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }

  } catch (error: any) {
    console.error('백업 스케줄 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '백업 스케줄 삭제에 실패했습니다.',
        details: error.message 
      },
      { status: 500 }
    );
  }
} 