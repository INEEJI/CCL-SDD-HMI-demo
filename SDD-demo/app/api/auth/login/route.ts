import { NextRequest, NextResponse } from 'next/server';
import bcryptjs from 'bcryptjs';
import pool from '@/lib/database/connection';

export async function POST(request: NextRequest) {
  try {
    const { id, password } = await request.json();
    
    console.log('[로그인] 로그인 시도:', { id, hasPassword: !!password });

    // 입력 검증
    if (!id || !password) {
      console.log('[로그인] 입력 검증 실패:', { id: !!id, password: !!password });
      return NextResponse.json(
        { error: '사용자 ID와 비밀번호는 필수입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 데이터베이스 연결 테스트
    try {
      await pool.query('SELECT 1');
      console.log('[로그인] 데이터베이스 연결 성공');
    } catch (dbError) {
      console.error('[로그인] 데이터베이스 연결 실패:', dbError);
      return NextResponse.json(
        { error: '데이터베이스 연결에 실패했습니다.', code: 'DATABASE_ERROR' },
        { status: 500 }
      );
    }

    // 1. 사용자 조회
    const userQuery = `
      SELECT id, username, password_hash, role, email, full_name, is_active, last_login
      FROM users 
      WHERE username = $1 AND is_active = true
    `;
    
    console.log('[로그인] 사용자 조회 시작:', id);
    const userResult = await pool.query(userQuery, [id]);
    console.log('[로그인] 사용자 조회 결과:', { 
      found: userResult.rows.length > 0,
      rowCount: userResult.rows.length 
    });

    if (userResult.rows.length === 0) {
      console.log('[로그인] 사용자를 찾을 수 없음:', id);
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const user = userResult.rows[0];
    console.log('[로그인] 사용자 정보:', { 
      id: user.id, 
      username: user.username, 
      role: user.role,
      hasPasswordHash: !!user.password_hash,
      passwordHashLength: user.password_hash ? user.password_hash.length : 0
    });

    // 2. 비밀번호 검증
    console.log('[로그인] 비밀번호 검증 시작');
    const isPasswordValid = await bcryptjs.compare(password, user.password_hash);
    console.log('[로그인] 비밀번호 검증 결과:', isPasswordValid);

    if (!isPasswordValid) {
      console.log('[로그인] 비밀번호 검증 실패');
      return NextResponse.json(
        { error: '아이디 또는 비밀번호가 올바르지 않습니다.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // 3. 세션 생성
    const sessionData = {
      userId: user.id,
      username: user.username,
      role: user.role,
    };

    // 세션 ID 생성 (간단한 구현, 실제로는 express-session이 처리)
    const sessionId = generateSessionId();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간

    // 세션 저장
    const sessionQuery = `
      INSERT INTO sessions (sid, sess, expire)
      VALUES ($1, $2, $3)
      ON CONFLICT (sid) DO UPDATE SET
        sess = EXCLUDED.sess,
        expire = EXCLUDED.expire
    `;

    console.log('[로그인] 세션 저장 시작');
    await pool.query(sessionQuery, [
      sessionId,
      JSON.stringify(sessionData),
      expiresAt
    ]);
    console.log('[로그인] 세션 저장 완료');

    // 4. 마지막 로그인 시간 업데이트
    const updateLoginQuery = `
      UPDATE users 
      SET last_login = CURRENT_TIMESTAMP 
      WHERE id = $1
    `;
    await pool.query(updateLoginQuery, [user.id]);
    console.log('[로그인] 마지막 로그인 시간 업데이트 완료');

    // 5. 쿠키 설정
    const response = NextResponse.json({
      message: '로그인 성공',
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        full_name: user.full_name,
      }
    });

    // HttpOnly 쿠키 설정
    response.cookies.set('ccl_sdd_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24시간 (초 단위)
      path: '/',
    });

    console.log('[로그인] 로그인 성공 완료');
    return response;

  } catch (error) {
    console.error('[로그인] 로그인 처리 중 오류:', error);
    console.error('[로그인] 오류 스택:', error.stack);
    return NextResponse.json(
      { error: '로그인 처리 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// 간단한 세션 ID 생성기
function generateSessionId(): string {
  return Array.from({ length: 32 }, () => 
    Math.random().toString(36).charAt(2)
  ).join('');
} 