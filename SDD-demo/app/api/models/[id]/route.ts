import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';

// GET /api/models/[id] - 특정 모델 상세 조회
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
    const modelId = params.id;

    const query = `
      SELECT am.*, u.username as created_by_name
      FROM ai_models am
      LEFT JOIN users u ON am.created_by = u.id
      WHERE am.id = $1
    `;
    
    const result = await pool.query(query, [modelId]);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '모델을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: result.rows[0]
    });
  } catch (error) {
    console.error('모델 조회 오류:', error);
    return NextResponse.json(
      { error: '모델 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// PUT /api/models/[id] - 모델 정보 수정
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증 확인 (관리자 권한 필요)
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const modelId = params.id;
    const body = await request.json();
    const {
      description,
      accuracyScore,
      isActive
    } = body;

    const query = `
      UPDATE ai_models 
      SET description = COALESCE($1, description),
          accuracy_score = COALESCE($2, accuracy_score),
          is_active = COALESCE($3, is_active),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      description, accuracyScore, isActive, modelId
    ]);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '모델을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: '모델 정보가 성공적으로 수정되었습니다.',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('모델 수정 오류:', error);
    return NextResponse.json(
      { error: '모델 수정 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// DELETE /api/models/[id] - 모델 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // 인증 확인 (관리자 권한 필요)
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const modelId = params.id;

    // 모델이 사용 중인지 확인
    const usageCheck = await pool.query(
      'SELECT COUNT(*) FROM defect_detections WHERE model_id = $1',
      [modelId]
    );

    if (parseInt(usageCheck.rows[0].count) > 0) {
      return NextResponse.json(
        { error: '사용 중인 모델은 삭제할 수 없습니다.' },
        { status: 409 }
      );
    }

    const result = await pool.query(
      'DELETE FROM ai_models WHERE id = $1 RETURNING *',
      [modelId]
    );
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '모델을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: '모델이 성공적으로 삭제되었습니다.'
    });
  } catch (error) {
    console.error('모델 삭제 오류:', error);
    return NextResponse.json(
      { error: '모델 삭제 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 