import { NextRequest } from 'next/server';
import { getConnection } from '@/lib/database/connection';

// 권한 타입 정의
export interface Permission {
  permission_name: string;
  permission_description: string;
  resource_type: string;
  resource_category: string | null;
  action_type: string;
  source: 'role' | 'override';
}

// 사용자 정보 타입
export interface AuthenticatedUser {
  id: number;
  username: string;
  role: string;
  email?: string;
  full_name?: string;
}

// 권한 검증 결과 타입
export interface PermissionCheckResult {
  hasPermission: boolean;
  user: AuthenticatedUser | null;
  error?: string;
}

// 권한 에러 클래스
export class PermissionError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
    public code: string = 'PERMISSION_DENIED'
  ) {
    super(message);
    this.name = 'PermissionError';
  }
}

// 세션에서 사용자 정보 추출
async function getUserFromSession(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const connection = getConnection();
    
    // 쿠키에서 세션 ID 추출
    const sessionCookie = request.cookies.get('ccl_sdd_session');
    if (!sessionCookie) {
      return null;
    }

    const sessionId = sessionCookie.value;
    
    // 세션 정보 조회
    const sessionQuery = `
      SELECT sess FROM sessions 
      WHERE sid = $1 AND expire > NOW()
    `;
    
    const sessionResult = await connection.query(sessionQuery, [sessionId]);
    
    if (sessionResult.rows.length === 0) {
      return null;
    }

    const sessionData = sessionResult.rows[0].sess;
    const userId = sessionData.userId;

    if (!userId) {
      return null;
    }

    // 사용자 정보 조회
    const userQuery = `
      SELECT id, username, role, email, full_name 
      FROM users 
      WHERE id = $1 AND is_active = true
    `;
    
    const userResult = await connection.query(userQuery, [userId]);
    
    if (userResult.rows.length === 0) {
      return null;
    }

    return userResult.rows[0] as AuthenticatedUser;
  } catch (error) {
    console.error('사용자 세션 조회 오류:', error);
    return null;
  }
}

// 사용자 권한 확인
export async function checkUserPermission(
  userId: number, 
  permissionName: string
): Promise<boolean> {
  try {
    const connection = getConnection();
    
    const query = `SELECT check_user_permission($1, $2) as has_permission`;
    const result = await connection.query(query, [userId, permissionName]);
    
    return result.rows[0]?.has_permission || false;
  } catch (error) {
    console.error('권한 확인 오류:', error);
    return false;
  }
}

// 사용자의 모든 권한 조회
export async function getUserPermissions(userId: number): Promise<Permission[]> {
  try {
    const connection = getConnection();
    
    const query = `SELECT * FROM get_user_permissions($1)`;
    const result = await connection.query(query, [userId]);
    
    return result.rows as Permission[];
  } catch (error) {
    console.error('사용자 권한 조회 오류:', error);
    return [];
  }
}

// 권한 기반 미들웨어 팩토리
export function requirePermission(permissionName: string) {
  return async (request: NextRequest): Promise<PermissionCheckResult> => {
    try {
      // 1. 사용자 인증 확인
      const user = await getUserFromSession(request);
      if (!user) {
        return {
          hasPermission: false,
          user: null,
          error: '인증이 필요합니다.'
        };
      }

      // 2. 권한 확인
      const hasPermission = await checkUserPermission(user.id, permissionName);
      
      if (!hasPermission) {
        return {
          hasPermission: false,
          user,
          error: `'${permissionName}' 권한이 필요합니다.`
        };
      }

      return {
        hasPermission: true,
        user
      };
    } catch (error) {
      console.error('권한 검증 오류:', error);
      return {
        hasPermission: false,
        user: null,
        error: '권한 검증 중 오류가 발생했습니다.'
      };
    }
  };
}

// 여러 권한 중 하나라도 있으면 허용하는 미들웨어
export function requireAnyPermission(permissionNames: string[]) {
  return async (request: NextRequest): Promise<PermissionCheckResult> => {
    try {
      const user = await getUserFromSession(request);
      if (!user) {
        return {
          hasPermission: false,
          user: null,
          error: '인증이 필요합니다.'
        };
      }

      // 권한 중 하나라도 있는지 확인
      for (const permissionName of permissionNames) {
        const hasPermission = await checkUserPermission(user.id, permissionName);
        if (hasPermission) {
          return {
            hasPermission: true,
            user
          };
        }
      }

      return {
        hasPermission: false,
        user,
        error: `다음 권한 중 하나가 필요합니다: ${permissionNames.join(', ')}`
      };
    } catch (error) {
      console.error('권한 검증 오류:', error);
      return {
        hasPermission: false,
        user: null,
        error: '권한 검증 중 오류가 발생했습니다.'
      };
    }
  };
}

// 모든 권한이 있어야 허용하는 미들웨어
export function requireAllPermissions(permissionNames: string[]) {
  return async (request: NextRequest): Promise<PermissionCheckResult> => {
    try {
      const user = await getUserFromSession(request);
      if (!user) {
        return {
          hasPermission: false,
          user: null,
          error: '인증이 필요합니다.'
        };
      }

      // 모든 권한이 있는지 확인
      for (const permissionName of permissionNames) {
        const hasPermission = await checkUserPermission(user.id, permissionName);
        if (!hasPermission) {
          return {
            hasPermission: false,
            user,
            error: `'${permissionName}' 권한이 필요합니다.`
          };
        }
      }

      return {
        hasPermission: true,
        user
      };
    } catch (error) {
      console.error('권한 검증 오류:', error);
      return {
        hasPermission: false,
        user: null,
        error: '권한 검증 중 오류가 발생했습니다.'
      };
    }
  };
}

