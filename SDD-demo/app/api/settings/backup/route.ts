import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/database/connection'
import { 
  PermissionHelpers, 
  logPermissionAction,
  BACKUP_PERMISSIONS 
} from '@/lib/middleware/permissions'

// 데이터베이스 설정 행 타입 정의
interface SettingRow {
  category: string;
  key: string;
  value: string;
  description: string;
  data_type: string;
  created_at: string;
  updated_at: string;
}

// 백업 목록 행 타입 정의
interface BackupRow {
  backup_id: string;
  description: string;
  created_at: string;
  settings_count: number;
  categories: string[];
}

// 에러 타입 정의
interface BackupError extends Error {
  code?: string;
  details?: unknown;
}

// 백업 유효성 검증
function validateBackupData(settings: SettingRow[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!Array.isArray(settings)) {
    errors.push('설정 데이터가 배열 형태가 아닙니다.');
    return { isValid: false, errors };
  }
  
  if (settings.length === 0) {
    errors.push('백업할 설정이 없습니다.');
    return { isValid: false, errors };
  }
  
  // 필수 필드 검증
  settings.forEach((setting, index) => {
    if (!setting.category || typeof setting.category !== 'string') {
      errors.push(`설정 ${index + 1}: 카테고리가 유효하지 않습니다.`);
    }
    if (!setting.key || typeof setting.key !== 'string') {
      errors.push(`설정 ${index + 1}: 키가 유효하지 않습니다.`);
    }
    if (setting.value === null || setting.value === undefined) {
      errors.push(`설정 ${index + 1}: 값이 유효하지 않습니다.`);
    }
  });
  
  return { isValid: errors.length === 0, errors };
}

// 설정 백업 생성
export async function POST(request: NextRequest) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessBackup('create')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '백업 생성 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    // 데이터베이스 연결 확인
    await connection.query('SELECT 1');
    
    // 모든 설정 카테고리 조회
    const query = `
      SELECT category, key, value, description, data_type, created_at, updated_at
      FROM system_settings 
      ORDER BY category, key
    `;
    
    const result = await connection.query(query);
    const settings = result.rows as SettingRow[];
    
    // 백업 데이터 유효성 검증
    const validation = validateBackupData(settings);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: '백업 데이터 유효성 검증 실패',
        details: validation.errors
      }, { status: 400 });
    }
    
    // 백업 메타데이터 생성
    const backupData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      description: 'CCL SDD 시스템 설정 백업',
      systemInfo: {
        hostname: process.env.HOSTNAME || 'unknown',
        nodeVersion: process.version,
        platform: process.platform
      },
      settingsCount: settings.length,
      categories: [...new Set(settings.map((s: SettingRow) => s.category))],
      settings: settings.reduce((acc: Record<string, Record<string, {
        value: string;
        description: string;
        dataType: string;
        updatedAt: string;
      }>>, setting: SettingRow) => {
        if (!acc[setting.category]) {
          acc[setting.category] = {};
        }
        acc[setting.category][setting.key] = {
          value: setting.value,
          description: setting.description,
          dataType: setting.data_type,
          updatedAt: setting.updated_at
        };
        return acc;
      }, {})
    };

    // 백업 ID 생성 (중복 방지)
    const backupId = `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 백업 이력 저장 (트랜잭션 사용)
    await connection.query('BEGIN');
    
    try {
      const insertBackupQuery = `
        INSERT INTO setting_backups (backup_id, backup_data, created_at, description)
        VALUES ($1, $2, NOW(), $3)
      `;
      
      await connection.query(insertBackupQuery, [
        backupId,
        JSON.stringify(backupData),
        `자동 백업 - ${new Date().toLocaleString('ko-KR')}`
      ]);
      
      // 백업 저장 확인
      const verifyQuery = `SELECT backup_id FROM setting_backups WHERE backup_id = $1`;
      const verifyResult = await connection.query(verifyQuery, [backupId]);
      
      if (verifyResult.rows.length === 0) {
        throw new Error('백업 저장 확인에 실패했습니다.');
      }
      
      await connection.query('COMMIT');
      
      // 권한 감사 로그 기록
      if (permissionCheck.user) {
        await logPermissionAction(
          permissionCheck.user.id,
          BACKUP_PERMISSIONS.create,
          'granted',
          { 
            backup_id: backupId,
            settings_count: settings.length,
            categories: backupData.categories
          },
          request
        );
      }
      
      return NextResponse.json({
        success: true,
        data: {
          backupId,
          backup: backupData
        },
        message: '설정 백업이 성공적으로 생성되었습니다.'
      });
      
    } catch (dbError) {
      await connection.query('ROLLBACK');
      throw dbError;
    }

  } catch (error) {
    const backupError = error as BackupError;
    console.error('설정 백업 생성 오류:', {
      message: backupError.message,
      code: backupError.code,
      stack: backupError.stack
    });
    
    // 에러 타입별 응답
    if (backupError.message?.includes('connection')) {
      return NextResponse.json({
        success: false,
        error: '데이터베이스 연결에 실패했습니다.',
        code: 'DB_CONNECTION_ERROR'
      }, { status: 503 });
    }
    
    if (backupError.message?.includes('timeout')) {
      return NextResponse.json({
        success: false,
        error: '백업 처리 시간이 초과되었습니다.',
        code: 'TIMEOUT_ERROR'
      }, { status: 408 });
    }
    
    return NextResponse.json({
      success: false,
      error: '설정 백업 생성에 실패했습니다.',
      code: 'BACKUP_CREATION_ERROR',
      details: process.env.NODE_ENV === 'development' ? backupError.message : undefined
    }, { status: 500 });
  }
}

// 백업 목록 조회
export async function GET(request: NextRequest) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessBackup('list')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '백업 목록 조회 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100); // 최대 100개
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0);
    
    // 데이터베이스 연결 확인
    await connection.query('SELECT 1');
    
    const query = `
      SELECT backup_id, description, created_at,
             (backup_data->>'settingsCount')::int as settings_count,
             backup_data->'categories' as categories,
             pg_size_pretty(length(backup_data::text)) as backup_size
      FROM setting_backups 
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await connection.query(query, [limit, offset]);
    
    if (!result.rows) {
      return NextResponse.json({
        success: false,
        error: '백업 목록 조회 결과가 없습니다.',
        code: 'NO_RESULTS'
      }, { status: 404 });
    }
    
    const backups = result.rows.map((row: BackupRow & { backup_size: string }) => ({
      id: row.backup_id,
      description: row.description,
      createdAt: row.created_at,
      settingsCount: row.settings_count,
      categories: row.categories,
      backupSize: row.backup_size
    }));
    
    // 총 백업 개수 조회
    const countQuery = `SELECT COUNT(*) as total FROM setting_backups`;
    const countResult = await connection.query(countQuery);
    const totalCount = parseInt(countResult.rows[0].total);

    return NextResponse.json({
      success: true,
      data: backups,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount
      }
    });

  } catch (error) {
    const backupError = error as BackupError;
    console.error('백업 목록 조회 오류:', {
      message: backupError.message,
      code: backupError.code,
      stack: backupError.stack
    });
    
    // 에러 타입별 응답
    if (backupError.message?.includes('connection')) {
      return NextResponse.json({
        success: false,
        error: '데이터베이스 연결에 실패했습니다.',
        code: 'DB_CONNECTION_ERROR'
      }, { status: 503 });
    }
    
    return NextResponse.json({
      success: false,
      error: '백업 목록 조회에 실패했습니다.',
      code: 'BACKUP_LIST_ERROR',
      details: process.env.NODE_ENV === 'development' ? backupError.message : undefined
    }, { status: 500 });
  }
}

