import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// 특정 고객사 불량 기준 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 기준 ID입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const query = `
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

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '해당 기준을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('고객사별 불량 기준 조회 중 오류:', error);
    return NextResponse.json(
      { error: '고객사별 불량 기준 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// 특정 고객사 불량 기준 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 기준 ID입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const body = await request.json();

    const {
      min_confidence_score,
      max_defect_size_width,
      max_defect_size_height,
      max_defect_count_per_meter,
      severity_level,
      is_critical,
      action_required,
      notification_enabled,
      description,
      is_active
    } = body;

    // 기존 기준 존재 확인
    const existingRule = await pool.query(
      'SELECT * FROM customer_defect_rules WHERE id = $1',
      [id]
    );

    if (existingRule.rows.length === 0) {
      return NextResponse.json(
        { error: '해당 기준을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 값 범위 검증
    if (min_confidence_score !== undefined && (min_confidence_score < 0 || min_confidence_score > 1)) {
      return NextResponse.json(
        { error: '신뢰도 점수는 0과 1 사이여야 합니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if ((max_defect_size_width !== undefined && max_defect_size_width <= 0) || 
        (max_defect_size_height !== undefined && max_defect_size_height <= 0)) {
      return NextResponse.json(
        { error: '결함 크기는 0보다 커야 합니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (severity_level !== undefined && !['low', 'medium', 'high', 'critical'].includes(severity_level)) {
      return NextResponse.json(
        { error: '심각도는 low, medium, high, critical 중 하나여야 합니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 업데이트할 필드들 동적 구성
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (min_confidence_score !== undefined) {
      updateFields.push(`min_confidence_score = $${paramIndex}`);
      updateValues.push(min_confidence_score);
      paramIndex++;
    }

    if (max_defect_size_width !== undefined) {
      updateFields.push(`max_defect_size_width = $${paramIndex}`);
      updateValues.push(max_defect_size_width);
      paramIndex++;
    }

    if (max_defect_size_height !== undefined) {
      updateFields.push(`max_defect_size_height = $${paramIndex}`);
      updateValues.push(max_defect_size_height);
      paramIndex++;
    }

    if (max_defect_count_per_meter !== undefined) {
      updateFields.push(`max_defect_count_per_meter = $${paramIndex}`);
      updateValues.push(max_defect_count_per_meter);
      paramIndex++;
    }

    if (severity_level !== undefined) {
      updateFields.push(`severity_level = $${paramIndex}`);
      updateValues.push(severity_level);
      paramIndex++;
    }

    if (is_critical !== undefined) {
      updateFields.push(`is_critical = $${paramIndex}`);
      updateValues.push(is_critical);
      paramIndex++;
    }

    if (action_required !== undefined) {
      updateFields.push(`action_required = $${paramIndex}`);
      updateValues.push(action_required);
      paramIndex++;
    }

    if (notification_enabled !== undefined) {
      updateFields.push(`notification_enabled = $${paramIndex}`);
      updateValues.push(notification_enabled);
      paramIndex++;
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(description);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updateFields.push(`is_active = $${paramIndex}`);
      updateValues.push(is_active);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: '수정할 필드가 없습니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // updated_at은 트리거에서 자동 업데이트됨
    updateValues.push(id);

    const updateQuery = `
      UPDATE customer_defect_rules 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, updateValues);

    // 수정된 기준 정보 조회 (고객사 정보 포함)
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

    const selectResult = await pool.query(selectQuery, [id]);

    return NextResponse.json({
      success: true,
      message: '고객사별 불량 기준이 성공적으로 수정되었습니다.',
      data: selectResult.rows[0]
    });

  } catch (error) {
    console.error('고객사별 불량 기준 수정 중 오류:', error);
    return NextResponse.json(
      { error: '고객사별 불량 기준 수정 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// 특정 고객사 불량 기준 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { user } = authResult;
    const id = parseInt(params.id);

    if (isNaN(id)) {
      return NextResponse.json(
        { error: '유효하지 않은 기준 ID입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 기존 기준 존재 확인
    const existingRule = await pool.query(
      'SELECT * FROM customer_defect_rules WHERE id = $1',
      [id]
    );

    if (existingRule.rows.length === 0) {
      return NextResponse.json(
        { error: '해당 기준을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 기준 삭제
    await pool.query('DELETE FROM customer_defect_rules WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: '고객사별 불량 기준이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('고객사별 불량 기준 삭제 중 오류:', error);
    return NextResponse.json(
      { error: '고객사별 불량 기준 삭제 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 