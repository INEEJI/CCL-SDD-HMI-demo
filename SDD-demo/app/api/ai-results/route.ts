import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/database/connection';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { requireAuth } from '@/lib/auth-middleware';

// POST /api/ai-results - AI 모델 서버로부터 결함 검출 결과 수신
// 참고: 이 API는 외부 AI 서버에서 호출하므로 별도의 API 키 인증이 필요할 수 있습니다.
export async function POST(request: NextRequest) {
  // TODO: 외부 AI 서버 인증 로직 추가 (API 키 또는 특별한 인증 방식)
  // 현재는 내부 테스트를 위해 일반 인증 사용
  try {
    const body = await request.json();
    const {
      scheduleId,
      modelId,
      originalImagePath,
      labeledImageBase64,
      labeledImageFilename,
      detections // 여러 결함이 한 이미지에서 검출될 수 있음
    } = body;

    // 필수 필드 검증
    if (!scheduleId || !detections || !Array.isArray(detections)) {
      return NextResponse.json(
        { error: '스케줄 ID와 결함 검출 결과는 필수입니다.' },
        { status: 400 }
      );
    }

    // 트랜잭션 시작
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 라벨링된 이미지 저장 (Base64로 전달된 경우)
      let labeledImagePath = null;
      if (labeledImageBase64 && labeledImageFilename) {
        const uploadsDir = path.join(process.cwd(), 'public/images/labeled');
        await mkdir(uploadsDir, { recursive: true });
        
        const buffer = Buffer.from(labeledImageBase64, 'base64');
        const filename = `${Date.now()}_${labeledImageFilename}`;
        const filepath = path.join(uploadsDir, filename);
        
        await writeFile(filepath, buffer);
        labeledImagePath = `/images/labeled/${filename}`;
      }

      // 이미지 파일 정보 저장
      let imageFileId = null;
      if (labeledImagePath) {
        const imageQuery = `
          INSERT INTO image_files (
            original_filename, stored_filename, file_path, file_size, 
            mime_type, schedule_id, upload_time
          )
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
          RETURNING id
        `;
        
        const imageResult = await client.query(imageQuery, [
          labeledImageFilename,
          path.basename(labeledImagePath),
          labeledImagePath,
          Buffer.from(labeledImageBase64, 'base64').length,
          'image/jpeg',
          scheduleId
        ]);
        
        imageFileId = imageResult.rows[0].id;
      }

      // 각 결함 검출 결과 저장
      const savedDetections = [];
      for (const detection of detections) {
        const {
          defectType,
          defectSizeWidth,
          defectSizeHeight,
          defectPositionX,
          defectPositionY,
          defectPositionMeter,
          confidenceScore,
          detectionTime
        } = detection;

        const detectionQuery = `
          INSERT INTO defect_detections (
            schedule_id, model_id, defect_type, defect_size_width, defect_size_height,
            defect_position_x, defect_position_y, defect_position_meter, 
            confidence_score, image_path, detection_time
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;
        
        const detectionResult = await client.query(detectionQuery, [
          scheduleId,
          modelId,
          defectType,
          defectSizeWidth,
          defectSizeHeight,
          defectPositionX,
          defectPositionY,
          defectPositionMeter,
          confidenceScore,
          labeledImagePath,
          detectionTime || new Date().toISOString()
        ]);

        // 이미지 파일과 결함 검출 결과 연결
        if (imageFileId) {
          await client.query(
            'UPDATE image_files SET defect_detection_id = $1 WHERE id = $2',
            [detectionResult.rows[0].id, imageFileId]
          );
        }

        savedDetections.push(detectionResult.rows[0]);
      }

      await client.query('COMMIT');

      return NextResponse.json({
        message: '결함 검출 결과가 성공적으로 저장되었습니다.',
        data: {
          imageFileId,
          detections: savedDetections,
          labeledImagePath
        }
      }, { status: 201 });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('AI 결과 저장 오류:', error);
    return NextResponse.json(
      { error: 'AI 결과 저장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// GET /api/ai-results - AI 모델 처리 상태 조회
export async function GET(request: NextRequest) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get('scheduleId');
    const modelId = searchParams.get('modelId');
    const limit = parseInt(searchParams.get('limit') || '10');

    let query = `
      SELECT 
        dd.*,
        s.coil_id,
        am.model_name,
        am.version,
        if.file_path as image_path,
        if.original_filename
      FROM defect_detections dd
      LEFT JOIN schedules s ON dd.schedule_id = s.id
      LEFT JOIN ai_models am ON dd.model_id = am.id
      LEFT JOIN image_files if ON dd.id = if.defect_detection_id
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (scheduleId) {
      query += ` AND dd.schedule_id = $${params.length + 1}`;
      params.push(scheduleId);
    }

    if (modelId) {
      query += ` AND dd.model_id = $${params.length + 1}`;
      params.push(modelId);
    }

    query += ` ORDER BY dd.detection_time DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return NextResponse.json({
      data: result.rows,
      count: result.rows.length
    });

  } catch (error) {
    console.error('AI 결과 조회 오류:', error);
    return NextResponse.json(
      { error: 'AI 결과 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
} 