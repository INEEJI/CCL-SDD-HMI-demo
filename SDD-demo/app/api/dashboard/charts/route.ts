import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// GET /api/dashboard/charts - 대시보드 차트 데이터 조회
export async function GET(request: NextRequest) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const chartType = searchParams.get('type') || 'all'; // all, defects, schedules, performance
    const period = searchParams.get('period') || '30d'; // 7d, 30d, 90d

    // 기간별 날짜 계산
    const now = new Date();
    let startDate: Date;
    let groupBy = 'DATE'; // DATE, WEEK, MONTH

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        groupBy = 'DATE';
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        groupBy = 'WEEK';
        break;
      default: // 30d
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        groupBy = 'DATE';
    }

    const charts: any = {};

    // 1. 결함 검출 트렌드 차트
    if (chartType === 'all' || chartType === 'defects') {
      const defectTrend = await pool.query(`
        SELECT 
          ${groupBy}(detection_time) as period,
          defect_type,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence
        FROM defect_detections 
        WHERE detection_time >= $1
        GROUP BY ${groupBy}(detection_time), defect_type
        ORDER BY period DESC, count DESC
      `, [startDate.toISOString()]);

      // 결함 유형별 분포 (파이 차트용)
      const defectDistribution = await pool.query(`
        SELECT 
          defect_type,
          COUNT(*) as count,
          ROUND(AVG(confidence_score), 2) as avg_confidence
        FROM defect_detections 
        WHERE detection_time >= $1
        GROUP BY defect_type
        ORDER BY count DESC
      `, [startDate.toISOString()]);

      charts.defects = {
        trend: defectTrend.rows,
        distribution: defectDistribution.rows
      };
    }

    // 2. 스케줄 진행 현황 차트
    if (chartType === 'all' || chartType === 'schedules') {
      const scheduleTrend = await pool.query(`
        SELECT 
          ${groupBy}(created_at) as period,
          status,
          COUNT(*) as count,
          AVG(progress_percentage) as avg_progress
        FROM schedules 
        WHERE created_at >= $1
        GROUP BY ${groupBy}(created_at), status
        ORDER BY period DESC
      `, [startDate.toISOString()]);

      // 고객사별 스케줄 분포
      const scheduleByCustomer = await pool.query(`
        SELECT 
          c.name as customer_name,
          c.code as customer_code,
          COUNT(s.id) as total_schedules,
          COUNT(CASE WHEN s.status = 'completed' THEN 1 END) as completed,
          COUNT(CASE WHEN s.status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN s.status = 'scheduled' THEN 1 END) as scheduled,
          ROUND(AVG(s.progress_percentage), 1) as avg_progress
        FROM customers c
        LEFT JOIN schedules s ON c.id = s.customer_id AND s.created_at >= $1
        WHERE c.is_active = true
        GROUP BY c.id, c.name, c.code
        HAVING COUNT(s.id) > 0
        ORDER BY total_schedules DESC
        LIMIT 10
      `, [startDate.toISOString()]);

      charts.schedules = {
        trend: scheduleTrend.rows,
        byCustomer: scheduleByCustomer.rows
      };
    }

    // 3. 성능 지표 차트
    if (chartType === 'all' || chartType === 'performance') {
      // AI 모델 성능 비교
      const modelComparison = await pool.query(`
        SELECT 
          am.model_name,
          am.version,
          am.accuracy_score,
          COUNT(dd.id) as usage_count,
          ROUND(AVG(dd.confidence_score), 3) as avg_confidence,
          COUNT(DISTINCT dd.schedule_id) as schedules_processed,
          MIN(dd.detection_time) as first_used,
          MAX(dd.detection_time) as last_used
        FROM ai_models am
        LEFT JOIN defect_detections dd ON am.id = dd.model_id AND dd.detection_time >= $1
        WHERE am.is_active = true
        GROUP BY am.id, am.model_name, am.version, am.accuracy_score
        ORDER BY usage_count DESC
      `, [startDate.toISOString()]);

      // 시간대별 시스템 활동
      const hourlyActivity = await pool.query(`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(CASE WHEN table_name = 'schedules' THEN 1 END) as schedules,
          COUNT(CASE WHEN table_name = 'defects' THEN 1 END) as defects
        FROM (
          SELECT created_at, 'schedules' as table_name FROM schedules WHERE created_at >= $1
          UNION ALL
          SELECT detection_time as created_at, 'defects' as table_name FROM defect_detections WHERE detection_time >= $1
        ) combined
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `, [startDate.toISOString()]);

      // 결함 신뢰도 분포 (히스토그램용)
      const confidenceDistribution = await pool.query(`
        SELECT 
          CASE 
            WHEN confidence_score >= 0.9 THEN '90-100%'
            WHEN confidence_score >= 0.8 THEN '80-90%'
            WHEN confidence_score >= 0.7 THEN '70-80%'
            WHEN confidence_score >= 0.6 THEN '60-70%'
            ELSE '< 60%'
          END as confidence_range,
          COUNT(*) as count,
          defect_type
        FROM defect_detections 
        WHERE detection_time >= $1 AND confidence_score IS NOT NULL
        GROUP BY confidence_range, defect_type
        ORDER BY 
          CASE confidence_range
            WHEN '90-100%' THEN 1
            WHEN '80-90%' THEN 2
            WHEN '70-80%' THEN 3
            WHEN '60-70%' THEN 4
            ELSE 5
          END
      `, [startDate.toISOString()]);

      charts.performance = {
        modelComparison: modelComparison.rows,
        hourlyActivity: hourlyActivity.rows,
        confidenceDistribution: confidenceDistribution.rows
      };
    }

    // 4. 실시간 지표 (최근 24시간)
    if (chartType === 'all' || chartType === 'realtime') {
      const last24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const realtimeMetrics = await pool.query(`
        SELECT 
          EXTRACT(HOUR FROM detection_time) as hour,
          COUNT(*) as defect_count,
          COUNT(DISTINCT schedule_id) as affected_schedules,
          AVG(confidence_score) as avg_confidence
        FROM defect_detections 
        WHERE detection_time >= $1
        GROUP BY EXTRACT(HOUR FROM detection_time)
        ORDER BY hour
      `, [last24Hours.toISOString()]);

      charts.realtime = {
        metrics: realtimeMetrics.rows,
        period: '24h'
      };
    }

    // 5. 품질 지표 요약
    const qualityMetrics = await pool.query(`
      SELECT 
        COUNT(DISTINCT s.id) as total_schedules_processed,
        COUNT(dd.id) as total_defects_found,
        ROUND(COUNT(dd.id)::numeric / NULLIF(COUNT(DISTINCT s.id), 0), 4) as defect_rate,
        ROUND(AVG(dd.confidence_score), 3) as avg_detection_confidence,
        COUNT(DISTINCT dd.defect_type) as unique_defect_types,
        COUNT(CASE WHEN dd.confidence_score >= 0.8 THEN 1 END) as high_confidence_detections
      FROM schedules s
      LEFT JOIN defect_detections dd ON s.id = dd.schedule_id AND dd.detection_time >= $1
      WHERE s.created_at >= $1
    `, [startDate.toISOString()]);

    return NextResponse.json({
      data: {
        charts,
        qualityMetrics: qualityMetrics.rows[0],
        period,
        chartType,
        generatedAt: new Date().toISOString(),
        dataRange: {
          startDate: startDate.toISOString(),
          endDate: now.toISOString()
        }
      }
    });

  } catch (error) {
    console.error('대시보드 차트 데이터 조회 오류:', error);
    return NextResponse.json(
      { error: '대시보드 차트 데이터 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 