import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';

// GET /api/models/[id]/metrics - 모델 성능 지표 조회
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

    // 모델 기본 정보 조회
    const modelQuery = `
      SELECT 
        am.*,
        u.username as created_by_name
      FROM ai_models am
      LEFT JOIN users u ON am.created_by = u.id
      WHERE am.id = $1
    `;

    const modelResult = await pool.query(modelQuery, [modelId]);

    if (modelResult.rows.length === 0) {
      return NextResponse.json(
        { error: '모델을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const model = modelResult.rows[0];

    // 실제 검출 결과 기반 성능 지표 계산
    const performanceQuery = `
      SELECT 
        defect_type,
        COUNT(*) as total_detections,
        AVG(confidence_score) as avg_confidence,
        MIN(confidence_score) as min_confidence,
        MAX(confidence_score) as max_confidence,
        COUNT(CASE WHEN confidence_score >= 0.8 THEN 1 END) as high_confidence_count,
        COUNT(CASE WHEN confidence_score >= 0.6 AND confidence_score < 0.8 THEN 1 END) as medium_confidence_count,
        COUNT(CASE WHEN confidence_score < 0.6 THEN 1 END) as low_confidence_count
      FROM defect_detections
      WHERE model_id = $1
      GROUP BY defect_type
      ORDER BY total_detections DESC
    `;

    const performanceResult = await pool.query(performanceQuery, [modelId]);

    // 시간대별 성능 추이 (최근 30일)
    const trendQuery = `
      SELECT 
        DATE(detection_time) as date,
        COUNT(*) as detection_count,
        AVG(confidence_score) as avg_confidence,
        COUNT(DISTINCT defect_type) as defect_types_count
      FROM defect_detections
      WHERE model_id = $1 
        AND detection_time >= NOW() - INTERVAL '30 days'
      GROUP BY DATE(detection_time)
      ORDER BY date DESC
    `;

    const trendResult = await pool.query(trendQuery, [modelId]);

    // 전체 통계
    const statsQuery = `
      SELECT 
        COUNT(*) as total_detections,
        COUNT(DISTINCT defect_type) as unique_defect_types,
        AVG(confidence_score) as overall_avg_confidence,
        MIN(detection_time) as first_detection,
        MAX(detection_time) as last_detection
      FROM defect_detections
      WHERE model_id = $1
    `;

    const statsResult = await pool.query(statsQuery, [modelId]);

    // 결함 유형별 분포
    const distributionQuery = `
      SELECT 
        defect_type,
        COUNT(*) as count,
        ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
      FROM defect_detections
      WHERE model_id = $1
      GROUP BY defect_type
      ORDER BY count DESC
    `;

    const distributionResult = await pool.query(distributionQuery, [modelId]);

    return NextResponse.json({
      success: true,
      data: {
        model: model,
        performance_by_defect_type: performanceResult.rows,
        performance_trend: trendResult.rows,
        overall_statistics: statsResult.rows[0],
        defect_type_distribution: distributionResult.rows,
        metrics_summary: {
          total_detections: parseInt(statsResult.rows[0]?.total_detections || '0'),
          accuracy_score: model.accuracy_score,
          avg_confidence: parseFloat(statsResult.rows[0]?.overall_avg_confidence || '0'),
          active_days: trendResult.rows.length,
          defect_types_covered: parseInt(statsResult.rows[0]?.unique_defect_types || '0')
        }
      }
    });

  } catch (error) {
    console.error('모델 성능 지표 조회 오류:', error);
    return NextResponse.json(
      { error: '모델 성능 지표 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/models/[id]/metrics - 모델 성능 지표 업데이트
export async function POST(
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
      accuracy_score
    } = body;

    // 모델 존재 확인
    const modelCheck = await pool.query(
      'SELECT id FROM ai_models WHERE id = $1',
      [modelId]
    );

    if (modelCheck.rows.length === 0) {
      return NextResponse.json(
        { error: '모델을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 성능 지표 업데이트
    const updateQuery = `
      UPDATE ai_models 
      SET 
        accuracy_score = COALESCE($1, accuracy_score),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      accuracy_score,
      modelId
    ]);

    return NextResponse.json({
      success: true,
      message: '모델 성능 지표가 성공적으로 업데이트되었습니다.',
      data: updateResult.rows[0]
    });

  } catch (error) {
    console.error('모델 성능 지표 업데이트 오류:', error);
    return NextResponse.json(
      { error: '모델 성능 지표 업데이트 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// PUT /api/models/[id]/metrics - 모델 성능 벤치마크 실행
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

    // 모델 존재 확인
    const modelCheck = await pool.query(
      'SELECT * FROM ai_models WHERE id = $1',
      [modelId]
    );

    if (modelCheck.rows.length === 0) {
      return NextResponse.json(
        { error: '모델을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 최근 검출 결과를 기반으로 성능 지표 재계산
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_detections,
        AVG(confidence_score) as avg_confidence,
        STDDEV(confidence_score) as confidence_stddev,
        COUNT(CASE WHEN confidence_score >= 0.9 THEN 1 END) as excellent_detections,
        COUNT(CASE WHEN confidence_score >= 0.8 THEN 1 END) as good_detections,
        COUNT(CASE WHEN confidence_score >= 0.6 THEN 1 END) as fair_detections,
        COUNT(CASE WHEN confidence_score < 0.6 THEN 1 END) as poor_detections
      FROM defect_detections
      WHERE model_id = $1
        AND detection_time >= NOW() - INTERVAL '7 days'
    `;

    const metricsResult = await pool.query(metricsQuery, [modelId]);
    const metrics = metricsResult.rows[0];

    // 성능 점수 계산 (가중 평균)
    const totalDetections = parseInt(metrics.total_detections || '0');
    let performanceScore = 0;

    if (totalDetections > 0) {
      const excellentWeight = 1.0;
      const goodWeight = 0.8;
      const fairWeight = 0.6;
      const poorWeight = 0.3;

      const weightedScore = (
        (parseInt(metrics.excellent_detections) * excellentWeight) +
        (parseInt(metrics.good_detections) * goodWeight) +
        (parseInt(metrics.fair_detections) * fairWeight) +
        (parseInt(metrics.poor_detections) * poorWeight)
      ) / totalDetections;

      performanceScore = Math.round(weightedScore * 10000) / 10000; // 소수점 4자리
    }

    // 모델 성능 점수 업데이트
    const updateQuery = `
      UPDATE ai_models 
      SET 
        accuracy_score = $1,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const updateResult = await pool.query(updateQuery, [
      performanceScore,
      modelId
    ]);

    return NextResponse.json({
      success: true,
      message: '모델 성능 벤치마크가 완료되었습니다.',
      data: {
        model: updateResult.rows[0],
        benchmark_results: {
          total_detections: totalDetections,
          avg_confidence: parseFloat(metrics.avg_confidence || '0'),
          confidence_stddev: parseFloat(metrics.confidence_stddev || '0'),
          performance_score: performanceScore,
          excellent_detections: parseInt(metrics.excellent_detections || '0'),
          good_detections: parseInt(metrics.good_detections || '0'),
          fair_detections: parseInt(metrics.fair_detections || '0'),
          poor_detections: parseInt(metrics.poor_detections || '0'),
          benchmark_period: '최근 7일'
        }
      }
    });

  } catch (error) {
    console.error('모델 성능 벤치마크 오류:', error);
    return NextResponse.json(
      { error: '모델 성능 벤치마크 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 