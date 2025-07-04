import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { 
  PermissionHelpers,
  logPermissionAction,
  SYSTEM_PERMISSIONS
} from '@/lib/middleware/permissions';

// 역할 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessSystem('permissionManagement')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '역할 관리 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const connection = getConnection();
    await connection.query('SELECT 1');

    const query = `
      SELECT 
        ur.role_id,
        ur.role_name,
        ur.role_description,
        ur.is_active,
        ur.created_at,
        ur.updated_at,
        COUNT(DISTINCT ura.user_id) as user_count,
        COUNT(DISTINCT rp.permission_id) as permission_count
      FROM user_roles ur
      LEFT JOIN user_role_assignments ura ON ur.role_id = ura.role_id AND ura.is_active = true
      LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
      GROUP BY ur.role_id, ur.role_name, ur.role_description, ur.is_active, ur.created_at, ur.updated_at
      ORDER BY ur.role_name
    `;

    const result = await connection.query(query);
    
    const roles = result.rows.map(row => ({
      role_id: row.role_id,
      role_name: row.role_name,
      role_description: row.role_description,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at,
      user_count: parseInt(row.user_count),
      permission_count: parseInt(row.permission_count)
    }));

    // 권한 감사 로그 기록
    if (permissionCheck.user) {
      await logPermissionAction(
        permissionCheck.user.id,
        SYSTEM_PERMISSIONS.permissionManagement,
        'checked',
        { action: 'list_roles', role_count: roles.length },
        request
      );
    }

    return NextResponse.json({
      success: true,
      data: roles,
      meta: {
        total: roles.length,
        active_roles: roles.filter(r => r.is_active).length
      }
    });

  } catch (error) {
    console.error('역할 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '역할 목록 조회에 실패했습니다.',
      code: 'ROLES_FETCH_ERROR'
    }, { status: 500 });
  }
}

// 새 역할 생성 (POST)
export async function POST(request: NextRequest) {
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessSystem('permissionManagement')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '역할 생성 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const requestData = await request.json();
    const { role_name, role_description, permissions } = requestData;

    if (!role_name || typeof role_name !== 'string') {
      return NextResponse.json({
        success: false,
        error: '역할명이 필요합니다.',
        code: 'MISSING_ROLE_NAME'
      }, { status: 400 });
    }

    const connection = getConnection();
    await connection.query('SELECT 1');

    // 트랜잭션 시작
    await connection.query('BEGIN');

    try {
      // 역할 생성
      const createRoleQuery = `
        INSERT INTO user_roles (role_name, role_description, is_active, created_at, updated_at)
        VALUES ($1, $2, true, NOW(), NOW())
        RETURNING role_id
      `;
      
      const roleResult = await connection.query(createRoleQuery, [role_name, role_description || '']);
      const roleId = roleResult.rows[0].role_id;

      // 권한 할당
      if (permissions && Array.isArray(permissions)) {
        for (const permissionId of permissions) {
          const assignPermissionQuery = `
            INSERT INTO role_permissions (role_id, permission_id, granted_at, granted_by)
            VALUES ($1, $2, NOW(), $3)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `;
          await connection.query(assignPermissionQuery, [roleId, permissionId, permissionCheck.user?.id]);
        }
      }

      await connection.query('COMMIT');

      // 권한 감사 로그 기록
      if (permissionCheck.user) {
        await logPermissionAction(
          permissionCheck.user.id,
          SYSTEM_PERMISSIONS.permissionManagement,
          'granted',
          { 
            action: 'create_role',
            role_id: roleId,
            role_name,
            permissions: permissions || []
          },
          request
        );
      }

      return NextResponse.json({
        success: true,
        data: { role_id: roleId, role_name, role_description },
        message: '역할이 성공적으로 생성되었습니다.'
      });

    } catch (dbError) {
      await connection.query('ROLLBACK');
      throw dbError;
    }

  } catch (error) {
    console.error('역할 생성 오류:', error);
    return NextResponse.json({
      success: false,
      error: '역할 생성에 실패했습니다.',
      code: 'ROLE_CREATE_ERROR'
    }, { status: 500 });
  }
} 