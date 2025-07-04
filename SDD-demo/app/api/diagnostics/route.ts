import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireOperator } from '@/lib/auth-middleware';

// GET /api/diagnostics - 진단 이력 조회
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
    const diagnosticType = searchParams.get('type');
    const status = searchParams.get('status');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    let query = `
      SELECT 
        sd.*,
        u.username as performed_by_name
      FROM system_diagnostics sd
      LEFT JOIN users u ON sd.performed_by = u.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (diagnosticType) {
      query += ` AND sd.diagnostic_type = $${paramIndex}`;
      params.push(diagnosticType);
      paramIndex++;
    }

    if (status) {
      query += ` AND sd.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (dateFrom) {
      query += ` AND sd.created_at >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND sd.created_at <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    query += ` ORDER BY sd.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    // 전체 개수 조회
    let countQuery = 'SELECT COUNT(*) FROM system_diagnostics WHERE 1=1';
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (diagnosticType) {
      countQuery += ` AND diagnostic_type = $${countParamIndex}`;
      countParams.push(diagnosticType);
      countParamIndex++;
    }

    if (status) {
      countQuery += ` AND status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    }

    if (dateFrom) {
      countQuery += ` AND created_at >= $${countParamIndex}`;
      countParams.push(dateFrom);
      countParamIndex++;
    }

    if (dateTo) {
      countQuery += ` AND created_at <= $${countParamIndex}`;
      countParams.push(dateTo);
      countParamIndex++;
    }

    const countResult = await pool.query(countQuery, countParams);
    const totalCount = parseInt(countResult.rows[0].count);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('진단 이력 조회 중 오류:', error);
    return NextResponse.json(
      { error: '진단 이력 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/diagnostics - 새 진단 세션 시작
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
      diagnostic_type,
      description,
      external_service_url,
      parameters
    } = body;

    // 필수 필드 검증
    if (!diagnostic_type) {
      return NextResponse.json(
        { error: '진단 유형은 필수입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 진단 유형 검증
    const allowedTypes = ['camera_calibration', 'equipment_status', 'test_pattern', 'system_health', 'network_test'];
    if (!allowedTypes.includes(diagnostic_type)) {
      return NextResponse.json(
        { error: '지원되지 않는 진단 유형입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 새 진단 세션 생성
    const insertQuery = `
      INSERT INTO system_diagnostics (
        diagnostic_type, description, status, external_service_url, 
        parameters, performed_by, started_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      diagnostic_type,
      description || null,
      'in_progress',
      external_service_url || null,
      parameters ? JSON.stringify(parameters) : null,
      user.id
    ]);

    // 생성된 진단 세션 정보 조회 (사용자 정보 포함)
    const selectQuery = `
      SELECT 
        sd.*,
        u.username as performed_by_name
      FROM system_diagnostics sd
      LEFT JOIN users u ON sd.performed_by = u.id
      WHERE sd.id = $1
    `;

    const selectResult = await pool.query(selectQuery, [result.rows[0].id]);

    return NextResponse.json({
      success: true,
      message: '진단 세션이 성공적으로 시작되었습니다.',
      data: selectResult.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('진단 세션 시작 중 오류:', error);
    return NextResponse.json(
      { error: '진단 세션 시작 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 