// 설정 카테고리별 권한 매핑
export const SETTING_PERMISSIONS = {
  sensitivity: {
    read: 'settings.sensitivity.read',
    write: 'settings.sensitivity.write'
  },
  hardware: {
    read: 'settings.hardware.read',
    write: 'settings.hardware.write'
  },
  notifications: {
    read: 'settings.notifications.read',
    write: 'settings.notifications.write'
  },
  periodicPatterns: {
    read: 'settings.periodic_patterns.read',
    write: 'settings.periodic_patterns.write'
  },
  system: {
    read: 'settings.system.read',
    write: 'settings.system.write'
  },
  quality: {
    read: 'settings.quality.read',
    write: 'settings.quality.write'
  },
  ai: {
    read: 'settings.ai.read',
    write: 'settings.ai.write'
  },
  security: {
    read: 'settings.security.read',
    write: 'settings.security.write'
  },
  logging: {
    read: 'settings.logging.read',
    write: 'settings.logging.write'
  }
} as const;

// 백업 관련 권한
export const BACKUP_PERMISSIONS = {
  create: 'backup.create',
  list: 'backup.list',
  download: 'backup.download',
  delete: 'backup.delete',
  restore: 'backup.restore'
} as const;

// 시스템 관리 권한
export const SYSTEM_PERMISSIONS = {
  userManagement: 'system.user_management',
  permissionManagement: 'system.permission_management',
  auditLog: 'system.audit_log',
  maintenance: 'system.maintenance'
} as const;

// 권한 검증 헬퍼 함수들
export const PermissionHelpers = {
  // 설정 읽기 권한 확인
  canReadSettings: (category: keyof typeof SETTING_PERMISSIONS) => 
    requirePermission(SETTING_PERMISSIONS[category].read),

  // 설정 쓰기 권한 확인
  canWriteSettings: (category: keyof typeof SETTING_PERMISSIONS) => 
    requirePermission(SETTING_PERMISSIONS[category].write),

  // 설정 읽기/쓰기 권한 확인
  canAccessSettings: (category: keyof typeof SETTING_PERMISSIONS, action: 'read' | 'write') =>
    requirePermission(SETTING_PERMISSIONS[category][action]),

  // 백업 권한 확인
  canAccessBackup: (action: keyof typeof BACKUP_PERMISSIONS) =>
    requirePermission(BACKUP_PERMISSIONS[action]),

  // 시스템 관리 권한 확인
  canAccessSystem: (action: keyof typeof SYSTEM_PERMISSIONS) =>
    requirePermission(SYSTEM_PERMISSIONS[action]),

  // 여러 설정 카테고리 중 하나라도 읽을 수 있는지 확인
  canReadAnySettings: (categories: (keyof typeof SETTING_PERMISSIONS)[]) =>
    requireAnyPermission(categories.map(cat => SETTING_PERMISSIONS[cat].read)),

  // 모든 설정을 읽을 수 있는지 확인
  canReadAllSettings: () =>
    requireAnyPermission(Object.values(SETTING_PERMISSIONS).map(p => p.read))
};

// 권한 감사 로그 기록
export async function logPermissionAction(
  userId: number,
  permissionName: string,
  action: 'granted' | 'revoked' | 'checked' | 'denied',
  details?: Record<string, unknown>,
  request?: NextRequest
): Promise<void> {
  try {
    const connection = getConnection();
    
    // 권한 ID 조회
    const permissionQuery = `
      SELECT permission_id FROM permissions 
      WHERE permission_name = $1
    `;
    const permissionResult = await connection.query(permissionQuery, [permissionName]);
    
    if (permissionResult.rows.length === 0) {
      console.warn(`권한 '${permissionName}'을 찾을 수 없습니다.`);
      return;
    }

    const permissionId = permissionResult.rows[0].permission_id;
    
    // IP 주소 추출
    const ipAddress = request?.headers.get('x-forwarded-for') || 
                     request?.headers.get('x-real-ip') || 
                     request?.ip || 
                     null;

    // User Agent 추출
    const userAgent = request?.headers.get('user-agent') || null;

    const logQuery = `
      INSERT INTO permission_audit_log 
      (user_id, permission_id, action_type, new_value, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await connection.query(logQuery, [
      userId,
      permissionId,
      action,
      details ? JSON.stringify(details) : null,
      ipAddress,
      userAgent
    ]);
  } catch (error) {
    console.error('권한 감사 로그 기록 오류:', error);
    // 로그 기록 실패는 주요 기능을 방해하지 않도록 에러를 던지지 않음
  }
}

export default {
  requirePermission,
  requireAnyPermission,
  requireAllPermissions,
  checkUserPermission,
  getUserPermissions,
  PermissionHelpers,
  logPermissionAction,
  SETTING_PERMISSIONS,
  BACKUP_PERMISSIONS,
  SYSTEM_PERMISSIONS
}; 