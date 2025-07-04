import { getConnection } from '@/lib/database/connection';
import { BackupApi } from '@/lib/api/backupApi';
import cron from 'node-cron';

// 백업 스케줄 타입 정의
export interface BackupSchedule {
  schedule_id: number;
  schedule_name: string;
  schedule_description: string;
  cron_expression: string;
  timezone: string;
  is_enabled: boolean;
  backup_type: 'full' | 'incremental' | 'differential';
  backup_categories: string[] | null;
  max_backup_count: number;
  retention_days: number;
  compression_enabled: boolean;
  encryption_enabled: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
}

// 백업 실행 타입 정의
export interface BackupExecution {
  execution_id?: number;
  schedule_id: number;
  backup_id?: string;
  execution_type: 'scheduled' | 'manual' | 'retry';
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  settings_count?: number;
  backup_size_bytes?: bigint;
  error_message?: string;
  error_details?: any;
  retry_count: number;
  max_retries: number;
  triggered_by?: number;
  execution_metadata?: any;
}

// 백업 알림 타입 정의
export interface BackupNotification {
  notification_id: number;
  schedule_id: number;
  notification_type: 'email' | 'webhook' | 'slack' | 'teams';
  is_enabled: boolean;
  notify_on_success: boolean;
  notify_on_failure: boolean;
  notify_on_retry: boolean;
  notify_on_schedule_disabled: boolean;
  recipient_emails: string[];
  webhook_url?: string;
  notification_template?: string;
  max_notifications_per_hour: number;
  silence_duration_minutes: number;
}

// 백업 스케줄러 클래스
export class BackupScheduler {
  private static instance: BackupScheduler;
  private scheduledJobs: Map<number, cron.ScheduledTask> = new Map();
  private isRunning: boolean = false;
  private cleanupJob: cron.ScheduledTask | null = null;

  private constructor() {}

  public static getInstance(): BackupScheduler {
    if (!BackupScheduler.instance) {
      BackupScheduler.instance = new BackupScheduler();
    }
    return BackupScheduler.instance;
  }

  // 스케줄러 시작
  public async start(): Promise<void> {
    if (this.isRunning) {
      console.log('백업 스케줄러가 이미 실행 중입니다.');
      return;
    }

    console.log('백업 스케줄러를 시작합니다...');
    
    try {
      // 활성화된 모든 스케줄 로드
      await this.loadAndScheduleJobs();
      
      // 백업 정리 작업 스케줄 (매일 오전 3시)
      this.scheduleCleanupJob();
      
      this.isRunning = true;
      console.log('백업 스케줄러가 성공적으로 시작되었습니다.');
    } catch (error) {
      console.error('백업 스케줄러 시작 오류:', error);
      throw error;
    }
  }

