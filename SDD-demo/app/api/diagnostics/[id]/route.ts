import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireOperator } from '@/lib/auth-middleware';

// GET /api/diagnostics/[id] - 특정 진단 세션 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const diagnosticId = parseInt(params.id);

    if (isNaN(diagnosticId)) {
      return NextResponse.json(
        { error: '유효하지 않은 진단 ID입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const query = `
      SELECT 
        sd.*,
        u.username as performed_by_name
      FROM system_diagnostics sd
      LEFT JOIN users u ON sd.performed_by = u.id
      WHERE sd.id = $1
    `;

    const result = await pool.query(query, [diagnosticId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '해당 진단 세션을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const diagnostic = result.rows[0];

    // parameters가 JSON 문자열인 경우 파싱
    if (diagnostic.parameters && typeof diagnostic.parameters === 'string') {
      try {
        diagnostic.parameters = JSON.parse(diagnostic.parameters);
      } catch (error) {
        console.error('Parameters 파싱 오류:', error);
      }
    }

    // results가 JSON 문자열인 경우 파싱
    if (diagnostic.results && typeof diagnostic.results === 'string') {
      try {
        diagnostic.results = JSON.parse(diagnostic.results);
      } catch (error) {
        console.error('Results 파싱 오류:', error);
      }
    }

    return NextResponse.json({
      success: true,
      data: diagnostic
    });

  } catch (error) {
    console.error('진단 세션 조회 중 오류:', error);
    return NextResponse.json(
      { error: '진단 세션 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// PUT /api/diagnostics/[id] - 진단 세션 업데이트
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증 확인 (검사원 이상 권한 필요)
  const authResult = await requireOperator(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const diagnosticId = parseInt(params.id);

    if (isNaN(diagnosticId)) {
      return NextResponse.json(
        { error: '유효하지 않은 진단 ID입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      status,
      results,
      error_message,
      completed_at
    } = body;

    // 기존 진단 세션 존재 확인
    const existingDiagnostic = await pool.query(
      'SELECT * FROM system_diagnostics WHERE id = $1',
      [diagnosticId]
    );

    if (existingDiagnostic.rows.length === 0) {
      return NextResponse.json(
        { error: '해당 진단 세션을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 상태 검증
    if (status && !['in_progress', 'completed', 'failed', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: '유효하지 않은 상태입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 업데이트할 필드들 동적 구성
    const updateFields = [];
    const updateValues = [];
    let paramIndex = 1;

    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(status);
      paramIndex++;
    }

    if (results !== undefined) {
      updateFields.push(`results = $${paramIndex}`);
      updateValues.push(JSON.stringify(results));
      paramIndex++;
    }

    if (error_message !== undefined) {
      updateFields.push(`error_message = $${paramIndex}`);
      updateValues.push(error_message);
      paramIndex++;
    }

    if (completed_at !== undefined) {
      updateFields.push(`completed_at = $${paramIndex}`);
      updateValues.push(completed_at);
      paramIndex++;
    } else if (status === 'completed' || status === 'failed') {
      // 완료 또는 실패 상태로 변경 시 자동으로 완료 시간 설정
      updateFields.push(`completed_at = CURRENT_TIMESTAMP`);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: '업데이트할 필드가 없습니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // updated_at은 트리거에서 자동 업데이트됨
    updateValues.push(diagnosticId);

    const updateQuery = `
      UPDATE system_diagnostics 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, updateValues);

    // 업데이트된 진단 세션 정보 조회 (사용자 정보 포함)
    const selectQuery = `
      SELECT 
        sd.*,
        u.username as performed_by_name
      FROM system_diagnostics sd
      LEFT JOIN users u ON sd.performed_by = u.id
      WHERE sd.id = $1
    `;

    const selectResult = await pool.query(selectQuery, [diagnosticId]);

    return NextResponse.json({
      success: true,
      message: '진단 세션이 성공적으로 업데이트되었습니다.',
      data: selectResult.rows[0]
    });

  } catch (error) {
    console.error('진단 세션 업데이트 중 오류:', error);
    return NextResponse.json(
      { error: '진단 세션 업데이트 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// DELETE /api/diagnostics/[id] - 진단 세션 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증 확인 (검사원 이상 권한 필요)
  const authResult = await requireOperator(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const diagnosticId = parseInt(params.id);

    if (isNaN(diagnosticId)) {
      return NextResponse.json(
        { error: '유효하지 않은 진단 ID입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 기존 진단 세션 존재 확인
    const existingDiagnostic = await pool.query(
      'SELECT * FROM system_diagnostics WHERE id = $1',
      [diagnosticId]
    );

    if (existingDiagnostic.rows.length === 0) {
      return NextResponse.json(
        { error: '해당 진단 세션을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 진행 중인 진단은 삭제 불가
    if (existingDiagnostic.rows[0].status === 'in_progress') {
      return NextResponse.json(
        { error: '진행 중인 진단 세션은 삭제할 수 없습니다.', code: 'CONFLICT' },
        { status: 409 }
      );
    }

    // 진단 세션 삭제
    await pool.query('DELETE FROM system_diagnostics WHERE id = $1', [diagnosticId]);

    return NextResponse.json({
      success: true,
      message: '진단 세션이 성공적으로 삭제되었습니다.'
    });

  } catch (error) {
    console.error('진단 세션 삭제 중 오류:', error);
    return NextResponse.json(
      { error: '진단 세션 삭제 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 