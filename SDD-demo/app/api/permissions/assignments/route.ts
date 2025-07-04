import { NextRequest, NextResponse } from 'next/server';
import { getConnection } from '@/lib/database/connection';
import { 
  PermissionHelpers,
  logPermissionAction,
  SYSTEM_PERMISSIONS
} from '@/lib/middleware/permissions';

// 사용자 역할 할당 목록 조회 (GET)
export async function GET(request: NextRequest) {
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessSystem('userManagement')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '사용자 관리 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const connection = getConnection();
    await connection.query('SELECT 1');

    const query = `
      SELECT 
        ura.assignment_id,
        ura.user_id,
        u.username,
        u.email,
        ura.role_id,
        ur.role_name,
        ur.role_description,
        ura.assigned_at,
        ura.assigned_by,
        ab.username as assigned_by_username,
        ura.expires_at,
        ura.is_active
      FROM user_role_assignments ura
      JOIN users u ON ura.user_id = u.id
      JOIN user_roles ur ON ura.role_id = ur.role_id
      LEFT JOIN users ab ON ura.assigned_by = ab.id
      ORDER BY ura.assigned_at DESC
    `;

    const result = await connection.query(query);
    
    const assignments = result.rows.map(row => ({
      assignment_id: row.assignment_id,
      user_id: row.user_id,
      username: row.username,
      email: row.email,
      role_id: row.role_id,
      role_name: row.role_name,
      role_description: row.role_description,
      assigned_at: row.assigned_at,
      assigned_by: row.assigned_by,
      assigned_by_username: row.assigned_by_username,
      expires_at: row.expires_at,
      is_active: row.is_active
    }));

    // 권한 감사 로그 기록
    if (permissionCheck.user) {
      await logPermissionAction(
        permissionCheck.user.id,
        SYSTEM_PERMISSIONS.userManagement,
        'checked',
        { action: 'list_assignments', assignment_count: assignments.length },
        request
      );
    }

    return NextResponse.json({
      success: true,
      data: assignments,
      meta: {
        total: assignments.length,
        active_assignments: assignments.filter(a => a.is_active).length
      }
    });

  } catch (error) {
    console.error('사용자 역할 할당 목록 조회 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 역할 할당 목록 조회에 실패했습니다.',
      code: 'ASSIGNMENTS_FETCH_ERROR'
    }, { status: 500 });
  }
}

// 새 사용자 역할 할당 (POST)
export async function POST(request: NextRequest) {
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessSystem('userManagement')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '사용자 관리 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const requestData = await request.json();
    const { user_id, role_id, expires_at } = requestData;

    if (!user_id || !role_id) {
      return NextResponse.json({
        success: false,
        error: '사용자 ID와 역할 ID가 필요합니다.',
        code: 'MISSING_REQUIRED_PARAMS'
      }, { status: 400 });
    }

    const connection = getConnection();
    await connection.query('SELECT 1');

    // 트랜잭션 시작
    await connection.query('BEGIN');

    try {
      // 기존 할당 비활성화
      const deactivateQuery = `
        UPDATE user_role_assignments 
        SET is_active = false, updated_at = NOW()
        WHERE user_id = $1 AND is_active = true
      `;
      await connection.query(deactivateQuery, [user_id]);

      // 새 할당 생성
      const assignQuery = `
        INSERT INTO user_role_assignments (user_id, role_id, assigned_at, assigned_by, expires_at, is_active)
        VALUES ($1, $2, NOW(), $3, $4, true)
        RETURNING assignment_id
      `;
      
      const assignResult = await connection.query(assignQuery, [
        user_id, 
        role_id, 
        permissionCheck.user?.id,
        expires_at || null
      ]);
      
      const assignmentId = assignResult.rows[0].assignment_id;

      await connection.query('COMMIT');

      // 권한 감사 로그 기록
      if (permissionCheck.user) {
        await logPermissionAction(
          permissionCheck.user.id,
          SYSTEM_PERMISSIONS.userManagement,
          'granted',
          { 
            action: 'assign_role',
            assignment_id: assignmentId,
            user_id,
            role_id,
            expires_at
          },
          request
        );
      }

      return NextResponse.json({
        success: true,
        data: { assignment_id: assignmentId, user_id, role_id },
        message: '사용자 역할이 성공적으로 할당되었습니다.'
      });

    } catch (dbError) {
      await connection.query('ROLLBACK');
      throw dbError;
    }

  } catch (error) {
    console.error('사용자 역할 할당 오류:', error);
    return NextResponse.json({
      success: false,
      error: '사용자 역할 할당에 실패했습니다.',
      code: 'ASSIGNMENT_CREATE_ERROR'
    }, { status: 500 });
  }
} 