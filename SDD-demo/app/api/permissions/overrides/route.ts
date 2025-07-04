import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { 
  PermissionHelpers,
  logPermissionAction,
  SYSTEM_PERMISSIONS
} from '@/lib/middleware/permissions';

// 권한 오버라이드 목록 조회 (GET)
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
        upo.override_id,
        upo.user_id,
        u.username,
        u.email,
        upo.permission_id,
        p.permission_name,
        p.permission_description,
        p.resource_type,
        p.resource_category,
        p.action_type,
        upo.is_granted,
        upo.override_reason,
        upo.created_at,
        upo.created_by,
        cb.username as created_by_username,
        upo.expires_at,
        upo.is_active
      FROM user_permission_overrides upo
      JOIN users u ON upo.user_id = u.id
      JOIN permissions p ON upo.permission_id = p.permission_id
      LEFT JOIN users cb ON upo.created_by = cb.id
      ORDER BY upo.created_at DESC
    `;

    const result = await connection.query(query);
    
    const overrides = result.rows.map(row => ({
      override_id: row.override_id,
      user_id: row.user_id,
      username: row.username,
      email: row.email,
      permission_id: row.permission_id,
      permission_name: row.permission_name,
      permission_description: row.permission_description,
      resource_type: row.resource_type,
      resource_category: row.resource_category,
      action_type: row.action_type,
      is_granted: row.is_granted,
      override_reason: row.override_reason,
      created_at: row.created_at,
      created_by: row.created_by,
      created_by_username: row.created_by_username,
      expires_at: row.expires_at,
      is_active: row.is_active
    }));

    // 권한 감사 로그 기록
    if (permissionCheck.user) {
      await logPermissionAction(
        permissionCheck.user.id,
        SYSTEM_PERMISSIONS.permissionManagement,
        'checked',
        { action: 'list_overrides', override_count: overrides.length },
        request
      );
    }

    return NextResponse.json({
      success: true,
      data: overrides,
      meta: {
        total: overrides.length,
        active_overrides: overrides.filter(o => o.is_active).length,
        granted_overrides: overrides.filter(o => o.is_granted).length,
        denied_overrides: overrides.filter(o => !o.is_granted).length
      }
    });

  } catch (error) {
    console.error('권한 오버라이드 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '권한 오버라이드 목록 조회에 실패했습니다.',
      code: 'OVERRIDES_FETCH_ERROR'
    }, { status: 500 });
  }
}

// 새 권한 오버라이드 생성 (POST)
export async function POST(request: NextRequest) {
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

    const requestData = await request.json();
    const { user_id, permission_id, is_granted, override_reason, expires_at } = requestData;

    if (!user_id || !permission_id || typeof is_granted !== 'boolean') {
      return NextResponse.json({
        success: false,
        error: '사용자 ID, 권한 ID, 허용/거부 값이 필요합니다.',
        code: 'MISSING_REQUIRED_PARAMS'
      }, { status: 400 });
    }

    const connection = getConnection();
    await connection.query('SELECT 1');

    // 트랜잭션 시작
    await connection.query('BEGIN');

    try {
      // 기존 오버라이드 비활성화
      const deactivateQuery = `
        UPDATE user_permission_overrides 
        SET is_active = false
        WHERE user_id = $1 AND permission_id = $2 AND is_active = true
      `;
      await connection.query(deactivateQuery, [user_id, permission_id]);

      // 새 오버라이드 생성
      const createOverrideQuery = `
        INSERT INTO user_permission_overrides 
        (user_id, permission_id, is_granted, override_reason, created_at, created_by, expires_at, is_active)
        VALUES ($1, $2, $3, $4, NOW(), $5, $6, true)
        RETURNING override_id
      `;
      
      const overrideResult = await connection.query(createOverrideQuery, [
        user_id,
        permission_id,
        is_granted,
        override_reason || '',
        permissionCheck.user?.id,
        expires_at || null
      ]);
      
      const overrideId = overrideResult.rows[0].override_id;

      await connection.query('COMMIT');

      // 권한 감사 로그 기록
      if (permissionCheck.user) {
        await logPermissionAction(
          permissionCheck.user.id,
          SYSTEM_PERMISSIONS.permissionManagement,
          'granted',
          { 
            action: 'create_override',
            override_id: overrideId,
            user_id,
            permission_id,
            is_granted,
            override_reason,
            expires_at
          },
          request
        );
      }

      return NextResponse.json({
        success: true,
        data: { 
          override_id: overrideId, 
          user_id, 
          permission_id, 
          is_granted,
          override_reason 
        },
        message: '권한 오버라이드가 성공적으로 생성되었습니다.'
      });

    } catch (dbError) {
      await connection.query('ROLLBACK');
      throw dbError;
    }

  } catch (error) {
    console.error('권한 오버라이드 생성 오류:', error);
    return NextResponse.json({
      success: false,
      error: '권한 오버라이드 생성에 실패했습니다.',
      code: 'OVERRIDE_CREATE_ERROR'
    }, { status: 500 });
  }
}

// 권한 오버라이드 삭제 (DELETE)
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const overrideId = searchParams.get('overrideId');

    if (!overrideId) {
      return NextResponse.json({
        success: false,
        error: '오버라이드 ID가 필요합니다.',
        code: 'MISSING_OVERRIDE_ID'
      }, { status: 400 });
    }

    const connection = getConnection();
    await connection.query('SELECT 1');

    // 오버라이드 삭제 (비활성화)
    const deleteQuery = `
      UPDATE user_permission_overrides 
      SET is_active = false
      WHERE override_id = $1
      RETURNING user_id, permission_id
    `;
    
    const result = await connection.query(deleteQuery, [overrideId]);

    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: '오버라이드를 찾을 수 없습니다.',
        code: 'OVERRIDE_NOT_FOUND'
      }, { status: 404 });
    }

    const { user_id, permission_id } = result.rows[0];

    // 권한 감사 로그 기록
    if (permissionCheck.user) {
      await logPermissionAction(
        permissionCheck.user.id,
        SYSTEM_PERMISSIONS.permissionManagement,
        'revoked',
        { 
          action: 'delete_override',
          override_id: overrideId,
          user_id,
          permission_id
        },
        request
      );
    }

    return NextResponse.json({
      success: true,
      data: { override_id: overrideId },
      message: '권한 오버라이드가 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('권한 오버라이드 삭제 오류:', error);
    return NextResponse.json({
      success: false,
      error: '권한 오버라이드 삭제에 실패했습니다.',
      code: 'OVERRIDE_DELETE_ERROR'
    }, { status: 500 });
  }
} 