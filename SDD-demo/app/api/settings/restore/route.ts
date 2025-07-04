import { NextRequest, NextResponse } from 'next/server'
import { getConnection } from '@/lib/database/connection'
import { 
  PermissionHelpers, 
  logPermissionAction,
  BACKUP_PERMISSIONS 
} from '@/lib/middleware/permissions'

// 백업 데이터 타입 정의
interface BackupData {
  version: string;
  timestamp: string;
  description: string;
  systemInfo: {
    hostname: string;
    nodeVersion: string;
    platform: string;
  };
  settingsCount: number;
  categories: string[];
  settings: Record<string, Record<string, {
    value: string;
    description: string;
    dataType: string;
    updatedAt: string;
  }>>;
}

// 백업 행 타입 정의
interface BackupRow {
  backup_data: BackupData;
}

// 에러 타입 정의
interface RestoreError extends Error {
  code?: string;
  details?: unknown;
}

// 백업 데이터 유효성 검증
function validateBackupDataForRestore(data: unknown): { isValid: boolean; errors: string[]; backupData?: BackupData } {
  const errors: string[] = [];
  
  if (!data || typeof data !== 'object') {
    errors.push('백업 데이터가 유효하지 않습니다.');
    return { isValid: false, errors };
  }
  
  const backupData = data as Partial<BackupData>;
  
  // 필수 필드 검증
  if (!backupData.version || typeof backupData.version !== 'string') {
    errors.push('백업 버전 정보가 누락되었습니다.');
  }
  
  if (!backupData.timestamp || typeof backupData.timestamp !== 'string') {
    errors.push('백업 타임스탬프가 누락되었습니다.');
  }
  
  if (!backupData.settings || typeof backupData.settings !== 'object') {
    errors.push('설정 데이터가 누락되었습니다.');
    return { isValid: false, errors };
  }
  
  // 설정 데이터 구조 검증
  const settings = backupData.settings;
  for (const [category, categorySettings] of Object.entries(settings)) {
    if (!categorySettings || typeof categorySettings !== 'object') {
      errors.push(`카테고리 '${category}'의 설정이 유효하지 않습니다.`);
      continue;
    }
    
    for (const [key, settingData] of Object.entries(categorySettings)) {
      if (!settingData || typeof settingData !== 'object') {
        errors.push(`설정 '${category}.${key}'가 유효하지 않습니다.`);
        continue;
      }
      
      const setting = settingData as Partial<BackupData['settings'][string][string]>;
      if (setting.value === undefined || setting.value === null) {
        errors.push(`설정 '${category}.${key}'의 값이 누락되었습니다.`);
      }
      
      if (!setting.dataType || typeof setting.dataType !== 'string') {
        errors.push(`설정 '${category}.${key}'의 데이터 타입이 누락되었습니다.`);
      }
    }
  }
  
  return { 
    isValid: errors.length === 0, 
    errors, 
    backupData: errors.length === 0 ? backupData as BackupData : undefined 
  };
}