  // 스케줄러 중지
  public async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('백업 스케줄러가 실행 중이 아닙니다.');
      return;
    }

    console.log('백업 스케줄러를 중지합니다...');
    
    // 모든 예약된 작업 중지
    this.scheduledJobs.forEach((job, scheduleId) => {
      job.stop();
      console.log(`스케줄 ${scheduleId} 작업이 중지되었습니다.`);
    });
    this.scheduledJobs.clear();

    // 정리 작업 중지
    if (this.cleanupJob) {
      this.cleanupJob.stop();
      this.cleanupJob = null;
    }

    this.isRunning = false;
    console.log('백업 스케줄러가 중지되었습니다.');
  }

  // 스케줄 작업 로드 및 등록
  private async loadAndScheduleJobs(): Promise<void> {
    const connection = getConnection();
    
    try {
      const query = `
        SELECT * FROM backup_schedules 
        WHERE is_enabled = true 
        ORDER BY schedule_id
      `;
      
      const result = await connection.query(query);
      const schedules = result.rows as BackupSchedule[];

      console.log(`${schedules.length}개의 활성 백업 스케줄을 발견했습니다.`);

      for (const schedule of schedules) {
        await this.scheduleJob(schedule);
      }
    } catch (error) {
      console.error('백업 스케줄 로드 오류:', error);
      throw error;
    }
  }

  // 개별 스케줄 작업 등록
  private async scheduleJob(schedule: BackupSchedule): Promise<void> {
    try {
      // 기존 작업이 있으면 중지
      if (this.scheduledJobs.has(schedule.schedule_id)) {
        this.scheduledJobs.get(schedule.schedule_id)?.stop();
      }

      // 크론 표현식 검증
      if (!cron.validate(schedule.cron_expression)) {
        console.error(`잘못된 크론 표현식: ${schedule.cron_expression} (스케줄 ID: ${schedule.schedule_id})`);
        return;
      }

      // 크론 작업 생성
      const task = cron.schedule(
        schedule.cron_expression,
        async () => {
          await this.executeBackup(schedule);
        },
        {
          scheduled: true,
          timezone: schedule.timezone || 'Asia/Seoul'
        }
      );

      this.scheduledJobs.set(schedule.schedule_id, task);
      console.log(`백업 스케줄 등록됨: ${schedule.schedule_name} (${schedule.cron_expression})`);

    } catch (error) {
      console.error(`스케줄 작업 등록 오류 (ID: ${schedule.schedule_id}):`, error);
    }
  }

  // 백업 실행
  private async executeBackup(schedule: BackupSchedule): Promise<void> {
    const connection = getConnection();
    let execution: BackupExecution | null = null;

    try {
      console.log(`백업 실행 시작: ${schedule.schedule_name}`);

      // 실행 기록 생성
      execution = await this.createExecutionRecord(schedule);

      // 백업 실행
      const backupResult = await this.performBackup(schedule);

      // 실행 완료 처리
      await this.completeExecution(execution, backupResult);

      // 성공 알림 발송
      await this.sendNotification(schedule, execution, 'success');

      console.log(`백업 실행 완료: ${schedule.schedule_name} (백업 ID: ${backupResult.backupId})`);

    } catch (error) {
      console.error(`백업 실행 오류 (${schedule.schedule_name}):`, error);

      if (execution) {
        // 실패 처리
        await this.failExecution(execution, error);

        // 재시도 처리
        if (execution.retry_count < execution.max_retries) {
          console.log(`백업 재시도 예약: ${schedule.schedule_name} (${execution.retry_count + 1}/${execution.max_retries})`);
          setTimeout(() => this.retryBackup(execution!), 5 * 60 * 1000); // 5분 후 재시도
        } else {
          // 실패 알림 발송
          await this.sendNotification(schedule, execution, 'failure');
        }
      }
    }
  }

  // 백업 실행 기록 생성
  private async createExecutionRecord(schedule: BackupSchedule): Promise<BackupExecution> {
    const connection = getConnection();

    const execution: BackupExecution = {
      schedule_id: schedule.schedule_id,
      execution_type: 'scheduled',
      status: 'running',
      started_at: new Date().toISOString(),
      retry_count: 0,
      max_retries: 3,
      execution_metadata: {
        schedule_name: schedule.schedule_name,
        backup_type: schedule.backup_type,
        categories: schedule.backup_categories
      }
    };

    const query = `
      INSERT INTO backup_executions (
        schedule_id, execution_type, status, started_at, 
        retry_count, max_retries, execution_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING execution_id
    `;

    const result = await connection.query(query, [
      execution.schedule_id,
      execution.execution_type,
      execution.status,
      execution.started_at,
      execution.retry_count,
      execution.max_retries,
      JSON.stringify(execution.execution_metadata)
    ]);

    execution.execution_id = result.rows[0].execution_id;
    return execution;
  }

  // 실제 백업 수행
  private async performBackup(schedule: BackupSchedule): Promise<any> {
    try {
      // 카테고리별 백업 또는 전체 백업
      if (schedule.backup_categories && schedule.backup_categories.length > 0) {
        // 특정 카테고리만 백업 (향후 구현)
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

  // 백업 실행 완료 처리
  private async completeExecution(execution: BackupExecution, backupResult: any): Promise<void> {
    const connection = getConnection();

    try {
      const query = `
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

      const completedAt = new Date();
      const duration = Math.floor((completedAt.getTime() - new Date(execution.started_at).getTime()) / 1000);

      await connection.query(query, [
        backupResult.backupId,
        'completed',
        completedAt.toISOString(),
        duration,
        backupResult.backup?.settingsCount || 0,
        this.calculateBackupSize(backupResult.backup),
        execution.execution_id
      ]);

      // 백업 메타데이터 추가
      await this.addBackupMetadata(backupResult.backupId, execution);

    } catch (error) {
      console.error('백업 실행 완료 처리 오류:', error);
      throw error;
    }
  }

  // 백업 실행 실패 처리
  private async failExecution(execution: BackupExecution, error: any): Promise<void> {
    const connection = getConnection();

    try {
      const query = `
        UPDATE backup_executions 
        SET 
          status = $1,
          completed_at = $2,
          error_message = $3,
          error_details = $4,
          retry_count = $5
        WHERE execution_id = $6
      `;

      await connection.query(query, [
        'failed',
        new Date().toISOString(),
        error.message || '알 수 없는 오류',
        JSON.stringify({
          stack: error.stack,
          code: error.code,
          details: error.details
        }),
        execution.retry_count + 1,
        execution.execution_id
      ]);

    } catch (dbError) {
      console.error('백업 실행 실패 처리 오류:', dbError);
    }
  }

  // 백업 재시도
  private async retryBackup(execution: BackupExecution): Promise<void> {
    const connection = getConnection();

    try {
      // 스케줄 정보 조회
      const scheduleQuery = `SELECT * FROM backup_schedules WHERE schedule_id = $1`;
      const scheduleResult = await connection.query(scheduleQuery, [execution.schedule_id]);
      
      if (scheduleResult.rows.length === 0) {
        console.error(`스케줄을 찾을 수 없습니다: ${execution.schedule_id}`);
        return;
      }

      const schedule = scheduleResult.rows[0] as BackupSchedule;

      // 재시도 실행 기록 업데이트
      const updateQuery = `
        UPDATE backup_executions 
        SET 
          execution_type = 'retry',
          status = 'running',
          started_at = $1,
          completed_at = NULL,
          error_message = NULL,
          error_details = NULL
        WHERE execution_id = $2
      `;

      await connection.query(updateQuery, [
        new Date().toISOString(),
        execution.execution_id
      ]);

      // 백업 재실행
      await this.executeBackup(schedule);

    } catch (error) {
      console.error('백업 재시도 오류:', error);
    }
  }

  // 백업 메타데이터 추가
  private async addBackupMetadata(backupId: string, execution: BackupExecution): Promise<void> {
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
        execution.schedule_id,
        ['scheduled', 'auto'],
        'scheduled',
        'normal',
        process.env.SYSTEM_VERSION || '1.0.0',
        '1.0.0'
      ]);

    } catch (error) {
      console.error('백업 메타데이터 추가 오류:', error);
    }
  }

  // 백업 정리 작업 스케줄
  private scheduleCleanupJob(): void {
    this.cleanupJob = cron.schedule('0 3 * * *', async () => {
      await this.performCleanup();
    }, {
      scheduled: true,
      timezone: 'Asia/Seoul'
    });

    console.log('백업 정리 작업이 스케줄되었습니다 (매일 오전 3시)');
  }

  // 백업 정리 수행
  private async performCleanup(): Promise<void> {
    const connection = getConnection();

    try {
      console.log('백업 정리 작업을 시작합니다...');

      // 기본 정책으로 정리 수행
      const cleanupQuery = `SELECT * FROM cleanup_old_backups('기본 정책')`;
      const result = await connection.query(cleanupQuery);
      
      if (result.rows.length > 0) {
        const cleanup = result.rows[0];
        console.log(`백업 정리 완료: ${cleanup.cleanup_summary}`);
      }

    } catch (error) {
      console.error('백업 정리 오류:', error);
    }
  }

  // 알림 발송
  private async sendNotification(
    schedule: BackupSchedule, 
    execution: BackupExecution, 
    type: 'success' | 'failure' | 'retry'
  ): Promise<void> {
    const connection = getConnection();

    try {
      // 알림 설정 조회
      const notificationQuery = `
        SELECT * FROM backup_notifications 
        WHERE schedule_id = $1 AND is_enabled = true
      `;
      
      const result = await connection.query(notificationQuery, [schedule.schedule_id]);
      const notifications = result.rows as BackupNotification[];

      for (const notification of notifications) {
        const shouldSend = this.shouldSendNotification(notification, type);
        
        if (shouldSend) {
          await this.sendNotificationMessage(notification, schedule, execution, type);
        }
      }

    } catch (error) {
      console.error('알림 발송 오류:', error);
    }
  }

  // 알림 발송 여부 확인
  private shouldSendNotification(notification: BackupNotification, type: 'success' | 'failure' | 'retry'): boolean {
    switch (type) {
      case 'success':
        return notification.notify_on_success;
      case 'failure':
        return notification.notify_on_failure;
      case 'retry':
        return notification.notify_on_retry;
      default:
        return false;
    }
  }

  // 실제 알림 메시지 발송
  private async sendNotificationMessage(
    notification: BackupNotification,
    schedule: BackupSchedule,
    execution: BackupExecution,
    type: 'success' | 'failure' | 'retry'
  ): Promise<void> {
    try {
      const message = this.buildNotificationMessage(schedule, execution, type);

      switch (notification.notification_type) {
        case 'email':
          await this.sendEmailNotification(notification.recipient_emails, message);
          break;
        case 'webhook':
          if (notification.webhook_url) {
            await this.sendWebhookNotification(notification.webhook_url, message);
          }
          break;
        // 추가 알림 타입 구현 가능
      }

    } catch (error) {
      console.error('알림 메시지 발송 오류:', error);
    }
  }

  // 알림 메시지 구성
  private buildNotificationMessage(
    schedule: BackupSchedule,
    execution: BackupExecution,
    type: 'success' | 'failure' | 'retry'
  ): any {
    const baseMessage = {
      schedule_name: schedule.schedule_name,
      execution_id: execution.execution_id,
      started_at: execution.started_at,
      status: execution.status,
      type: type
    };

    switch (type) {
      case 'success':
        return {
          ...baseMessage,
          message: `백업이 성공적으로 완료되었습니다: ${schedule.schedule_name}`,
          backup_id: execution.backup_id,
          duration_seconds: execution.duration_seconds,
          settings_count: execution.settings_count
        };
      case 'failure':
        return {
          ...baseMessage,
          message: `백업이 실패했습니다: ${schedule.schedule_name}`,
          error_message: execution.error_message,
          retry_count: execution.retry_count
        };
      case 'retry':
        return {
          ...baseMessage,
          message: `백업을 재시도합니다: ${schedule.schedule_name}`,
          retry_count: execution.retry_count
        };
    }
  }

  // 이메일 알림 발송
  private async sendEmailNotification(recipients: string[], message: any): Promise<void> {
    // 실제 이메일 발송 로직 구현
    console.log('이메일 알림 발송:', { recipients, message });
  }

  // 웹훅 알림 발송
  private async sendWebhookNotification(webhookUrl: string, message: any): Promise<void> {
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
  private calculateBackupSize(backup: any): bigint {
    if (!backup) return BigInt(0);
    
    try {
      const backupString = JSON.stringify(backup);
      return BigInt(Buffer.byteLength(backupString, 'utf8'));
    } catch {
      return BigInt(0);
    }
  }

  // 스케줄 추가/업데이트
  public async updateSchedule(scheduleId: number): Promise<void> {
    const connection = getConnection();

    try {
      const query = `
        SELECT * FROM backup_schedules 
        WHERE schedule_id = $1 AND is_enabled = true
      `;
      
      const result = await connection.query(query, [scheduleId]);
      
      if (result.rows.length > 0) {
        const schedule = result.rows[0] as BackupSchedule;
        await this.scheduleJob(schedule);
        console.log(`스케줄 업데이트됨: ${schedule.schedule_name}`);
      } else {
        // 스케줄이 비활성화되었거나 삭제된 경우
        if (this.scheduledJobs.has(scheduleId)) {
          this.scheduledJobs.get(scheduleId)?.stop();
          this.scheduledJobs.delete(scheduleId);
          console.log(`스케줄 제거됨: ID ${scheduleId}`);
        }
      }

    } catch (error) {
      console.error('스케줄 업데이트 오류:', error);
    }
  }

  // 스케줄 제거
  public removeSchedule(scheduleId: number): void {
    if (this.scheduledJobs.has(scheduleId)) {
      this.scheduledJobs.get(scheduleId)?.stop();
      this.scheduledJobs.delete(scheduleId);
      console.log(`스케줄 제거됨: ID ${scheduleId}`);
    }
  }

  // 스케줄러 상태 확인
  public getStatus(): any {
    return {
      isRunning: this.isRunning,
      activeSchedules: this.scheduledJobs.size,
      scheduleIds: Array.from(this.scheduledJobs.keys())
    };
  }
}

// 싱글톤 인스턴스 내보내기
export const backupScheduler = BackupScheduler.getInstance(); 