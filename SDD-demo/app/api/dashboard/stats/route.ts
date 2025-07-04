import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/dashboard/stats - 대시보드 통계 데이터 조회
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || '7d'; // 7d, 30d, 90d
    
    let dateCondition = '';
    switch (period) {
      case '7d':
        dateCondition = "WHERE s.created_at >= NOW() - INTERVAL '7 days'";
        break;
      case '30d':
        dateCondition = "WHERE s.created_at >= NOW() - INTERVAL '30 days'";
        break;
      case '90d':
        dateCondition = "WHERE s.created_at >= NOW() - INTERVAL '90 days'";
        break;
      default:
        dateCondition = "WHERE s.created_at >= NOW() - INTERVAL '7 days'";
    }

    // 1. 기본 통계
    const basicStatsQuery = `
      SELECT 
        COUNT(DISTINCT s.coil_number) as total_coils,
        COUNT(DISTINCT s.customer_name) as total_customers,
        COUNT(DISTINCT d.id) as total_defects,
        ROUND(AVG(s.thickness), 3) as avg_thickness,
        ROUND(AVG(s.width), 1) as avg_width,
        SUM(s.weight) as total_weight
      FROM tc_4000_schedule s
      LEFT JOIN defect_detections d ON s.coil_number = d.coil_number
      ${dateCondition}
    `;

    // 2. 고객사별 통계
    const customerStatsQuery = `
      SELECT 
        s.customer_name,
        COUNT(DISTINCT s.coil_number) as coil_count,
        COUNT(d.id) as defect_count,
        ROUND(AVG(s.thickness), 3) as avg_thickness,
        SUM(s.weight) as total_weight
      FROM tc_4000_schedule s
      LEFT JOIN defect_detections d ON s.coil_number = d.coil_number
      ${dateCondition}
      GROUP BY s.customer_name
      ORDER BY coil_count DESC
      LIMIT 10
    `;

    // 3. 결함 유형별 통계
    const defectTypeStatsQuery = `
      SELECT 
        d.defect_type,
        COUNT(*) as count,
        ROUND(AVG(d.confidence_score), 4) as avg_confidence
      FROM defect_detections d
      JOIN tc_4000_schedule s ON d.coil_number = s.coil_number
      ${dateCondition.replace('s.created_at', 'd.created_at')}
      GROUP BY d.defect_type
      ORDER BY count DESC
    `;

    // 4. 일별 생산량 및 결함 추이
    const dailyTrendQuery = `
      SELECT 
        s.date,
        COUNT(DISTINCT s.coil_number) as coil_count,
        COUNT(d.id) as defect_count,
        SUM(s.weight) as total_weight,
        ROUND(AVG(sp.line_speed), 1) as avg_line_speed
      FROM tc_4000_schedule s
      LEFT JOIN defect_detections d ON s.coil_number = d.coil_number
      LEFT JOIN tc_4003_speed sp ON s.date = sp.date
      ${dateCondition}
      GROUP BY s.date
      ORDER BY s.date DESC
      LIMIT 30
    `;

    // 5. 제품군별 통계
    const productGroupStatsQuery = `
      SELECT 
        s.product_group,
        COUNT(DISTINCT s.coil_number) as coil_count,
        COUNT(d.id) as defect_count,
        ROUND(AVG(s.thickness), 3) as avg_thickness,
        ROUND(AVG(s.width), 1) as avg_width
      FROM tc_4000_schedule s
      LEFT JOIN defect_detections d ON s.coil_number = d.coil_number
      ${dateCondition}
      GROUP BY s.product_group
      ORDER BY coil_count DESC
    `;

    // 6. 현재 라인 상태
    const currentLineStatusQuery = `
      SELECT 
        line_speed,
        created_at
      FROM tc_4003_speed
      ORDER BY created_at DESC
      LIMIT 1
    `;

    // 7. 최근 WPD 통과 현황
    const recentWpdQuery = `
      SELECT 
        COUNT(*) as wpd_pass_count,
        MAX(created_at) as last_wpd_time
      FROM tc_4002_wpd
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `;

    // 8. 결함률 상위 코일
    const topDefectCoilsQuery = `
      SELECT 
        s.coil_number,
        s.customer_name,
        s.ccl_bom,
        COUNT(d.id) as defect_count,
        s.thickness,
        s.width
      FROM tc_4000_schedule s
      JOIN defect_detections d ON s.coil_number = d.coil_number
      ${dateCondition}
      GROUP BY s.coil_number, s.customer_name, s.ccl_bom, s.thickness, s.width
      HAVING COUNT(d.id) > 0
      ORDER BY defect_count DESC
      LIMIT 10
    `;

    // 모든 쿼리 실행
    const [
      basicStats,
      customerStats,
      defectTypeStats,
      dailyTrend,
      productGroupStats,
      currentLineStatus,
      recentWpd,
      topDefectCoils
    ] = await Promise.all([
      pool.query(basicStatsQuery),
      pool.query(customerStatsQuery),
      pool.query(defectTypeStatsQuery),
      pool.query(dailyTrendQuery),
      pool.query(productGroupStatsQuery),
      pool.query(currentLineStatusQuery),
      pool.query(recentWpdQuery),
      pool.query(topDefectCoilsQuery)
    ]);

    // 결함률 계산
    const totalCoils = parseInt(basicStats.rows[0].total_coils) || 0;
    const totalDefects = parseInt(basicStats.rows[0].total_defects) || 0;
    const defectRate = totalCoils > 0 ? ((totalDefects / totalCoils) * 100).toFixed(2) : '0.00';

    return NextResponse.json({
      success: true,
      data: {
        basic_stats: {
          ...basicStats.rows[0],
          defect_rate: parseFloat(defectRate)
        },
        customer_stats: customerStats.rows,
        defect_type_stats: defectTypeStats.rows,
        daily_trend: dailyTrend.rows,
        product_group_stats: productGroupStats.rows,
        current_line_status: currentLineStatus.rows[0] || null,
        recent_wpd: recentWpd.rows[0],
        top_defect_coils: topDefectCoils.rows,
        period: period
      }
    });

  } catch (error) {
    console.error('대시보드 통계 조회 오류:', error);
    return NextResponse.json(
      { error: '대시보드 통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 