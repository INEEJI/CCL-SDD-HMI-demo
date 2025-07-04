import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// 고객사 목록 조회
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const isActive = searchParams.get('is_active');
    const search = searchParams.get('search');

    let query = `
      SELECT 
        id,
        name,
        code,
        contact_person,
        contact_email,
        contact_phone,
        address,
        is_active,
        created_at,
        updated_at
      FROM customers
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (isActive !== null) {
      query += ` AND is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    if (search) {
      query += ` AND (name ILIKE $${paramIndex} OR code ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY name`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('고객사 목록 조회 중 오류:', error);
    return NextResponse.json(
      { error: '고객사 목록 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 