// 백업 삭제
export async function DELETE(request: NextRequest) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessBackup('delete')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '백업 삭제 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const backupId = searchParams.get('backupId');
    
    if (!backupId || typeof backupId !== 'string') {
      return NextResponse.json({
        success: false,
        error: '유효한 백업 ID가 필요합니다.',
        code: 'INVALID_BACKUP_ID'
      }, { status: 400 });
    }
    
    // 데이터베이스 연결 확인
    await connection.query('SELECT 1');
    
    // 백업 존재 확인
    const checkQuery = `SELECT backup_id FROM setting_backups WHERE backup_id = $1`;
    const checkResult = await connection.query(checkQuery, [backupId]);
    
    if (checkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: '삭제할 백업을 찾을 수 없습니다.',
        code: 'BACKUP_NOT_FOUND'
      }, { status: 404 });
    }
    
    // 백업 삭제
    const deleteQuery = `DELETE FROM setting_backups WHERE backup_id = $1`;
    const deleteResult = await connection.query(deleteQuery, [backupId]);
    
    if (deleteResult.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: '백업 삭제에 실패했습니다.',
        code: 'DELETE_FAILED'
      }, { status: 500 });
    }
    
    // 권한 감사 로그 기록
    if (permissionCheck.user) {
      await logPermissionAction(
        permissionCheck.user.id,
        BACKUP_PERMISSIONS.delete,
        'granted',
        { 
          backup_id: backupId,
          action: 'delete'
        },
        request
      );
    }
    
    return NextResponse.json({
      success: true,
      message: '백업이 성공적으로 삭제되었습니다.',
      data: { backupId }
    });
    
  } catch (error) {
    const backupError = error as BackupError;
    console.error('백업 삭제 오류:', {
      message: backupError.message,
      code: backupError.code,
      stack: backupError.stack
    });
    
    return NextResponse.json({
      success: false,
      error: '백업 삭제에 실패했습니다.',
      code: 'BACKUP_DELETE_ERROR',
      details: process.env.NODE_ENV === 'development' ? backupError.message : undefined
    }, { status: 500 });
  }
} 