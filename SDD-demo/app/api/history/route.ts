import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// ============================================================================
// 히스토리 조회 API (TC Code 기반)
// ============================================================================
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all'; // all, coil, defect, speed
    const coilNumber = searchParams.get('coil_number');
    const customerName = searchParams.get('customer_name');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const defectType = searchParams.get('defect_type');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    let result;

    switch (type) {
      case 'coil':
        result = await getCoilHistory(coilNumber, customerName, dateFrom, dateTo, page, limit, offset);
        break;
      case 'defect':
        result = await getDefectHistory(coilNumber, defectType, dateFrom, dateTo, page, limit, offset);
        break;
      case 'speed':
        result = await getSpeedHistory(dateFrom, dateTo, page, limit, offset);
        break;
      case 'all':
      default:
        result = await getAllHistory(coilNumber, customerName, dateFrom, dateTo, page, limit, offset);
        break;
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
      type: type
    });

  } catch (error) {
    console.error('히스토리 조회 오류:', error);
    return NextResponse.json(
      { error: '히스토리 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// ============================================================================
// 코일 히스토리 조회
// ============================================================================
async function getCoilHistory(
  coilNumber: string | null,
  customerName: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  page: number,
  limit: number,
  offset: number
) {
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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
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
      s.date as schedule_date,
      s.time as schedule_time,
      s.created_at as schedule_created_at,
      
      -- CUT 정보
      c.cut_mode,
      c.winding_length,
      c.date as cut_date,
      c.time as cut_time,
      c.created_at as cut_created_at,
      
      -- WPD 정보
      w.date as wpd_date,
      w.time as wpd_time,
      w.created_at as wpd_created_at,
      
      -- 결함 개수
      COUNT(d.id) as defect_count
      
    FROM tc_4000_schedule s
    LEFT JOIN tc_4001_cut c ON s.coil_number = c.coil_number
    LEFT JOIN tc_4002_wpd w ON s.coil_number = w.coil_number
    LEFT JOIN defect_detections d ON s.coil_number = d.coil_number
    ${whereClause}
    GROUP BY 
      s.coil_number, s.customer_name, s.ccl_bom, s.material_code,
      s.thickness, s.width, s.weight, s.length_value, s.product_group,
      s.mo_number, s.through_plate, s.date, s.time, s.created_at,
      c.cut_mode, c.winding_length, c.date, c.time, c.created_at,
      w.date, w.time, w.created_at
    ORDER BY s.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await pool.query(query, params);

  // 총 개수 조회
  const countQuery = `
    SELECT COUNT(DISTINCT s.coil_number) as total
    FROM tc_4000_schedule s
    ${whereClause}
  `;

  const countResult = await pool.query(countQuery, params.slice(0, -2));
  const total = parseInt(countResult.rows[0].total);

  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// ============================================================================
// 결함 히스토리 조회
// ============================================================================
async function getDefectHistory(
  coilNumber: string | null,
  defectType: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  page: number,
  limit: number,
  offset: number
) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (coilNumber) {
    conditions.push(`d.coil_number ILIKE $${paramIndex}`);
    params.push(`%${coilNumber}%`);
    paramIndex++;
  }

  if (defectType) {
    conditions.push(`d.defect_type = $${paramIndex}`);
    params.push(defectType);
    paramIndex++;
  }

  if (dateFrom) {
    conditions.push(`d.detection_time >= $${paramIndex}`);
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    conditions.push(`d.detection_time <= $${paramIndex}`);
    params.push(dateTo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      d.*,
      s.customer_name,
      s.ccl_bom,
      s.material_code,
      s.thickness,
      s.width,
      m.name as model_name,
      m.version as model_version
    FROM defect_detections d
    LEFT JOIN tc_4000_schedule s ON d.coil_number = s.coil_number
    LEFT JOIN ai_models m ON d.model_id = m.id
    ${whereClause}
    ORDER BY d.detection_time DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await pool.query(query, params);

  // 총 개수 조회
  const countQuery = `
    SELECT COUNT(*) as total
    FROM defect_detections d
    ${whereClause}
  `;

  const countResult = await pool.query(countQuery, params.slice(0, -2));
  const total = parseInt(countResult.rows[0].total);

  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// ============================================================================
// 라인 속도 히스토리 조회
// ============================================================================
async function getSpeedHistory(
  dateFrom: string | null,
  dateTo: string | null,
  page: number,
  limit: number,
  offset: number
) {
  const conditions = [];
  const params = [];
  let paramIndex = 1;

  if (dateFrom) {
    conditions.push(`date >= $${paramIndex}`);
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    conditions.push(`date <= $${paramIndex}`);
    params.push(dateTo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
    SELECT 
      line_code,
      sequence_no,
      date,
      time,
      line_speed,
      created_at
    FROM tc_4003_speed
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await pool.query(query, params);

  // 총 개수 조회
  const countQuery = `
    SELECT COUNT(*) as total
    FROM tc_4003_speed
    ${whereClause}
  `;

  const countResult = await pool.query(countQuery, params.slice(0, -2));
  const total = parseInt(countResult.rows[0].total);

  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}

// ============================================================================
// 전체 히스토리 조회 (통합 뷰)
// ============================================================================
async function getAllHistory(
  coilNumber: string | null,
  customerName: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  page: number,
  limit: number,
  offset: number
) {
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

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const query = `
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
      s.date as schedule_date,
      s.time as schedule_time,
      s.created_at as schedule_created_at,
      
      -- 최신 CUT 정보
      c.cut_mode,
      c.winding_length,
      c.created_at as cut_created_at,
      
      -- WPD 통과 여부
      CASE WHEN w.coil_number IS NOT NULL THEN true ELSE false END as wpd_passed,
      w.created_at as wpd_created_at,
      
      -- 결함 통계
      COUNT(d.id) as defect_count,
      STRING_AGG(DISTINCT d.defect_type, ', ') as defect_types,
      AVG(d.confidence_score) as avg_confidence
      
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
    LEFT JOIN defect_detections d ON s.coil_number = d.coil_number
    ${whereClause}
    GROUP BY 
      s.coil_number, s.customer_name, s.ccl_bom, s.material_code,
      s.thickness, s.width, s.weight, s.length_value, s.product_group,
      s.date, s.time, s.created_at,
      c.cut_mode, c.winding_length, c.created_at,
      w.coil_number, w.created_at
    ORDER BY s.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
  `;

  params.push(limit, offset);

  const result = await pool.query(query, params);

  // 총 개수 조회
  const countQuery = `
    SELECT COUNT(DISTINCT s.coil_number) as total
    FROM tc_4000_schedule s
    ${whereClause}
  `;

  const countResult = await pool.query(countQuery, params.slice(0, -2));
  const total = parseInt(countResult.rows[0].total);

  return {
    data: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
} 