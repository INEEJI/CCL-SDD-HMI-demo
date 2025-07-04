import { NextRequest } from 'next/server';
import { pool } from '../database/connection';
import { getUserFromSession } from '../session';

// 감사 로그 타입 정의
export interface AuditLogEntry {
  userId?: number;
  username?: string;
  userRole?: string;
  sessionId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  resourceName?: string;
  oldValues?: any;
  newValues?: any;
  changedFields?: string[];
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestUrl?: string;
  category?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  additionalData?: any;
  executionTimeMs?: number;
  status?: 'success' | 'failed' | 'partial';
  errorMessage?: string;
}

// 설정 변경 이력 타입 정의
export interface SettingsChangeEntry {
  settingCategory: string;
  settingKey: string;
  settingPath?: string;
  oldValue?: any;
  newValue?: any;
  changeType: 'create' | 'update' | 'delete' | 'reset';
  impactLevel?: 'low' | 'medium' | 'high' | 'critical';
  requiresRestart?: boolean;
  affectsComponents?: string[];
  validationStatus?: 'valid' | 'invalid' | 'warning';
  validationMessage?: string;
}

// 감사 로그 서비스 클래스
export class AuditLogger {
  private static instance: AuditLogger;
  
  private constructor() {}
  
  public static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }
  
  // 메인 감사 로그 기록
  public async logAuditEntry(entry: AuditLogEntry): Promise<number | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT create_audit_log(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) as audit_log_id`,
        [
          entry.userId || null,
          entry.username || null,
          entry.userRole || null,
          entry.sessionId || null,
          entry.action,
          entry.resourceType,
          entry.resourceId || null,
          entry.resourceName || null,
          entry.oldValues ? JSON.stringify(entry.oldValues) : null,
          entry.newValues ? JSON.stringify(entry.newValues) : null,
          entry.changedFields || null,
          entry.ipAddress || null,
          entry.userAgent || null,
          entry.requestMethod || null,
          entry.requestUrl || null,
          entry.category || 'system',
          entry.severity || 'info',
          entry.additionalData ? JSON.stringify(entry.additionalData) : null
        ]
      );
      
      // 실행 시간 및 상태 업데이트
      if (entry.executionTimeMs !== undefined || entry.status || entry.errorMessage) {
        await client.query(
          `UPDATE audit_logs 
           SET execution_time_ms = $1, status = $2, error_message = $3 
           WHERE log_id = $4`,
          [
            entry.executionTimeMs || null,
            entry.status || 'success',
            entry.errorMessage || null,
            result.rows[0].audit_log_id
          ]
        );
      }
      
      return result.rows[0].audit_log_id;
    } catch (error) {
      console.error('감사 로그 기록 실패:', error);
      return null;
    } finally {
      client.release();
    }
  }
  
  // 설정 변경 이력 기록
  public async logSettingsChange(
    auditLogId: number,
    change: SettingsChangeEntry
  ): Promise<number | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT log_settings_change(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
        ) as change_id`,
        [
          auditLogId,
          change.settingCategory,
          change.settingKey,
          change.settingPath || null,
          change.oldValue !== undefined ? String(change.oldValue) : null,
          change.newValue !== undefined ? String(change.newValue) : null,
          this.getValueType(change.oldValue),
          this.getValueType(change.newValue),
          change.changeType,
          change.impactLevel || 'low',
          change.requiresRestart || false,
          change.affectsComponents || null
        ]
      );
      
      // 검증 상태 업데이트
      if (change.validationStatus || change.validationMessage) {
        await client.query(
          `UPDATE settings_change_history 
           SET validation_status = $1, validation_message = $2 
           WHERE change_id = $3`,
          [
            change.validationStatus || 'valid',
            change.validationMessage || null,
            result.rows[0].change_id
          ]
        );
      }
      
      return result.rows[0].change_id;
    } catch (error) {
      console.error('설정 변경 이력 기록 실패:', error);
      return null;
    } finally {
      client.release();
    }
  }
  
  // 보안 이벤트 로그 기록
  public async logSecurityEvent(
    eventType: string,
    threatLevel: 'low' | 'medium' | 'high' | 'critical',
    eventDescription: string,
    options: {
      userId?: number;
      username?: string;
      attemptedUsername?: string;
      sourceIp?: string;
      userAgent?: string;
      authenticationMethod?: string;
      sessionId?: string;
      requestedResource?: string;
      requiredPermission?: string;
      actionTaken?: string;
    } = {}
  ): Promise<number | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `SELECT log_security_event(
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        ) as security_event_id`,
        [
          eventType,
          threatLevel,
          eventDescription,
          options.userId || null,
          options.username || null,
          options.attemptedUsername || null,
          options.sourceIp || null,
          options.userAgent || null,
          options.authenticationMethod || null,
          options.sessionId || null,
          options.requestedResource || null,
          options.requiredPermission || null,
          options.actionTaken || null
        ]
      );
      
      return result.rows[0].security_event_id;
    } catch (error) {
      console.error('보안 이벤트 로그 기록 실패:', error);
      return null;
    } finally {
      client.release();
    }
  }
  
  // 사용자 활동 로그 기록
  public async logUserActivity(
    auditLogId: number,
    activityType: string,
    activityDescription: string,
    options: {
      userId?: number;
      username?: string;
      pageUrl?: string;
      referrerUrl?: string;
      sessionId?: string;
      sessionDuration?: number;
      isSessionStart?: boolean;
      isSessionEnd?: boolean;
      ipAddress?: string;
      userAgent?: string;
      deviceType?: string;
      browserName?: string;
      browserVersion?: string;
      osName?: string;
      osVersion?: string;
      pageLoadTime?: number;
      responseTime?: number;
    } = {}
  ): Promise<number | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO user_activity_logs (
          audit_log_id, user_id, username, activity_type, activity_description,
          page_url, referrer_url, session_id, session_duration_seconds,
          is_session_start, is_session_end, ip_address, user_agent,
          device_type, browser_name, browser_version, os_name, os_version,
          page_load_time_ms, response_time_ms
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
        ) RETURNING activity_id`,
        [
          auditLogId,
          options.userId || null,
          options.username || null,
          activityType,
          activityDescription,
          options.pageUrl || null,
          options.referrerUrl || null,
          options.sessionId || null,
          options.sessionDuration || null,
          options.isSessionStart || false,
          options.isSessionEnd || false,
          options.ipAddress || null,
          options.userAgent || null,
          options.deviceType || null,
          options.browserName || null,
          options.browserVersion || null,
          options.osName || null,
          options.osVersion || null,
          options.pageLoadTime || null,
          options.responseTime || null
        ]
      );
      
      return result.rows[0].activity_id;
    } catch (error) {
      console.error('사용자 활동 로그 기록 실패:', error);
      return null;
    } finally {
      client.release();
    }
  }
  
  // 시스템 이벤트 로그 기록
  public async logSystemEvent(
    auditLogId: number,
    eventType: string,
    eventName: string,
    eventDescription: string,
    options: {
      component?: string;
      serviceName?: string;
      processId?: number;
      threadId?: number;
      status?: 'started' | 'completed' | 'failed' | 'warning';
      errorCode?: string;
      errorMessage?: string;
      stackTrace?: string;
      cpuUsage?: number;
      memoryUsage?: number;
      diskUsage?: number;
      executionTime?: number;
      environment?: string;
      version?: string;
      buildNumber?: string;
    } = {}
  ): Promise<number | null> {
    const client = await pool.connect();
    try {
      const result = await client.query(
        `INSERT INTO system_event_logs (
          audit_log_id, event_type, event_name, event_description,
          component, service_name, process_id, thread_id, status,
          error_code, error_message, stack_trace, cpu_usage_percent,
          memory_usage_mb, disk_usage_mb, execution_time_ms,
          environment, version, build_number
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
        ) RETURNING event_id`,
        [
          auditLogId,
          eventType,
          eventName,
          eventDescription,
          options.component || null,
          options.serviceName || null,
          options.processId || null,
          options.threadId || null,
          options.status || 'completed',
          options.errorCode || null,
          options.errorMessage || null,
          options.stackTrace || null,
          options.cpuUsage || null,
          options.memoryUsage || null,
          options.diskUsage || null,
          options.executionTime || null,
          options.environment || 'production',
          options.version || null,
          options.buildNumber || null
        ]
      );
      
      return result.rows[0].event_id;
    } catch (error) {
      console.error('시스템 이벤트 로그 기록 실패:', error);
      return null;
    } finally {
      client.release();
    }
  }
  
  // 값 타입 추론
  private getValueType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return 'string';
    if (typeof value === 'number') return 'number';
    if (typeof value === 'boolean') return 'boolean';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }
}

// 편의 함수들
export const auditLogger = AuditLogger.getInstance();

// 요청 정보 추출 헬퍼
export function extractRequestInfo(request: NextRequest) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ipAddress = forwardedFor?.split(',')[0] || realIp || request.ip;
  
  return {
    ipAddress,
    userAgent: request.headers.get('user-agent') || undefined,
    requestMethod: request.method,
    requestUrl: request.url,
    requestHeaders: Object.fromEntries(request.headers.entries())
  };
}

// 사용자 정보 추출 헬퍼
export async function extractUserInfo(request: NextRequest) {
  try {
    const user = await getUserFromSession(request);
    return {
      userId: user?.id,
      username: user?.username,
      userRole: user?.role,
      sessionId: request.cookies.get('session')?.value
    };
  } catch (error) {
    return {};
  }
}

// 설정 변경 추적 미들웨어
export async function trackSettingsChange(
  request: NextRequest,
  category: string,
  key: string,
  oldValue: any,
  newValue: any,
  options: {
    changeType?: 'create' | 'update' | 'delete' | 'reset';
    impactLevel?: 'low' | 'medium' | 'high' | 'critical';
    requiresRestart?: boolean;
    affectsComponents?: string[];
    path?: string;
  } = {}
): Promise<void> {
  const startTime = Date.now();
  
  try {
    const requestInfo = extractRequestInfo(request);
    const userInfo = await extractUserInfo(request);
    
    // 변경된 필드 추출
    const changedFields = [];
    if (oldValue !== newValue) {
      changedFields.push(key);
    }
    
    // 감사 로그 생성
    const auditLogId = await auditLogger.logAuditEntry({
      ...userInfo,
      ...requestInfo,
      action: options.changeType || 'update',
      resourceType: 'settings',
      resourceId: `${category}.${key}`,
      resourceName: `${category} 설정`,
      oldValues: oldValue !== undefined ? { [key]: oldValue } : undefined,
      newValues: newValue !== undefined ? { [key]: newValue } : undefined,
      changedFields,
      category: 'system',
      severity: options.impactLevel === 'critical' ? 'critical' : 
                options.impactLevel === 'high' ? 'warning' : 'info',
      executionTimeMs: Date.now() - startTime,
      status: 'success'
    });
    
    // 설정 변경 이력 기록
    if (auditLogId) {
      await auditLogger.logSettingsChange(auditLogId, {
        settingCategory: category,
        settingKey: key,
        settingPath: options.path,
        oldValue,
        newValue,
        changeType: options.changeType || 'update',
        impactLevel: options.impactLevel || 'low',
        requiresRestart: options.requiresRestart || false,
        affectsComponents: options.affectsComponents
      });
    }
  } catch (error) {
    console.error('설정 변경 추적 실패:', error);
    
    // 실패한 경우에도 로그 기록 시도
    try {
      const requestInfo = extractRequestInfo(request);
      const userInfo = await extractUserInfo(request);
      
      await auditLogger.logAuditEntry({
        ...userInfo,
        ...requestInfo,
        action: options.changeType || 'update',
        resourceType: 'settings',
        resourceId: `${category}.${key}`,
        resourceName: `${category} 설정`,
        category: 'system',
        severity: 'error',
        executionTimeMs: Date.now() - startTime,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    } catch (logError) {
      console.error('감사 로그 기록도 실패:', logError);
    }
  }
}

// 로그인 추적
export async function trackLogin(
  request: NextRequest,
  username: string,
  success: boolean,
  userId?: number,
  errorMessage?: string
): Promise<void> {
  const requestInfo = extractRequestInfo(request);
  
  if (success) {
    // 성공한 로그인
    const auditLogId = await auditLogger.logAuditEntry({
      userId,
      username,
      ...requestInfo,
      action: 'login',
      resourceType: 'authentication',
      resourceName: username,
      category: 'security',
      severity: 'info',
      status: 'success'
    });
    
    if (auditLogId) {
      await auditLogger.logUserActivity(auditLogId, 'login', '사용자 로그인', {
        userId,
        username,
        sessionId: request.cookies.get('session')?.value,
        isSessionStart: true,
        ...requestInfo
      });
    }
  } else {
    // 실패한 로그인
    await auditLogger.logSecurityEvent(
      'login_failed',
      'medium',
      `로그인 실패: ${username}`,
      {
        attemptedUsername: username,
        sourceIp: requestInfo.ipAddress,
        userAgent: requestInfo.userAgent,
        authenticationMethod: 'password',
        actionTaken: 'logged'
      }
    );
  }
}

// 로그아웃 추적
export async function trackLogout(
  request: NextRequest,
  userId: number,
  username: string,
  sessionDuration?: number
): Promise<void> {
  const requestInfo = extractRequestInfo(request);
  
  const auditLogId = await auditLogger.logAuditEntry({
    userId,
    username,
    ...requestInfo,
    action: 'logout',
    resourceType: 'authentication',
    resourceName: username,
    category: 'security',
    severity: 'info',
    status: 'success'
  });
  
  if (auditLogId) {
    await auditLogger.logUserActivity(auditLogId, 'logout', '사용자 로그아웃', {
      userId,
      username,
      sessionId: request.cookies.get('session')?.value,
      sessionDuration,
      isSessionEnd: true,
      ...requestInfo
    });
  }
}

// 권한 거부 추적
export async function trackPermissionDenied(
  request: NextRequest,
  requiredPermission: string,
  requestedResource: string,
  userId?: number,
  username?: string
): Promise<void> {
  const requestInfo = extractRequestInfo(request);
  
  await auditLogger.logSecurityEvent(
    'permission_denied',
    'high',
    `권한 거부: ${requiredPermission} 권한 필요`,
    {
      userId,
      username,
      sourceIp: requestInfo.ipAddress,
      userAgent: requestInfo.userAgent,
      requestedResource,
      requiredPermission,
      actionTaken: 'blocked'
    }
  );
}

// 백업 관련 추적
export async function trackBackupOperation(
  request: NextRequest,
  operation: 'create' | 'restore' | 'delete',
  backupId: string,
  success: boolean,
  errorMessage?: string
): Promise<void> {
  const requestInfo = extractRequestInfo(request);
  const userInfo = await extractUserInfo(request);
  
  await auditLogger.logAuditEntry({
    ...userInfo,
    ...requestInfo,
    action: operation,
    resourceType: 'backups',
    resourceId: backupId,
    resourceName: `백업 ${operation}`,
    category: 'backup',
    severity: success ? 'info' : 'error',
    status: success ? 'success' : 'failed',
    errorMessage
  });
}

// 페이지 뷰 추적
export async function trackPageView(
  request: NextRequest,
  pageUrl: string,
  referrerUrl?: string,
  pageLoadTime?: number
): Promise<void> {
  const requestInfo = extractRequestInfo(request);
  const userInfo = await extractUserInfo(request);
  
  const auditLogId = await auditLogger.logAuditEntry({
    ...userInfo,
    ...requestInfo,
    action: 'page_view',
    resourceType: 'pages',
    resourceName: pageUrl,
    category: 'user_activity',
    severity: 'info',
    status: 'success'
  });
  
  if (auditLogId) {
    await auditLogger.logUserActivity(auditLogId, 'page_view', '페이지 조회', {
      ...userInfo,
      pageUrl,
      referrerUrl,
      pageLoadTime,
      ...requestInfo
    });
  }
}