import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import bcrypt from 'bcryptjs';

async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function POST(request: NextRequest) {
  try {
    const { id, password, email, fullName, role = 'viewer' } = await request.json();

    // 입력 검증
    if (!id || !password) {
      return NextResponse.json(
        { error: '사용자 ID와 비밀번호는 필수입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: '비밀번호는 최소 6자 이상이어야 합니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 유효한 역할 확인
    const validRoles = ['admin', 'operator', 'viewer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: '유효하지 않은 역할입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 1. 중복 사용자 확인
    const checkUserQuery = 'SELECT id FROM users WHERE username = $1';
    const existingUser = await pool.query(checkUserQuery, [id]);

    if (existingUser.rows.length > 0) {
      return NextResponse.json(
        { error: '이미 존재하는 사용자 ID입니다.', code: 'CONFLICT' },
        { status: 409 }
      );
    }

    // 2. 비밀번호 해시화
    const hashedPassword = await hashPassword(password);

    // 3. 사용자 생성
    const insertUserQuery = `
      INSERT INTO users (username, password_hash, role, email, full_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, username, role, email, full_name, created_at
    `;

    const newUserResult = await pool.query(insertUserQuery, [
      id,
      hashedPassword,
      role,
      email || null,
      fullName || null
    ]);

    const newUser = newUserResult.rows[0];

    return NextResponse.json({
      message: '회원가입이 성공적으로 완료되었습니다.',
      user: {
        id: newUser.id,
        username: newUser.username,
        role: newUser.role,
        email: newUser.email,
        full_name: newUser.full_name,
        created_at: newUser.created_at,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('회원가입 처리 중 오류:', error);
    return NextResponse.json(
      { error: '회원가입 처리 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 