import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';

// GET /api/models - AI 모델 목록 조회
export async function GET(request: NextRequest) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const isActive = searchParams.get('isActive');
    const isDeployed = searchParams.get('isDeployed');

    let query = `
      SELECT am.*, u.username as created_by_name
      FROM ai_models am
      LEFT JOIN users u ON am.created_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (isActive !== null) {
      query += ` AND am.is_active = $${params.length + 1}`;
      params.push(isActive === 'true');
    }

    if (isDeployed !== null) {
      query += ` AND am.is_deployed = $${params.length + 1}`;
      params.push(isDeployed === 'true');
    }

    query += ` ORDER BY am.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);
    
    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) FROM ai_models WHERE 1=1';
    const countParams: any[] = [];
    
    if (isActive !== null) {
      countQuery += ` AND is_active = $${countParams.length + 1}`;
      countParams.push(isActive === 'true');
    }
    
    if (isDeployed !== null) {
      countQuery += ` AND is_deployed = $${countParams.length + 1}`;
      countParams.push(isDeployed === 'true');
    }
    
    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      data: result.rows,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    });
  } catch (error) {
    console.error('모델 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '모델 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/models - 새 AI 모델 등록
export async function POST(request: NextRequest) {
  // 인증 확인 (관리자 권한 필요)
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const body = await request.json();
    const {
      modelName,
      version,
      modelType,
      filePath,
      fileSize,
      checksum,
      description,
      accuracyScore,
      createdBy
    } = body;

    // 필수 필드 검증
    if (!modelName || !version || !modelType || !filePath) {
      return NextResponse.json(
        { error: '모델명, 버전, 타입, 파일 경로는 필수입니다.' },
        { status: 400 }
      );
    }

    // 동일한 모델명과 버전이 이미 존재하는지 확인
    const existingModel = await pool.query(
      'SELECT id FROM ai_models WHERE model_name = $1 AND version = $2',
      [modelName, version]
    );

    if (existingModel.rows.length > 0) {
      return NextResponse.json(
        { error: '동일한 모델명과 버전이 이미 존재합니다.' },
        { status: 409 }
      );
    }

    const query = `
      INSERT INTO ai_models (
        model_name, version, model_type, file_path, file_size, 
        checksum, description, accuracy_score, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    
          const result = await pool.query(query, [
        modelName, version, modelType, filePath, fileSize,
        checksum, description, accuracyScore, user.id // 현재 로그인한 사용자 ID 사용
      ]);
    
    return NextResponse.json({
      message: '모델이 성공적으로 등록되었습니다.',
      data: result.rows[0]
    }, { status: 201 });
  } catch (error) {
    console.error('모델 등록 오류:', error);
    return NextResponse.json(
      { error: '모델 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 