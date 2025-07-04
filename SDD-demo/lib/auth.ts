import { NextRequest } from 'next/server';
import pool from '@/lib/database/connection';

export interface SessionData {
  userId: number;
  username: string;
  role: string;
}

export async function validateSession(request: NextRequest): Promise<SessionData | null> {
  try {
    // 쿠키에서 세션 ID 추출
    const sessionCookie = request.cookies.get('ccl_sdd_session');
    if (!sessionCookie?.value) {
      console.log('[세션 검증] 세션 쿠키 없음');
      return null;
    }

    const sessionId = sessionCookie.value;
    console.log('[세션 검증] 세션 ID 확인:', sessionId.substring(0, 8) + '...');

    // 데이터베이스에서 세션 검증
    const sessionQuery = 'SELECT sess FROM sessions WHERE sid = $1 AND expire > NOW()';
    const result = await pool.query(sessionQuery, [sessionId]);

    if (result.rows.length === 0) {
      console.log('[세션 검증] 유효하지 않은 세션');
      return null;
    }

    // 세션 데이터 안전하게 파싱
    const rawSessionData = result.rows[0].sess;
    console.log('[세션 검증] 원본 세션 데이터 타입:', typeof rawSessionData);
    
    let sessionData;
    if (typeof rawSessionData === 'string') {
      try {
        sessionData = JSON.parse(rawSessionData);
        console.log('[세션 검증] JSON 파싱 성공');
      } catch (parseError) {
        console.error('[세션 검증] JSON 파싱 실패:', parseError);
        return null;
      }
    } else if (typeof rawSessionData === 'object' && rawSessionData !== null) {
      sessionData = rawSessionData;
      console.log('[세션 검증] 이미 객체 형태의 세션 데이터');
    } else {
      console.error('[세션 검증] 알 수 없는 세션 데이터 형태:', rawSessionData);
      return null;
    }

    console.log('[세션 검증] 파싱된 세션 데이터:', {
      userId: sessionData.userId,
      username: sessionData.username,
      role: sessionData.role
    });

    return {
      userId: sessionData.userId,
      username: sessionData.username,
      role: sessionData.role
    };

  } catch (error) {
    console.error('[세션 검증] 오류:', error);
    return null;
  }
}
