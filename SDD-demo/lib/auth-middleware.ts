import { NextRequest, NextResponse } from 'next/server';
import pool from './database/connection';

interface User {
  id: number;
  username: string;
  role: string;
  email?: string;
  full_name?: string;
}

// 세션에서 사용자 정보 추출
export async function getUserFromSession(request: NextRequest): Promise<User | null> {
  try {
    // 쿠키에서 세션 ID 추출
    const sessionId = request.cookies.get('ccl_sdd_session')?.value;
    
    if (!sessionId) {
      return null;
    }

    // 세션 스토어에서 세션 정보 조회
    const sessionQuery = 'SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()';
    const sessionResult = await pool.query(sessionQuery, [sessionId]);
    
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
      SELECT id, username, role, email, full_name, is_active
      FROM users 
      WHERE id = $1 AND is_active = true
    `;
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return null;
    }

    return userResult.rows[0];
  } catch (error) {
    console.error('세션에서 사용자 정보 추출 실패:', error);
    return null;
  }
}

// 인증 필요한 API 보호
export async function requireAuth(request: NextRequest) {
  const user = await getUserFromSession(request);
  
  if (!user) {
    return NextResponse.json(
      { error: '인증이 필요합니다.', code: 'UNAUTHORIZED' },
      { status: 401 }
    );
  }

  return { user };
}

// 역할 기반 접근 제어
export async function requireRole(request: NextRequest, allowedRoles: string[]) {
  const authResult = await requireAuth(request);
  
  if (authResult instanceof NextResponse) {
    return authResult; // 인증 실패 응답 반환
  }

  const { user } = authResult;

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { error: '권한이 없습니다.', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  return { user };
}

// 관리자 권한 필요
export async function requireAdmin(request: NextRequest) {
  return requireRole(request, ['admin']);
}

// 검사원 이상 권한 필요
export async function requireOperator(request: NextRequest) {
  return requireRole(request, ['admin', 'operator']);
} 