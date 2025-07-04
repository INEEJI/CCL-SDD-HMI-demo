import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requirePermission } from '@/lib/middleware/permissions';

// 감사 로그 조회 API
export async function GET(request: NextRequest) {
  try {
    // 권한 확인
    const permissionCheck = await requirePermission('system.auditLogs')(request);
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({ error: permissionCheck.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    
    // 쿼리 파라미터 추출
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = (page - 1) * limit;
    
    // 필터링 파라미터
    const userId = searchParams.get('userId');
    const username = searchParams.get('username');
    const action = searchParams.get('action');
    const resourceType = searchParams.get('resourceType');
    const category = searchParams.get('category');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const ipAddress = searchParams.get('ipAddress');
    const search = searchParams.get('search');
    
    // 정렬 옵션
    const sortBy = searchParams.get('sortBy') || 'timestamp';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    
    // 통계 포함 여부
    const includeStats = searchParams.get('includeStats') === 'true';
    
    const client = await pool.connect();
    
    try {
      // WHERE 조건 구성
      const conditions = [];
      const params = [];
      let paramIndex = 1;
      
      if (userId) {
        conditions.push(`al.user_id = $${paramIndex}`);
        params.push(parseInt(userId));
        paramIndex++;
      }
      
      if (username) {
        conditions.push(`al.username ILIKE $${paramIndex}`);
        params.push(`%${username}%`);
        paramIndex++;
      }
      
      if (action) {
        conditions.push(`al.action = $${paramIndex}`);
        params.push(action);
        paramIndex++;
      }
      
      if (resourceType) {
        conditions.push(`al.resource_type = $${paramIndex}`);
        params.push(resourceType);
        paramIndex++;
      }
      
      if (category) {
        conditions.push(`al.category = $${paramIndex}`);
        params.push(category);
        paramIndex++;
      }
      
      if (severity) {
        conditions.push(`al.severity = $${paramIndex}`);
        params.push(severity);
        paramIndex++;
      }
      
      if (status) {
        conditions.push(`al.status = $${paramIndex}`);
        params.push(status);
        paramIndex++;
      }
      
      if (startDate) {
        conditions.push(`al.timestamp >= $${paramIndex}`);
        params.push(new Date(startDate));
        paramIndex++;
      }
      
      if (endDate) {
        conditions.push(`al.timestamp <= $${paramIndex}`);
        params.push(new Date(endDate));
        paramIndex++;
      }
      
      if (ipAddress) {
        conditions.push(`al.ip_address = $${paramIndex}`);
        params.push(ipAddress);
        paramIndex++;
      }
      
      if (search) {
        conditions.push(`(
          al.username ILIKE $${paramIndex} OR
          al.resource_name ILIKE $${paramIndex} OR
          al.error_message ILIKE $${paramIndex} OR
          al.additional_data::text ILIKE $${paramIndex}
        )`);
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // 정렬 검증
      const allowedSortFields = ['timestamp', 'username', 'action', 'resource_type', 'category', 'severity', 'status'];
      const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'timestamp';
      const order = sortOrder.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
      
      // 메인 쿼리 - 감사 로그 조회
      const auditLogsQuery = `
        SELECT 
          al.log_id,
          al.timestamp,
          al.user_id,
          al.username,
          al.user_role,
          al.session_id,
          al.action,
          al.resource_type,
          al.resource_id,
          al.resource_name,
          al.old_values,
          al.new_values,
          al.changed_fields,
          al.ip_address,
          al.user_agent,
          al.request_method,
          al.request_url,
          al.status,
          al.error_message,
          al.execution_time_ms,
          al.category,
          al.severity,
          al.tags,
          al.additional_data,
          
          -- 관련 설정 변경 정보
          sch.change_id,
          sch.setting_category,
          sch.setting_key,
          sch.setting_path,
          sch.old_value as setting_old_value,
          sch.new_value as setting_new_value,
          sch.change_type,
          sch.impact_level,
          sch.requires_restart,
          sch.affects_components,
          sch.validation_status,
          sch.validation_message,
          
          -- 관련 보안 이벤트 정보
          sel.security_event_id,
          sel.event_type as security_event_type,
          sel.threat_level,
          sel.attempted_username,
          sel.authentication_method,
          sel.requested_resource,
          sel.required_permission,
          sel.action_taken,
          
          -- 관련 사용자 활동 정보
          ual.activity_id,
          ual.activity_type,
          ual.page_url,
          ual.device_type,
          ual.browser_name,
          ual.session_duration_seconds
          
        FROM audit_logs al
        LEFT JOIN settings_change_history sch ON al.log_id = sch.audit_log_id
        LEFT JOIN security_event_logs sel ON al.log_id = sel.audit_log_id
        LEFT JOIN user_activity_logs ual ON al.log_id = ual.audit_log_id
        ${whereClause}
        ORDER BY al.${sortField} ${order}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;
      
      params.push(limit, offset);
      
      const auditLogsResult = await client.query(auditLogsQuery, params);
      
      // 총 개수 조회
      const countQuery = `
        SELECT COUNT(DISTINCT al.log_id) as total
        FROM audit_logs al
        LEFT JOIN settings_change_history sch ON al.log_id = sch.audit_log_id
        LEFT JOIN security_event_logs sel ON al.log_id = sel.audit_log_id
        LEFT JOIN user_activity_logs ual ON al.log_id = ual.audit_log_id
        ${whereClause}
      `;
      
      const countResult = await client.query(countQuery, params.slice(0, -2));
      const total = parseInt(countResult.rows[0].total);
      
      // 통계 정보 조회 (옵션)
      let statistics = null;
      if (includeStats) {
        const statsQuery = `
          SELECT 
            COUNT(*) as total_logs,
            COUNT(DISTINCT user_id) as unique_users,
            COUNT(DISTINCT DATE(timestamp)) as active_days,
            COUNT(*) FILTER (WHERE action = 'create') as create_actions,
            COUNT(*) FILTER (WHERE action = 'update') as update_actions,
            COUNT(*) FILTER (WHERE action = 'delete') as delete_actions,
            COUNT(*) FILTER (WHERE action = 'login') as login_actions,
            COUNT(*) FILTER (WHERE action = 'logout') as logout_actions,
            COUNT(*) FILTER (WHERE resource_type = 'settings') as settings_changes,
            COUNT(*) FILTER (WHERE resource_type = 'users') as user_changes,
            COUNT(*) FILTER (WHERE resource_type = 'backups') as backup_actions,
            COUNT(*) FILTER (WHERE resource_type = 'permissions') as permission_changes,
            COUNT(*) FILTER (WHERE severity = 'info') as info_logs,
            COUNT(*) FILTER (WHERE severity = 'warning') as warning_logs,
            COUNT(*) FILTER (WHERE severity = 'error') as error_logs,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical_logs,
            COUNT(*) FILTER (WHERE status = 'success') as successful_actions,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_actions,
            AVG(execution_time_ms) as avg_execution_time_ms,
            MAX(execution_time_ms) as max_execution_time_ms,
            MAX(timestamp) as last_activity
          FROM audit_logs al
          ${whereClause}
        `;
        
        const statsResult = await client.query(statsQuery, params.slice(0, -2));
        statistics = statsResult.rows[0];
      }
      
      // 응답 데이터 구성
      const auditLogs = auditLogsResult.rows.map((row: any) => ({
        logId: row.log_id,
        timestamp: row.timestamp,
        user: {
          id: row.user_id,
          username: row.username,
          role: row.user_role
        },
        sessionId: row.session_id,
        action: row.action,
        resource: {
          type: row.resource_type,
          id: row.resource_id,
          name: row.resource_name
        },
        changes: {
          oldValues: row.old_values,
          newValues: row.new_values,
          changedFields: row.changed_fields
        },
        request: {
          ipAddress: row.ip_address,
          userAgent: row.user_agent,
          method: row.request_method,
          url: row.request_url
        },
        result: {
          status: row.status,
          errorMessage: row.error_message,
          executionTimeMs: row.execution_time_ms
        },
        metadata: {
          category: row.category,
          severity: row.severity,
          tags: row.tags,
          additionalData: row.additional_data
        },
        
        // 관련 정보 (있는 경우에만)
        ...(row.change_id && {
          settingsChange: {
            changeId: row.change_id,
            category: row.setting_category,
            key: row.setting_key,
            path: row.setting_path,
            oldValue: row.setting_old_value,
            newValue: row.setting_new_value,
            changeType: row.change_type,
            impactLevel: row.impact_level,
            requiresRestart: row.requires_restart,
            affectsComponents: row.affects_components,
            validationStatus: row.validation_status,
            validationMessage: row.validation_message
          }
        }),
        
        ...(row.security_event_id && {
          securityEvent: {
            eventId: row.security_event_id,
            eventType: row.security_event_type,
            threatLevel: row.threat_level,
            attemptedUsername: row.attempted_username,
            authenticationMethod: row.authentication_method,
            requestedResource: row.requested_resource,
            requiredPermission: row.required_permission,
            actionTaken: row.action_taken
          }
        }),
        
        ...(row.activity_id && {
          userActivity: {
            activityId: row.activity_id,
            activityType: row.activity_type,
            pageUrl: row.page_url,
            deviceType: row.device_type,
            browserName: row.browser_name,
            sessionDuration: row.session_duration_seconds
          }
        })
      }));
      
      return NextResponse.json({
        success: true,
        data: auditLogs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        },
        filters: {
          userId,
          username,
          action,
          resourceType,
          category,
          severity,
          status,
          startDate,
          endDate,
          ipAddress,
          search
        },
        sorting: {
          sortBy: sortField,
          sortOrder: order
        },
        ...(statistics && { statistics })
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('감사 로그 조회 실패:', error);
    return NextResponse.json(
      { error: '감사 로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// 감사 로그 정리 API
export async function DELETE(request: NextRequest) {
  try {
    // 권한 확인 (시스템 관리자만)
    const permissionCheck = await requirePermission('system.maintenance')(request);
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({ error: permissionCheck.error }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const retentionDays = parseInt(searchParams.get('retentionDays') || '365');
    
    // 보존 기간 검증 (최소 30일)
    if (retentionDays < 30) {
      return NextResponse.json(
        { error: '보존 기간은 최소 30일 이상이어야 합니다.' },
        { status: 400 }
      );
    }
    
    const client = await pool.connect();
    
    try {
      // 감사 로그 정리 함수 호출
      const result = await client.query(
        'SELECT * FROM cleanup_audit_logs($1)',
        [retentionDays]
      );
      
      const cleanupResult = result.rows[0];
      
      return NextResponse.json({
        success: true,
        message: '감사 로그 정리가 완료되었습니다.',
        result: {
          retentionDays,
          deletedCounts: {
            auditLogs: cleanupResult.deleted_audit_logs,
            settingsChanges: cleanupResult.deleted_settings_changes,
            userActivities: cleanupResult.deleted_user_activities,
            systemEvents: cleanupResult.deleted_system_events,
            securityEvents: cleanupResult.deleted_security_events
          },
          summary: cleanupResult.cleanup_summary
        }
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('감사 로그 정리 실패:', error);
    return NextResponse.json(
      { error: '감사 로그 정리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 