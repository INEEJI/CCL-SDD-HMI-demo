import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { 
  PermissionHelpers,
  logPermissionAction,
  SYSTEM_PERMISSIONS
} from '@/lib/middleware/permissions';

// 권한 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessSystem('permissionManagement')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '권한 관리 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const connection = getConnection();
    await connection.query('SELECT 1');

    const query = `
      SELECT 
        permission_id,
        permission_name,
        permission_description,
        resource_type,
        resource_category,
        action_type,
        is_active,
        created_at,
        updated_at
      FROM permissions
      ORDER BY resource_type, resource_category, action_type, permission_name
    `;

    const result = await connection.query(query);
    
    const permissions = result.rows.map(row => ({
      permission_id: row.permission_id,
      permission_name: row.permission_name,
      permission_description: row.permission_description,
      resource_type: row.resource_type,
      resource_category: row.resource_category,
      action_type: row.action_type,
      is_active: row.is_active,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    // 권한 감사 로그 기록
    if (permissionCheck.user) {
      await logPermissionAction(
        permissionCheck.user.id,
        SYSTEM_PERMISSIONS.permissionManagement,
        'checked',
        { action: 'list_permissions', permission_count: permissions.length },
        request
      );
    }

    return NextResponse.json({
      success: true,
      data: permissions,
      meta: {
        total: permissions.length,
        active_permissions: permissions.filter(p => p.is_active).length,
        resource_types: [...new Set(permissions.map(p => p.resource_type))],
        action_types: [...new Set(permissions.map(p => p.action_type))]
      }
    });

  } catch (error) {
    console.error('권한 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '권한 목록 조회에 실패했습니다.',
      code: 'PERMISSIONS_FETCH_ERROR'
    }, { status: 500 });
  }
} 