import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireOperator } from '@/lib/auth-middleware';

// GET /api/defects - 결함 검출 결과 조회
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
    const scheduleId = searchParams.get('scheduleId');
    const defectType = searchParams.get('defectType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = `
      SELECT dd.*, s.coil_id, c.name as customer_name, am.model_name, am.version
      FROM defect_detections dd
      LEFT JOIN schedules s ON dd.schedule_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN ai_models am ON dd.model_id = am.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (scheduleId) {
      query += ` AND dd.schedule_id = $${params.length + 1}`;
      params.push(scheduleId);
    }

    if (defectType && defectType !== 'all') {
      query += ` AND dd.defect_type = $${params.length + 1}`;
      params.push(defectType);
    }

    if (startDate) {
      query += ` AND dd.detection_time >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND dd.detection_time <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY dd.detection_time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);
    
    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) FROM defect_detections dd WHERE 1=1';
    const countParams: any[] = [];
    
    if (scheduleId) {
      countQuery += ` AND dd.schedule_id = $${countParams.length + 1}`;
      countParams.push(scheduleId);
    }
    
    if (defectType && defectType !== 'all') {
      countQuery += ` AND dd.defect_type = $${countParams.length + 1}`;
      countParams.push(defectType);
    }
    
    if (startDate) {
      countQuery += ` AND dd.detection_time >= $${countParams.length + 1}`;
      countParams.push(startDate);
    }
    
    if (endDate) {
      countQuery += ` AND dd.detection_time <= $${countParams.length + 1}`;
      countParams.push(endDate);
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
    console.error('결함 검출 결과 조회 오류:', error);
    return NextResponse.json(
      { error: '결함 검출 결과 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST /api/defects - 새 결함 검출 결과 저장
export async function POST(request: NextRequest) {
  // 인증 확인 (검사원 이상 권한 필요)
  const authResult = await requireOperator(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const body = await request.json();
    const {
      scheduleId,
      modelId,
      defectType,
      defectSizeWidth,
      defectSizeHeight,
      defectPositionX,
      defectPositionY,
      defectPositionMeter,
      confidenceScore,
      imagePath
    } = body;

    // 필수 필드 검증
    if (!scheduleId || !defectType) {
      return NextResponse.json(
        { error: '스케줄 ID와 결함 유형은 필수입니다.' },
        { status: 400 }
      );
    }

    const query = `
      INSERT INTO defect_detections (
        schedule_id, model_id, defect_type, defect_size_width, defect_size_height,
        defect_position_x, defect_position_y, defect_position_meter, confidence_score, image_path
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;
    
    const result = await pool.query(query, [
      scheduleId, modelId, defectType, defectSizeWidth, defectSizeHeight,
      defectPositionX, defectPositionY, defectPositionMeter, confidenceScore, imagePath
    ]);
    
    return NextResponse.json({
      message: '결함 검출 결과가 성공적으로 저장되었습니다.',
      data: result.rows[0]
    }, { status: 201 });
  } catch (error) {
    console.error('결함 검출 결과 저장 오류:', error);
    return NextResponse.json(
      { error: '결함 검출 결과 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 