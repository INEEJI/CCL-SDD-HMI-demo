import session from 'express-session';
import pgSession from 'connect-pg-simple';
import { Pool } from 'pg';
import type { NextApiRequest } from 'next';

// PostgreSQL 연결 풀
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'ccl_sdd_system',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
});

// PostgreSQL 세션 스토어 설정
const PgSession = pgSession(session);

export const sessionConfig = {
  store: new PgSession({
    pool: pool,
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET || 'your-super-secret-key-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS에서만 true
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24시간
    sameSite: 'lax' as const,
  },
  name: 'ccl_sdd_session',
};

// 세션 타입 확장
declare module 'express-session' {
  interface SessionData {
    userId?: number;
    username?: string;
    role?: string;
  }
}

/**
 * 요청 객체의 세션에서 사용자 정보를 반환합니다.
 * @param req NextApiRequest - 세션 정보가 포함된 요청 객체
 * @returns 로그인된 사용자의 정보 또는 null
 */
export function getUserFromSession(req: NextApiRequest) {
  // 세션과 세션의 사용자 ID가 존재하는지 확인
  if (req.session && req.session.userId) {
    return {
      userId: req.session.userId,
      username: req.session.username,
      role: req.session.role,
    };
  }
  // 로그인되지 않은 경우 null 반환
  return null;
}

export { pool }; 