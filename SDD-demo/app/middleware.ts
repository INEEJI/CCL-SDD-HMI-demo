import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { Pool } from 'pg';

// PostgreSQL 연결 풀 생성
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ccl_sdd_system',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
});

// 미들웨어가 실행될 경로를 지정합니다.
export const config = {
  matcher: [
    /*
     * 모든 API 경로에 대해 미들웨어를 실행하되,
     * 인증이 필요 없는 로그인, 회원가입 경로는 제외합니다.
     */
    '/api/((?!auth).*)',
  ],
};

export async function middleware(request: NextRequest) {
  console.log('[미들웨어] 요청 경로:', request.nextUrl.pathname);

  // 1. 요청에서 세션 쿠키를 가져옵니다.
  const sessionCookie = request.cookies.get('ccl_sdd_session');
  const sessionId = sessionCookie?.value;

  console.log('[미들웨어] 세션 쿠키 확인:', { hasSessionId: !!sessionId });

  if (!sessionId) {
    // 쿠키가 없으면 인증 실패 응답을 보냅니다.
    console.log('[미들웨어] 세션 쿠키 없음 - 401 반환');
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        error: '인증이 필요합니다.', 
        code: 'AUTHENTICATION_REQUIRED' 
      }),
      { 
        status: 401, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }

  try {
    // 2. DB에서 세션 ID로 유효한(만료되지 않은) 세션이 있는지 확인합니다.
    const sessionQuery = `
      SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()
    `;
    
    console.log('[미들웨어] 세션 검증 시작:', sessionId.substring(0, 8) + '...');
    const result = await pool.query(sessionQuery, [sessionId]);
    
    console.log('[미들웨어] 세션 검증 결과:', { 
      found: result.rows.length > 0,
      rowCount: result.rows.length 
    });

    if (result.rows.length === 0) {
      // DB에 유효한 세션이 없으면 인증 실패 응답을 보냅니다.
      console.log('[미들웨어] 유효하지 않은 세션 - 401 반환');
      return new NextResponse(
        JSON.stringify({ 
          success: false, 
          error: '세션이 만료되었거나 유효하지 않습니다.', 
          code: 'INVALID_SESSION' 
        }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    // 세션 데이터를 파싱하여 사용자 정보 추출
    const sessionData = JSON.parse(result.rows[0].sess);
    console.log('[미들웨어] 세션 검증 성공:', { 
      userId: sessionData.userId, 
      username: sessionData.username,
      role: sessionData.role 
    });

    // 3. 세션이 유효하면 요청 헤더에 사용자 정보를 추가하여 다음 핸들러로 전달
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', sessionData.userId.toString());
    requestHeaders.set('x-user-name', sessionData.username);
    requestHeaders.set('x-user-role', sessionData.role);

    console.log('[미들웨어] 요청 통과 - API 라우트로 전달');
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

  } catch (error) {
    console.error('[미들웨어] 데이터베이스 오류:', error);
    return new NextResponse(
      JSON.stringify({ 
        success: false, 
        error: '서버 내부 오류가 발생했습니다.', 
        code: 'INTERNAL_SERVER_ERROR' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}
