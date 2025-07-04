import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// ============================================================================
// 공정데이터 통합 조회 API
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const coilNumber = searchParams.get('coil_number');
    const customerName = searchParams.get('customer_name');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = `
      SELECT 
        s.coil_number,
        s.customer_name,
        s.ccl_bom,
        s.material_code,
        s.thickness,
        s.width,
        s.weight,
        s.length_value,
        s.product_group,
        s.mo_number,
        s.through_plate,
        s.sequence_order,
        s.date as schedule_date,
        s.time as schedule_time,
        s.created_at as schedule_created_at,
        
        -- 최신 CUT 정보
        c.cut_mode,
        c.winding_length,
        c.date as cut_date,
        c.time as cut_time,
        c.created_at as cut_created_at,
        
        -- WPD 통과 정보
        w.date as wpd_date,
        w.time as wpd_time,
        w.created_at as wpd_created_at,
        
        -- 최신 라인 속도
        sp.line_speed,
        sp.created_at as speed_updated_at,
        
        -- 결함 통계
        COUNT(d.id) as defect_count,
        STRING_AGG(DISTINCT d.defect_type, ', ') as defect_types
        
      FROM tc_4000_schedule s
      LEFT JOIN LATERAL (
        SELECT * FROM tc_4001_cut 
        WHERE coil_number = s.coil_number 
        ORDER BY created_at DESC LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT * FROM tc_4002_wpd 
        WHERE coil_number = s.coil_number 
        ORDER BY created_at DESC LIMIT 1
      ) w ON true
      LEFT JOIN LATERAL (
        SELECT * FROM tc_4003_speed 
        ORDER BY created_at DESC LIMIT 1
      ) sp ON true
      LEFT JOIN defect_detections d ON d.coil_number = s.coil_number
    `;

    const conditions = [];
    const params = [];
    let paramIndex = 1;

    if (coilNumber) {
      conditions.push(`s.coil_number ILIKE $${paramIndex}`);
      params.push(`%${coilNumber}%`);
      paramIndex++;
    }

    if (customerName) {
      conditions.push(`s.customer_name ILIKE $${paramIndex}`);
      params.push(`%${customerName}%`);
      paramIndex++;
    }

    if (dateFrom) {
      conditions.push(`s.date >= $${paramIndex}`);
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      conditions.push(`s.date <= $${paramIndex}`);
      params.push(dateTo);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += `
      GROUP BY 
        s.coil_number, s.customer_name, s.ccl_bom, s.material_code,
        s.thickness, s.width, s.weight, s.length_value, s.product_group,
        s.mo_number, s.through_plate, s.sequence_order, s.date, s.time, s.created_at,
        c.cut_mode, c.winding_length, c.date, c.time, c.created_at,
        w.date, w.time, w.created_at, sp.line_speed, sp.created_at
      ORDER BY s.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);

    const result = await pool.query(query, params);

    // 총 개수 조회
    let countQuery = `
      SELECT COUNT(DISTINCT s.coil_number) as total
      FROM tc_4000_schedule s
    `;

    if (conditions.length > 0) {
      countQuery += ` WHERE ${conditions.join(' AND ')}`;
    }

    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      success: true,
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('공정데이터 조회 오류:', error);
    return NextResponse.json(
      { error: '공정데이터 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 특정 코일의 상세 정보 조회
// ============================================================================
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { coil_number } = await request.json();

    if (!coil_number) {
      return NextResponse.json(
        { error: '코일번호가 필요합니다.' },
        { status: 400 }
      );
    }

    // 코일 기본 정보
    const scheduleQuery = `
      SELECT * FROM tc_4000_schedule 
      WHERE coil_number = $1
      ORDER BY created_at DESC
    `;
    const scheduleResult = await pool.query(scheduleQuery, [coil_number]);

    // CUT 정보
    const cutQuery = `
      SELECT * FROM tc_4001_cut 
      WHERE coil_number = $1
      ORDER BY created_at DESC
    `;
    const cutResult = await pool.query(cutQuery, [coil_number]);

    // WPD 정보
    const wpdQuery = `
      SELECT * FROM tc_4002_wpd 
      WHERE coil_number = $1
      ORDER BY created_at DESC
    `;
    const wpdResult = await pool.query(wpdQuery, [coil_number]);

    // 결함 정보
    const defectQuery = `
      SELECT 
        d.*,
        m.name as model_name,
        m.version as model_version
      FROM defect_detections d
      LEFT JOIN ai_models m ON d.model_id = m.id
      WHERE d.coil_number = $1
      ORDER BY d.detection_time DESC
    `;
    const defectResult = await pool.query(defectQuery, [coil_number]);

    // 최근 라인 속도 (해당 코일 처리 시간대)
    const speedQuery = `
      SELECT * FROM tc_4003_speed 
      WHERE date = (
        SELECT date FROM tc_4000_schedule 
        WHERE coil_number = $1 
        LIMIT 1
      )
      ORDER BY created_at DESC
      LIMIT 20
    `;
    const speedResult = await pool.query(speedQuery, [coil_number]);

    if (scheduleResult.rows.length === 0) {
      return NextResponse.json(
        { error: '해당 코일번호를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        schedule: scheduleResult.rows[0],
        cut_history: cutResult.rows,
        wpd_history: wpdResult.rows,
        defects: defectResult.rows,
        speed_history: speedResult.rows
      }
    });

  } catch (error) {
    console.error('코일 상세정보 조회 오류:', error);
    return NextResponse.json(
      { error: '코일 상세정보 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 