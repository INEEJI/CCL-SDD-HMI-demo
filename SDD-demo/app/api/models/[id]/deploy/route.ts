import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { requireAuth, requireAdmin } from '@/lib/auth-middleware';

// PUT /api/models/[id]/deploy - 모델 배포/해제
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
    const { deploy } = body; // true: 배포, false: 배포 해제

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 배포하는 경우, 기존 배포된 모델들을 먼저 해제
      if (deploy) {
        await client.query(
          'UPDATE ai_models SET is_deployed = false WHERE is_deployed = true'
        );
      }

      // 해당 모델의 배포 상태 변경
      const result = await client.query(
        'UPDATE ai_models SET is_deployed = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
        [deploy, modelId]
      );
      
      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: '모델을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        message: deploy ? '모델이 성공적으로 배포되었습니다.' : '모델 배포가 해제되었습니다.',
        data: result.rows[0]
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('모델 배포 오류:', error);
    return NextResponse.json(
      { error: '모델 배포 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET /api/models/[id]/deploy - 현재 배포된 모델 상태 조회
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
      SELECT 
        am.*,
        u.username as created_by_name,
        COUNT(dd.id) as usage_count
      FROM ai_models am
      LEFT JOIN users u ON am.created_by = u.id
      LEFT JOIN defect_detections dd ON am.id = dd.model_id
      WHERE am.id = $1
      GROUP BY am.id, u.username
    `;
    
    const result = await pool.query(query, [modelId]);
    
    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: '모델을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    const model = result.rows[0];

    // 최근 검출 결과 조회
    const recentDetections = await pool.query(
      `SELECT detection_time, defect_type, confidence_score 
       FROM defect_detections 
       WHERE model_id = $1 
       ORDER BY detection_time DESC 
       LIMIT 5`,
      [modelId]
    );

    return NextResponse.json({
      data: {
        ...model,
        recent_detections: recentDetections.rows
      }
    });
  } catch (error) {
    console.error('모델 배포 상태 조회 오류:', error);
    return NextResponse.json(
      { error: '모델 배포 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 