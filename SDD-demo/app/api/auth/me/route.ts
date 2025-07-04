import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromSession(request);

    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        full_name: user.full_name,
      }
    });

  } catch (error) {
    console.error('사용자 정보 조회 중 오류:', error);
    return NextResponse.json(
      { error: '사용자 정보 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 