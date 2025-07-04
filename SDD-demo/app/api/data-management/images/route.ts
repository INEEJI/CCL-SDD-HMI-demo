import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import pool from '@/lib/database/connection';
import { requireAuth, requireOperator } from '@/lib/auth-middleware';

// GET /api/data-management/images - 이미지 파일 목록 조회
export async function GET(request: NextRequest) {
  // 인증 확인 (모든 사용자 접근 가능)
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const scheduleId = searchParams.get('schedule_id');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const fileType = searchParams.get('file_type');
    const searchTerm = searchParams.get('search');

    let query = `
      SELECT 
        img.*,
        s.coil_id,
        c.name as customer_name,
        dd.defect_type,
        dd.confidence_score
      FROM image_files img
      LEFT JOIN schedules s ON img.schedule_id = s.id
      LEFT JOIN customers c ON s.customer_id = c.id
      LEFT JOIN defect_detections dd ON img.defect_detection_id = dd.id
      WHERE 1=1
    `;
    
    const params: any[] = [];
    let paramIndex = 1;

    if (scheduleId) {
      query += ` AND img.schedule_id = $${paramIndex}`;
      params.push(parseInt(scheduleId));
      paramIndex++;
    }

    if (dateFrom) {
      query += ` AND img.upload_time >= $${paramIndex}`;
      params.push(dateFrom);
      paramIndex++;
    }

    if (dateTo) {
      query += ` AND img.upload_time <= $${paramIndex}`;
      params.push(dateTo);
      paramIndex++;
    }

    if (fileType) {
      query += ` AND img.mime_type LIKE $${paramIndex}`;
      params.push(`${fileType}%`);
      paramIndex++;
    }

    if (searchTerm) {
      query += ` AND (img.original_filename ILIKE $${paramIndex} OR img.stored_filename ILIKE $${paramIndex} OR s.coil_id ILIKE $${paramIndex})`;
      params.push(`%${searchTerm}%`);
      paramIndex++;
    }

    query += ` ORDER BY img.upload_time DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, (page - 1) * limit);

    const result = await pool.query(query, params);

    // 전체 개수 조회
    let countQuery = `
      SELECT COUNT(*) 
      FROM image_files img
      LEFT JOIN schedules s ON img.schedule_id = s.id
      WHERE 1=1
    `;
    const countParams: any[] = [];
    let countParamIndex = 1;

    if (scheduleId) {
      countQuery += ` AND img.schedule_id = $${countParamIndex}`;
      countParams.push(parseInt(scheduleId));
      countParamIndex++;
    }

    if (dateFrom) {
      countQuery += ` AND img.upload_time >= $${countParamIndex}`;
      countParams.push(dateFrom);
      countParamIndex++;
    }

    if (dateTo) {
      countQuery += ` AND img.upload_time <= $${countParamIndex}`;
      countParams.push(dateTo);
      countParamIndex++;
    }

    if (fileType) {
      countQuery += ` AND img.mime_type LIKE $${countParamIndex}`;
      countParams.push(`${fileType}%`);
      countParamIndex++;
    }

    if (searchTerm) {
      countQuery += ` AND (img.original_filename ILIKE $${countParamIndex} OR img.stored_filename ILIKE $${countParamIndex} OR s.coil_id ILIKE $${countParamIndex})`;
      countParams.push(`%${searchTerm}%`);
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
    console.error('이미지 파일 목록 조회 중 오류:', error);
    return NextResponse.json(
      { error: '이미지 파일 목록 조회 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// POST /api/data-management/images - 이미지 파일 일괄 작업
export async function POST(request: NextRequest) {
  // 인증 확인 (검사원 이상 권한 필요)
  const authResult = await requireOperator(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body = await request.json();
    const { action, file_ids, parameters } = body;

    // 필수 필드 검증
    if (!action || !file_ids || !Array.isArray(file_ids) || file_ids.length === 0) {
      return NextResponse.json(
        { error: '작업 유형과 파일 ID 목록은 필수입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 작업 유형 검증
    const allowedActions = ['rename', 'move', 'delete', 'copy'];
    if (!allowedActions.includes(action)) {
      return NextResponse.json(
        { error: '지원되지 않는 작업 유형입니다.', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // 파일 정보 조회
    const fileQuery = `
      SELECT img.*, s.coil_id 
      FROM image_files img
      LEFT JOIN schedules s ON img.schedule_id = s.id
      WHERE img.id = ANY($1::int[])
    `;
    const fileResult = await pool.query(fileQuery, [file_ids]);

    if (fileResult.rows.length === 0) {
      return NextResponse.json(
        { error: '선택된 파일을 찾을 수 없습니다.', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    let results: any[] = [];

    // 작업 유형별 처리
    switch (action) {
      case 'rename':
        if (!parameters?.naming_pattern) {
          return NextResponse.json(
            { error: '파일명 패턴은 필수입니다.', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }
        results = await renameFiles(fileResult.rows, parameters.naming_pattern);
        break;

      case 'move':
        if (!parameters?.target_directory) {
          return NextResponse.json(
            { error: '대상 디렉토리는 필수입니다.', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }
        results = await moveFiles(fileResult.rows, parameters.target_directory);
        break;

      case 'delete':
        results = await deleteFiles(fileResult.rows);
        break;

      case 'copy':
        if (!parameters?.target_directory) {
          return NextResponse.json(
            { error: '대상 디렉토리는 필수입니다.', code: 'VALIDATION_ERROR' },
            { status: 400 }
          );
        }
        results = await copyFiles(fileResult.rows, parameters.target_directory);
        break;
    }

    const successCount = results.filter(r => r.success).length;
    const errorCount = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `작업 완료: 성공 ${successCount}개, 실패 ${errorCount}개`,
      data: {
        total: results.length,
        success: successCount,
        errors: errorCount,
        results: results
      }
    });

  } catch (error) {
    console.error('이미지 파일 일괄 작업 중 오류:', error);
    return NextResponse.json(
      { error: '이미지 파일 일괄 작업 중 오류가 발생했습니다.', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

// 파일명 변경 함수
async function renameFiles(files: any[], namingPattern: string): Promise<any[]> {
  const results = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      // 파일명 패턴 적용
      const newFilename = generateNewFilename(namingPattern, file, i + 1);
      const oldPath = file.file_path;
      const newPath = path.join(path.dirname(oldPath), newFilename);

      // 파일 시스템에서 파일명 변경 (개발 환경에서는 시뮬레이션)
      try {
        await fs.access(oldPath);
        await fs.rename(oldPath, newPath);
      } catch (fsError) {
        // 파일이 실제로 존재하지 않는 경우 데이터베이스만 업데이트
        console.warn(`파일이 존재하지 않음: ${oldPath}`);
      }

      // 데이터베이스 업데이트
      await pool.query(
        'UPDATE image_files SET stored_filename = $1, file_path = $2 WHERE id = $3',
        [newFilename, newPath, file.id]
      );

      results.push({
        success: true,
        file_id: file.id,
        old_filename: file.stored_filename,
        new_filename: newFilename
      });
    } catch (error) {
      results.push({
        success: false,
        file_id: file.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 파일 이동 함수
async function moveFiles(files: any[], targetDirectory: string): Promise<any[]> {
  const results = [];
  
  for (const file of files) {
    try {
      const oldPath = file.file_path;
      const newPath = path.join(targetDirectory, file.stored_filename);

      // 파일 이동 (개발 환경에서는 시뮬레이션)
      try {
        await fs.mkdir(targetDirectory, { recursive: true });
        await fs.access(oldPath);
        await fs.rename(oldPath, newPath);
      } catch (fsError) {
        console.warn(`파일 이동 실패: ${oldPath} -> ${newPath}`);
      }

      // 데이터베이스 업데이트
      await pool.query(
        'UPDATE image_files SET file_path = $1 WHERE id = $2',
        [newPath, file.id]
      );

      results.push({
        success: true,
        file_id: file.id,
        old_path: oldPath,
        new_path: newPath
      });
    } catch (error) {
      results.push({
        success: false,
        file_id: file.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 파일 삭제 함수
async function deleteFiles(files: any[]): Promise<any[]> {
  const results = [];
  
  for (const file of files) {
    try {
      // 파일 시스템에서 파일 삭제 (개발 환경에서는 시뮬레이션)
      try {
        await fs.access(file.file_path);
        await fs.unlink(file.file_path);
      } catch (fsError) {
        console.warn(`파일 삭제 실패: ${file.file_path}`);
      }

      // 데이터베이스에서 레코드 삭제
      await pool.query('DELETE FROM image_files WHERE id = $1', [file.id]);

      results.push({
        success: true,
        file_id: file.id,
        deleted_file: file.stored_filename
      });
    } catch (error) {
      results.push({
        success: false,
        file_id: file.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 파일 복사 함수
async function copyFiles(files: any[], targetDirectory: string): Promise<any[]> {
  const results = [];
  
  for (const file of files) {
    try {
      const sourcePath = file.file_path;
      const targetPath = path.join(targetDirectory, file.stored_filename);

      // 파일 복사 (개발 환경에서는 시뮬레이션)
      try {
        await fs.mkdir(targetDirectory, { recursive: true });
        await fs.access(sourcePath);
        await fs.copyFile(sourcePath, targetPath);
      } catch (fsError) {
        console.warn(`파일 복사 실패: ${sourcePath} -> ${targetPath}`);
      }

      // 새 파일 정보를 데이터베이스에 추가
      const newFileQuery = `
        INSERT INTO image_files (
          original_filename, stored_filename, file_path, file_size, 
          mime_type, schedule_id, defect_detection_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      
      const newFileResult = await pool.query(newFileQuery, [
        file.original_filename,
        file.stored_filename,
        targetPath,
        file.file_size,
        file.mime_type,
        file.schedule_id,
        file.defect_detection_id
      ]);

      results.push({
        success: true,
        original_file_id: file.id,
        new_file_id: newFileResult.rows[0].id,
        copied_to: targetPath
      });
    } catch (error) {
      results.push({
        success: false,
        file_id: file.id,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  return results;
}

// 새 파일명 생성 함수
function generateNewFilename(pattern: string, file: any, index: number): string {
  const now = new Date();
  const ext = path.extname(file.stored_filename);
  
  return pattern
    .replace('{index}', index.toString().padStart(3, '0'))
    .replace('{coil_id}', file.coil_id || 'unknown')
    .replace('{date}', now.toISOString().split('T')[0])
    .replace('{time}', now.toTimeString().split(' ')[0].replace(/:/g, ''))
    .replace('{original}', path.basename(file.original_filename, ext))
    + ext;
} 