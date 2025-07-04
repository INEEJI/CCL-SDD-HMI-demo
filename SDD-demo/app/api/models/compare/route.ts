import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth } from '@/lib/auth-middleware';

// POST /api/models/compare - 모델 성능 비교
export async function POST(request: NextRequest) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { model_ids, comparison_period = 30 } = body;

    // 모델 ID 검증
    if (!model_ids || !Array.isArray(model_ids) || model_ids.length < 2) {
      return NextResponse.json(
        { error: '비교할 모델을 2개 이상 선택해주세요.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    if (model_ids.length > 5) {
      return NextResponse.json(
        { error: '최대 5개의 모델까지만 비교할 수 있습니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 모델 기본 정보 조회
    const modelsQuery = `
      SELECT 
        am.id,
        am.model_name,
        am.version,
        am.model_type,
        am.accuracy_score,
        am.file_size,
        am.is_deployed,
        am.created_at,
        u.username as created_by_name
      FROM ai_models am
      LEFT JOIN users u ON am.created_by = u.id
      WHERE am.id = ANY($1)
      ORDER BY am.created_at DESC
    `;

    const modelsResult = await pool.query(modelsQuery, [model_ids]);

    if (modelsResult.rows.length !== model_ids.length) {
      return NextResponse.json(
        { error: '일부 모델을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const models = modelsResult.rows;

    // 각 모델의 성능 지표 계산
    const performanceData = await Promise.all(
      model_ids.map(async (modelId) => {
        // 기본 성능 통계
        const statsQuery = `
          SELECT 
            COUNT(*) as total_detections,
            AVG(confidence_score) as avg_confidence,
            STDDEV(confidence_score) as confidence_stddev,
            MIN(confidence_score) as min_confidence,
            MAX(confidence_score) as max_confidence,
            COUNT(DISTINCT defect_type) as unique_defect_types,
            COUNT(CASE WHEN confidence_score >= 0.8 THEN 1 END) as high_confidence_count,
            COUNT(CASE WHEN confidence_score >= 0.6 AND confidence_score < 0.8 THEN 1 END) as medium_confidence_count,
            COUNT(CASE WHEN confidence_score < 0.6 THEN 1 END) as low_confidence_count
          FROM defect_detections
          WHERE model_id = $1
            AND detection_time >= NOW() - INTERVAL '${comparison_period} days'
        `;

        const statsResult = await pool.query(statsQuery, [modelId]);

        // 결함 유형별 성능
        const defectTypeQuery = `
          SELECT 
            defect_type,
            COUNT(*) as count,
            AVG(confidence_score) as avg_confidence,
            ROUND((COUNT(*) * 100.0 / SUM(COUNT(*)) OVER()), 2) as percentage
          FROM defect_detections
          WHERE model_id = $1
            AND detection_time >= NOW() - INTERVAL '${comparison_period} days'
          GROUP BY defect_type
          ORDER BY count DESC
        `;

        const defectTypeResult = await pool.query(defectTypeQuery, [modelId]);

        // 일별 성능 추이
        const dailyTrendQuery = `
          SELECT 
            DATE(detection_time) as date,
            COUNT(*) as detection_count,
            AVG(confidence_score) as avg_confidence
          FROM defect_detections
          WHERE model_id = $1
            AND detection_time >= NOW() - INTERVAL '${comparison_period} days'
          GROUP BY DATE(detection_time)
          ORDER BY date DESC
        `;

        const dailyTrendResult = await pool.query(dailyTrendQuery, [modelId]);

        return {
          model_id: modelId,
          statistics: statsResult.rows[0],
          defect_type_performance: defectTypeResult.rows,
          daily_trend: dailyTrendResult.rows
        };
      })
    );

    // 비교 결과 생성
    const comparison = {
      models: models,
      performance_data: performanceData,
      comparison_period: comparison_period,
      comparison_summary: {
        best_accuracy: models.reduce((best: any, model: any) => 
          (model.accuracy_score || 0) > (best.accuracy_score || 0) ? model : best
        ),
        most_active: performanceData.reduce((most: any, data: any) => 
          parseInt(data.statistics.total_detections || '0') > parseInt(most.statistics.total_detections || '0') ? data : most
        ),
        highest_confidence: performanceData.reduce((highest: any, data: any) => 
          parseFloat(data.statistics.avg_confidence || '0') > parseFloat(highest.statistics.avg_confidence || '0') ? data : highest
        ),
        most_consistent: performanceData.reduce((consistent: any, data: any) => 
          parseFloat(data.statistics.confidence_stddev || '999') < parseFloat(consistent.statistics.confidence_stddev || '999') ? data : consistent
        )
      }
    };

    return NextResponse.json({
      success: true,
      data: comparison
    });

  } catch (error) {
    console.error('모델 비교 오류:', error);
    return NextResponse.json(
      { error: '모델 비교 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// GET /api/models/compare - 비교 가능한 모델 목록 조회
export async function GET(request: NextRequest) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // 활성화된 모델 목록 조회
    const modelsQuery = `
      SELECT 
        am.id,
        am.model_name,
        am.version,
        am.model_type,
        am.accuracy_score,
        am.is_deployed,
        am.created_at,
        u.username as created_by_name,
        COUNT(dd.id) as detection_count
      FROM ai_models am
      LEFT JOIN users u ON am.created_by = u.id
      LEFT JOIN defect_detections dd ON am.id = dd.model_id
      WHERE am.is_active = true
      GROUP BY am.id, u.username
      ORDER BY am.created_at DESC
    `;

    const modelsResult = await pool.query(modelsQuery);

    // 모델 타입별 그룹화
    const modelsByType = modelsResult.rows.reduce((acc: any, model: any) => {
      const type = model.model_type || 'unknown';
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(model);
      return acc;
    }, {} as Record<string, any[]>);

    // 추천 비교 조합 생성
    const recommendedComparisons: any[] = [];

    // 같은 타입의 모델들 중에서 추천
    Object.entries(modelsByType).forEach(([type, models]) => {
      const modelArray = models as any[];
      if (modelArray.length >= 2) {
        // 정확도 기준으로 상위 모델들
        const sortedByAccuracy = modelArray
          .sort((a: any, b: any) => (b.accuracy_score || 0) - (a.accuracy_score || 0))
          .slice(0, 3);

        if (sortedByAccuracy.length >= 2) {
          recommendedComparisons.push({
            title: `${type} 모델 정확도 비교`,
            description: `${type} 타입 모델들의 정확도를 비교합니다.`,
            model_ids: sortedByAccuracy.map((m: any) => m.id),
            models: sortedByAccuracy
          });
        }
      }
    });

    // 배포된 모델 vs 대기 중인 모델
    const deployedModels = modelsResult.rows.filter((m: any) => m.is_deployed);
    const pendingModels = modelsResult.rows.filter((m: any) => !m.is_deployed);

    if (deployedModels.length >= 1 && pendingModels.length >= 1) {
      recommendedComparisons.push({
        title: '배포된 모델 vs 대기 중인 모델',
        description: '현재 배포된 모델과 대기 중인 모델의 성능을 비교합니다.',
        model_ids: [
          ...deployedModels.slice(0, 2).map((m: any) => m.id),
          ...pendingModels.slice(0, 2).map((m: any) => m.id)
        ],
        models: [
          ...deployedModels.slice(0, 2),
          ...pendingModels.slice(0, 2)
        ]
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        available_models: modelsResult.rows,
        models_by_type: modelsByType,
        recommended_comparisons: recommendedComparisons,
        comparison_options: {
          max_models: 5,
          min_models: 2,
          available_periods: [7, 14, 30, 60, 90]
        }
      }
    });

  } catch (error) {
    console.error('비교 가능한 모델 목록 조회 오류:', error);
    return NextResponse.json(
      { error: '비교 가능한 모델 목록 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 