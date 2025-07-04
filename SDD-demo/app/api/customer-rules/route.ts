import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// 고객사별 불량 기준 조회
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const defectType = searchParams.get('defect_type');
    const isActive = searchParams.get('is_active');

    let query = `
      SELECT 
        cdr.id,
        cdr.customer_id,
        c.name as customer_name,
        c.code as customer_code,
        cdr.defect_type,
        cdr.min_confidence_score,
        cdr.max_defect_size_width,
        cdr.max_defect_size_height,
        cdr.max_defect_count_per_meter,
        cdr.severity_level,
        cdr.is_critical,
        cdr.action_required,
        cdr.notification_enabled,
        cdr.description,
        cdr.is_active,
        cdr.created_at,
        cdr.updated_at,
        u.username as created_by_username
      FROM customer_defect_rules cdr
      JOIN customers c ON cdr.customer_id = c.id
      LEFT JOIN users u ON cdr.created_by = u.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (customerId) {
      query += ` AND cdr.customer_id = $${paramIndex}`;
      params.push(parseInt(customerId));
      paramIndex++;
    }

    if (defectType) {
      query += ` AND cdr.defect_type = $${paramIndex}`;
      params.push(defectType);
      paramIndex++;
    }

    if (isActive !== null) {
      query += ` AND cdr.is_active = $${paramIndex}`;
      params.push(isActive === 'true');
      paramIndex++;
    }

    query += ` ORDER BY c.name, cdr.defect_type`;

    const result = await pool.query(query, params);

    return NextResponse.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });

  } catch (error) {
    console.error('고객사별 불량 기준 조회 중 오류:', error);
    return NextResponse.json(
      { error: '고객사별 불량 기준 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// 고객사별 불량 기준 생성
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const body = await request.json();

    const {
      customer_id,
      defect_type,
      min_confidence_score = 0.5,
      max_defect_size_width,
      max_defect_size_height,
      max_defect_count_per_meter = 5,
      severity_level = 'medium',
      is_critical = false,
      action_required,
      notification_enabled = true,
      description
    } = body;

    // 필수 필드 검증
    if (!customer_id || !defect_type) {
      return NextResponse.json(
        { error: '고객사 ID와 결함 유형은 필수입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 값 범위 검증
    if (min_confidence_score < 0 || min_confidence_score > 1) {
      return NextResponse.json(
        { error: '신뢰도 점수는 0과 1 사이여야 합니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (max_defect_size_width <= 0 || max_defect_size_height <= 0) {
      return NextResponse.json(
        { error: '결함 크기는 0보다 커야 합니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (!['low', 'medium', 'high', 'critical'].includes(severity_level)) {
      return NextResponse.json(
        { error: '심각도는 low, medium, high, critical 중 하나여야 합니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 고객사 존재 확인
    const customerCheck = await pool.query(
      'SELECT id FROM customers WHERE id = $1 AND is_active = true',
      [customer_id]
    );

    if (customerCheck.rows.length === 0) {
      return NextResponse.json(
        { error: '존재하지 않는 고객사입니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 중복 확인
    const duplicateCheck = await pool.query(
      'SELECT id FROM customer_defect_rules WHERE customer_id = $1 AND defect_type = $2',
      [customer_id, defect_type]
    );

    if (duplicateCheck.rows.length > 0) {
      return NextResponse.json(
        { error: '해당 고객사의 결함 유형에 대한 기준이 이미 존재합니다.', code: 'DUPLICATE_ERROR' },
        { status: 409 }
      );
    }

    // 새 기준 생성
    const insertQuery = `
      INSERT INTO customer_defect_rules (
        customer_id, defect_type, min_confidence_score, max_defect_size_width,
        max_defect_size_height, max_defect_count_per_meter, severity_level,
        is_critical, action_required, notification_enabled, description, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const insertResult = await pool.query(insertQuery, [
      customer_id,
      defect_type,
      min_confidence_score,
      max_defect_size_width,
      max_defect_size_height,
      max_defect_count_per_meter,
      severity_level,
      is_critical,
      action_required,
      notification_enabled,
      description,
      user.id
    ]);

    // 생성된 기준 정보 조회 (고객사 정보 포함)
    const selectQuery = `
      SELECT 
        cdr.*,
        c.name as customer_name,
        c.code as customer_code,
        u.username as created_by_username
      FROM customer_defect_rules cdr
      JOIN customers c ON cdr.customer_id = c.id
      LEFT JOIN users u ON cdr.created_by = u.id
      WHERE cdr.id = $1
    `;

    const selectResult = await pool.query(selectQuery, [insertResult.rows[0].id]);

    return NextResponse.json({
      success: true,
      message: '고객사별 불량 기준이 성공적으로 생성되었습니다.',
      data: selectResult.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('고객사별 불량 기준 생성 중 오류:', error);
    return NextResponse.json(
      { error: '고객사별 불량 기준 생성 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 