import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import pool from '@/lib/database/connection';
import { requireAdmin } from '@/lib/auth-middleware';

// POST /api/models/upload - AI 모델 파일 업로드
export async function POST(request: NextRequest) {
  // 인증 확인 (관리자 권한 필요)
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const modelName = formData.get('modelName') as string;
    const version = formData.get('version') as string;
    const modelType = formData.get('modelType') as string;
    const description = formData.get('description') as string;
    const accuracyScore = formData.get('accuracyScore') as string;

    // 필수 필드 검증
    if (!file || !modelName || !version || !modelType) {
      return NextResponse.json(
        { error: '파일, 모델명, 버전, 타입은 필수입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 파일 크기 제한 (100MB)
    const maxFileSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxFileSize) {
      return NextResponse.json(
        { error: '파일 크기는 100MB를 초과할 수 없습니다.', code: 'FILE_TOO_LARGE' },
        { status: 400 }
      );
    }

    // 파일 확장자 검증
    const allowedExtensions = ['.pth', '.pt', '.onnx', '.h5', '.pb', '.tflite', '.pkl'];
    const fileExtension = path.extname(file.name).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: '지원되지 않는 파일 형식입니다. (.pth, .pt, .onnx, .h5, .pb, .tflite, .pkl 만 허용)', code: 'INVALID_FILE_TYPE' },
        { status: 400 }
      );
    }

    // 동일한 모델명과 버전이 이미 존재하는지 확인
    const existingModel = await pool.query(
      'SELECT id FROM ai_models WHERE model_name = $1 AND version = $2',
      [modelName, version]
    );

    if (existingModel.rows.length > 0) {
      return NextResponse.json(
        { error: '동일한 모델명과 버전이 이미 존재합니다.', code: 'DUPLICATE_MODEL' },
        { status: 409 }
      );
    }

    // 업로드 디렉토리 생성
    const uploadDir = path.join(process.cwd(), 'uploads', 'models');
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true });
    }

    // 파일 내용 읽기
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // 파일 체크섬 생성
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // 고유한 파일명 생성
    const timestamp = Date.now();
    const sanitizedModelName = modelName.replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedVersion = version.replace(/[^a-zA-Z0-9.]/g, '_');
    const fileName = `${sanitizedModelName}_v${sanitizedVersion}_${timestamp}${fileExtension}`;
    const filePath = path.join(uploadDir, fileName);

    // 파일 저장
    await writeFile(filePath, buffer);

    // 데이터베이스에 모델 정보 저장
    const insertQuery = `
      INSERT INTO ai_models (
        model_name, version, model_type, file_path, file_size, 
        checksum, description, accuracy_score, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      modelName,
      version,
      modelType,
      filePath,
      file.size,
      checksum,
      description || null,
      accuracyScore ? parseFloat(accuracyScore) : null,
      user.id
    ]);

    // 생성된 모델 정보 조회 (생성자 정보 포함)
    const selectQuery = `
      SELECT am.*, u.username as created_by_name
      FROM ai_models am
      LEFT JOIN users u ON am.created_by = u.id
      WHERE am.id = $1
    `;

    const selectResult = await pool.query(selectQuery, [result.rows[0].id]);

    return NextResponse.json({
      success: true,
      message: 'AI 모델이 성공적으로 업로드되었습니다.',
      data: selectResult.rows[0]
    }, { status: 201 });

  } catch (error) {
    console.error('모델 업로드 오류:', error);
    return NextResponse.json(
      { error: '모델 업로드 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// GET /api/models/upload - 업로드 상태 및 정보 조회
export async function GET(request: NextRequest) {
  // 인증 확인 (관리자 권한 필요)
  const authResult = await requireAdmin(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    // 업로드 디렉토리 정보
    const uploadDir = path.join(process.cwd(), 'uploads', 'models');
    const uploadDirExists = existsSync(uploadDir);

    // 지원되는 파일 형식
    const supportedFormats = [
      { extension: '.pth', description: 'PyTorch 모델' },
      { extension: '.pt', description: 'PyTorch 모델' },
      { extension: '.onnx', description: 'ONNX 모델' },
      { extension: '.h5', description: 'Keras/TensorFlow 모델' },
      { extension: '.pb', description: 'TensorFlow SavedModel' },
      { extension: '.tflite', description: 'TensorFlow Lite 모델' },
      { extension: '.pkl', description: 'Pickle 모델' }
    ];

    // 최근 업로드된 모델들
    const recentModels = await pool.query(`
      SELECT 
        am.id,
        am.model_name,
        am.version,
        am.model_type,
        am.file_size,
        am.accuracy_score,
        am.created_at,
        u.username as created_by_name
      FROM ai_models am
      LEFT JOIN users u ON am.created_by = u.id
      ORDER BY am.created_at DESC
      LIMIT 10
    `);

    return NextResponse.json({
      success: true,
      data: {
        uploadDirectory: uploadDir,
        uploadDirectoryExists: uploadDirExists,
        supportedFormats,
        maxFileSize: '100MB',
        recentUploads: recentModels.rows
      }
    });

  } catch (error) {
    console.error('업로드 정보 조회 오류:', error);
    return NextResponse.json(
      { error: '업로드 정보 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
} 