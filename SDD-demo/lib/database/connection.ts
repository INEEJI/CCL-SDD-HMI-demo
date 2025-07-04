import { Pool } from 'pg';

// PostgreSQL 연결 풀 설정
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ccl_sdd_system',
  password: process.env.DB_PASSWORD || 'password',
  port: parseInt(process.env.DB_PORT || '5432'),
  max: 20, // 최대 연결 수
  idleTimeoutMillis: 30000, // 유휴 연결 타임아웃
  connectionTimeoutMillis: 2000, // 연결 타임아웃
});

// 연결 테스트
pool.on('connect', () => {
  console.log('PostgreSQL 데이터베이스에 연결되었습니다.');
});

pool.on('error', (err: Error) => {
  console.error('PostgreSQL 연결 오류:', err);
});

// 연결 함수 추가
export const getConnection = () => pool;

export default pool; 