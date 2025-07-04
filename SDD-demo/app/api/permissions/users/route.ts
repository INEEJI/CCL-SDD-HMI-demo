import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { 
  PermissionHelpers,
  logPermissionAction,
  SYSTEM_PERMISSIONS
} from '@/lib/middleware/permissions';

// 사용자 권한 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    // 권한 확인 - 사용자 관리 권한 필요
    const permissionCheck = await PermissionHelpers.canAccessSystem('userManagement')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '사용자 권한 조회 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const connection = getConnection();
    await connection.query('SELECT 1');

    const query = `
      SELECT 
        u.id as user_id,
        u.username,
        u.email,
        u.full_name,
        u.is_active,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'role_id', ur.role_id,
              'role_name', ur.role_name,
              'role_description', ur.role_description
            )
          ) FILTER (WHERE ur.role_id IS NOT NULL),
          '[]'
        ) as roles,
        COALESCE(
          JSON_AGG(
            DISTINCT JSONB_BUILD_OBJECT(
              'permission_id', p.permission_id,
              'permission_name', p.permission_name,
              'permission_description', p.permission_description,
              'resource_type', p.resource_type,
              'resource_category', p.resource_category,
              'action_type', p.action_type,
              'source', CASE 
                WHEN rp.role_id IS NOT NULL THEN 'role'
                WHEN upo.user_id IS NOT NULL THEN 'override'
                ELSE 'unknown'
              END
            )
          ) FILTER (WHERE p.permission_id IS NOT NULL),
          '[]'
        ) as permissions
      FROM users u
      LEFT JOIN user_role_assignments ura ON u.id = ura.user_id AND ura.is_active = true
      LEFT JOIN user_roles ur ON ura.role_id = ur.role_id AND ur.is_active = true
      LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
      LEFT JOIN permissions p ON rp.permission_id = p.permission_id AND p.is_active = true
      LEFT JOIN user_permission_overrides upo ON u.id = upo.user_id 
        AND upo.permission_id = p.permission_id 
        AND upo.is_active = true
        AND upo.is_granted = true
      WHERE u.is_active = true
      GROUP BY u.id, u.username, u.email, u.full_name, u.is_active
      ORDER BY u.username
    `;

    const result = await connection.query(query);
    
    const users = result.rows.map(row => ({
      user_id: row.user_id,
      username: row.username,
      email: row.email,
      full_name: row.full_name,
      is_active: row.is_active,
      roles: row.roles,
      permissions: row.permissions,
      role_name: row.roles.length > 0 ? row.roles[0].role_name : 'No Role'
    }));

    // 권한 감사 로그 기록
    if (permissionCheck.user) {
      await logPermissionAction(
        permissionCheck.user.id,
        SYSTEM_PERMISSIONS.userManagement,
        'checked',
        { action: 'list_users', user_count: users.length },
        request
      );
    }

    return NextResponse.json({
      success: true,
      data: users,
      meta: {
        total: users.length,
        active_users: users.filter(u => u.is_active).length
      }
    });

  } catch (error) {
    console.error('사용자 권한 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 권한 조회에 실패했습니다.',
      code: 'USER_PERMISSIONS_FETCH_ERROR'
    }, { status: 500 });
  }
} 