// 설정 복원
export async function POST(request: NextRequest) {
  const connection = getConnection();
  
  try {
    // 권한 확인
    const permissionCheck = await PermissionHelpers.canAccessBackup('restore')(request);
    
    if (!permissionCheck.hasPermission) {
      return NextResponse.json({
        success: false,
        error: permissionCheck.error || '백업 복원 권한이 없습니다.',
        code: 'PERMISSION_DENIED'
      }, { status: 403 });
    }

    const requestData = await request.json();
    const { backupId, backupData } = requestData;
    
    if (!backupId && !backupData) {
      return NextResponse.json({
        success: false,
        error: '백업 ID 또는 백업 데이터가 필요합니다.',
        code: 'MISSING_REQUIRED_PARAMS'
      }, { status: 400 });
    }

    // 데이터베이스 연결 확인
    await connection.query('SELECT 1');
    
    let restoreData: BackupData;

    // 백업 ID로 복원하는 경우
    if (backupId && !backupData) {
      if (typeof backupId !== 'string' || backupId.trim().length === 0) {
        return NextResponse.json({
          success: false,
          error: '유효한 백업 ID가 필요합니다.',
          code: 'INVALID_BACKUP_ID'
        }, { status: 400 });
      }
      
      const query = `SELECT backup_data FROM setting_backups WHERE backup_id = $1`;
      const result = await connection.query(query, [backupId]);
      
      if (result.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: '백업을 찾을 수 없습니다.',
          code: 'BACKUP_NOT_FOUND'
        }, { status: 404 });
      }
      
      const row = result.rows[0] as BackupRow;
      restoreData = row.backup_data;
    } else {
      // 파일에서 복원하는 경우
      restoreData = backupData;
    }

    // 백업 데이터 유효성 검증
    const validation = validateBackupDataForRestore(restoreData);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: '백업 데이터 유효성 검증 실패',
        code: 'INVALID_BACKUP_DATA',
        details: validation.errors
      }, { status: 400 });
    }
    
    if (!validation.backupData) {
      return NextResponse.json({
        success: false,
        error: '백업 데이터를 파싱할 수 없습니다.',
        code: 'BACKUP_PARSE_ERROR'
      }, { status: 400 });
    }
    
    restoreData = validation.backupData;

    // 트랜잭션 시작
    await connection.query('BEGIN');

    try {
      let restoredCount = 0;
      const restoredCategories: string[] = [];

      // 각 카테고리별로 설정 복원
      for (const [category, categorySettings] of Object.entries(restoreData.settings)) {
        let categoryRestored = false;
        
        for (const [key, settingData] of Object.entries(categorySettings)) {
          try {
            const upsertQuery = `
              INSERT INTO system_settings (category, key, value, description, data_type, updated_at)
              VALUES ($1, $2, $3, $4, $5, NOW())
              ON CONFLICT (category, key) 
              DO UPDATE SET 
                value = EXCLUDED.value,
                description = EXCLUDED.description,
                data_type = EXCLUDED.data_type,
                updated_at = NOW()
            `;
            
            await connection.query(upsertQuery, [
              category,
              key,
              settingData.value,
              settingData.description || '',
              settingData.dataType || 'string'
            ]);
            
            restoredCount++;
            categoryRestored = true;
            
          } catch (settingError) {
            console.warn(`설정 복원 실패 (${category}.${key}):`, settingError);
            // 개별 설정 실패는 전체 복원을 중단하지 않음
          }
        }
        
        if (categoryRestored && !restoredCategories.includes(category)) {
          restoredCategories.push(category);
        }
      }
      
      if (restoredCount === 0) {
        await connection.query('ROLLBACK');
        return NextResponse.json({
          success: false,
          error: '복원할 수 있는 설정이 없습니다.',
          code: 'NO_SETTINGS_RESTORED'
        }, { status: 400 });
      }

      // 복원 이력 저장
      const restoreLogQuery = `
        INSERT INTO setting_restore_logs (backup_id, restored_settings_count, restored_at, description)
        VALUES ($1, $2, NOW(), $3)
      `;
      
      await connection.query(restoreLogQuery, [
        backupId || 'manual_restore',
        restoredCount,
        `설정 복원 - ${new Date().toLocaleString('ko-KR')}`
      ]);

      // 트랜잭션 커밋
      await connection.query('COMMIT');

      // 권한 감사 로그 기록
      if (permissionCheck.user) {
        await logPermissionAction(
          permissionCheck.user.id,
          BACKUP_PERMISSIONS.restore,
          'granted',
          { 
            backup_id: backupId,
            restored_count: restoredCount,
            restored_categories: restoredCategories,
            total_settings: restoreData.settingsCount
          },
          request
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          backupId,
          restoredCount,
          totalSettings: restoreData.settingsCount,
          restoredCategories,
          restoreTimestamp: new Date().toISOString()
        },
        message: `${restoredCount}개의 설정이 성공적으로 복원되었습니다.`
      });

    } catch (dbError) {
      // 트랜잭션 롤백
      await connection.query('ROLLBACK');
      throw dbError;
    }

  } catch (error) {
    const restoreError = error as RestoreError;
    console.error('설정 복원 오류:', {
      message: restoreError.message,
      code: restoreError.code,
      stack: restoreError.stack
    });
    
    // 에러 타입별 응답
    if (restoreError.message?.includes('connection')) {
      return NextResponse.json({
        success: false,
        error: '데이터베이스 연결에 실패했습니다.',
        code: 'DB_CONNECTION_ERROR'
      }, { status: 503 });
    }
    
    if (restoreError.message?.includes('timeout')) {
      return NextResponse.json({
        success: false,
        error: '복원 처리 시간이 초과되었습니다.',
        code: 'TIMEOUT_ERROR'
      }, { status: 408 });
    }
    
    if (restoreError.message?.includes('JSON')) {
      return NextResponse.json({
        success: false,
        error: '백업 데이터 형식이 올바르지 않습니다.',
        code: 'INVALID_JSON_FORMAT'
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: false,
      error: '설정 복원에 실패했습니다.',
      code: 'RESTORE_ERROR',
      details: process.env.NODE_ENV === 'development' ? restoreError.message : undefined
    }, { status: 500 });
  }
}

// 특정 백업 데이터 조회
export async function GET(request: NextRequest) {
  const connection = getConnection();
  
  try {
    const { searchParams } = new URL(request.url);
    const backupId = searchParams.get('backupId');
    
    if (!backupId || typeof backupId !== 'string' || backupId.trim().length === 0) {
      return NextResponse.json({
        success: false,
        error: '유효한 백업 ID가 필요합니다.',
        code: 'INVALID_BACKUP_ID'
      }, { status: 400 });
    }

    // 데이터베이스 연결 확인
    await connection.query('SELECT 1');
    
    const query = `
      SELECT backup_data, created_at, description 
      FROM setting_backups 
      WHERE backup_id = $1
    `;
    const result = await connection.query(query, [backupId]);
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: '백업을 찾을 수 없습니다.',
        code: 'BACKUP_NOT_FOUND'
      }, { status: 404 });
    }

    const row = result.rows[0];
    const backupData = row.backup_data;
    
    // 백업 데이터 유효성 검증
    const validation = validateBackupDataForRestore(backupData);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: '저장된 백업 데이터가 손상되었습니다.',
        code: 'CORRUPTED_BACKUP_DATA',
        details: validation.errors
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...backupData,
        backupId,
        createdAt: row.created_at,
        description: row.description
      }
    });

  } catch (error) {
    const restoreError = error as RestoreError;
    console.error('백업 데이터 조회 오류:', {
      message: restoreError.message,
      code: restoreError.code,
      stack: restoreError.stack
    });
    
    // 에러 타입별 응답
    if (restoreError.message?.includes('connection')) {
      return NextResponse.json({
        success: false,
        error: '데이터베이스 연결에 실패했습니다.',
        code: 'DB_CONNECTION_ERROR'
      }, { status: 503 });
    }
    
    return NextResponse.json({
      success: false,
      error: '백업 데이터 조회에 실패했습니다.',
      code: 'BACKUP_DATA_FETCH_ERROR',
      details: process.env.NODE_ENV === 'development' ? restoreError.message : undefined
    }, { status: 500 });
  }
} 