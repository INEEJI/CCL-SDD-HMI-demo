import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';

export async function POST(request: NextRequest) {
  try {
    // 쿠키에서 세션 ID 추출
    const sessionId = request.cookies.get('ccl_sdd_session')?.value;

    if (sessionId) {
      // 세션 삭제
      const deleteSessionQuery = 'DELETE FROM sessions WHERE sid = $1';
      await pool.query(deleteSessionQuery, [sessionId]);
    }

    // 쿠키 삭제
    const response = NextResponse.json({
      message: '로그아웃 성공'
    });

    response.cookies.set('ccl_sdd_session', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0, // 즉시 만료
      path: '/',
    });

    return response;

  } catch (error) {
    console.error('로그아웃 처리 중 오류:', error);
    return NextResponse.json(
      { error: '로그아웃 처리 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 