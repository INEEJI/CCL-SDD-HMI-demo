import { apiClient, ApiResponse } from './client';

// 백업 데이터 타입
export interface BackupData {
  id: number;
  backupName: string;
  backupDescription?: string;
  backupData: Record<string, any>;
  createdBy: number;
  createdAt: string;
  fileSize?: number;
  checksum?: string;
}

// 백업 목록 응답 타입
export interface BackupListResponse {
  data: BackupData[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
}

// 복원 결과 타입
export interface RestoreResult {
  success: boolean;
  message: string;
  affectedCategories: string[];
  affectedSettings: number;
  restoreLogId?: number;
}

// 백업 통계 타입
export interface BackupStats {
  totalBackups: number;
  totalSize: number;
  lastBackupDate?: string;
  oldestBackupDate?: string;
  averageSize: number;
}

// 백업 관리 API 클라이언트
export class BackupApi {
  /**
   * 자동 백업 생성
   */
  static async createAutoBackup(): Promise<{ 
    success: boolean; 
    data: { backupId: string; backup: BackupData }; 
    message: string 
  }> {
    const response = await apiClient.post<{ backupId: string; backup: BackupData }>('/settings/backup');
    
    if (!response.data) {
      throw new Error(response.error || '자동 백업 생성에 실패했습니다.');
    }

    return {
      success: true,
      data: response.data,
      message: response.message || '자동 백업이 성공적으로 생성되었습니다.'
    };
  }

  /**
   * 수동 백업 생성 (사용자 지정 이름/설명)
   */
  static async createManualBackup(backupName: string, backupDescription?: string): Promise<{
    success: boolean;
    data: { backupId: string; backup: BackupData };
    message: string;
  }> {
    const response = await apiClient.post<{ backupId: string; backup: BackupData }>('/settings/backup', {
      backupName,
      backupDescription
    });

    if (!response.data) {
      throw new Error(response.error || '수동 백업 생성에 실패했습니다.');
    }

    return {
      success: true,
      data: response.data,
      message: response.message || '수동 백업이 성공적으로 생성되었습니다.'
    };
  }

  /**
   * 백업 목록 조회
   */
  static async getBackupList(params?: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    createdBy?: number;
  }): Promise<BackupListResponse> {
    const response = await apiClient.get<BackupListResponse>('/settings/backup', params);
    
    if (!response.data) {
      throw new Error(response.error || '백업 목록 조회에 실패했습니다.');
    }

    return response.data;
  }

  /**
   * 백업에서 설정 복원
   */
  static async restoreFromBackup(backupId: string, restoreReason?: string): Promise<RestoreResult> {
    const response = await apiClient.post<RestoreResult>('/settings/restore', { backupId });
    
    if (!response.data) {
      throw new Error(response.error || '백업 복원에 실패했습니다.');
    }

    return response.data;
  }

  /**
   * 백업 파일 업로드 및 복원
   */
  static async uploadAndRestore(
    backupFile: File, 
    restoreReason?: string
  ): Promise<RestoreResult> {
    try {
      // 파일을 JSON으로 파싱
      const fileContent = await backupFile.text();
      const backupData = JSON.parse(fileContent);

      // 백업 데이터 유효성 검증
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('올바르지 않은 백업 파일 형식입니다.');
      }

      // 백업 데이터로 복원 요청
      const response = await apiClient.post<RestoreResult>('/settings/restore', { backupData });
      
      if (!response.data) {
        throw new Error(response.error || '백업 파일 복원에 실패했습니다.');
      }

      return response.data;
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error('백업 파일이 올바른 JSON 형식이 아닙니다.');
      }
      throw error;
    }
  }

  /**
   * 백업 파일 다운로드
   */
  static async downloadBackup(backupId: string): Promise<BackupData> {
    const response = await apiClient.get<BackupData>(`/settings/restore?backupId=${backupId}`);
    
    if (!response.data) {
      throw new Error(response.error || '백업 파일 다운로드에 실패했습니다.');
    }

    return response.data;
  }

  /**
   * 백업 삭제
   */
  static async deleteBackup(backupId: string): Promise<{ success: boolean; message: string }> {
    try {
      await apiClient.delete(`/settings/backup?backupId=${backupId}`);
      return {
        success: true,
        message: '백업이 성공적으로 삭제되었습니다.'
      };
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : '백업 삭제에 실패했습니다.');
    }
  }

  /**
   * 백업 통계 조회
   */
  static async getBackupStats(): Promise<BackupStats> {
    const response = await apiClient.get<BackupStats>('/settings/backup/stats');
    
    if (!response.data) {
      throw new Error(response.error || '백업 통계 조회에 실패했습니다.');
    }

    return response.data;
  }

  /**
   * 백업 파일을 브라우저에서 다운로드
   */
  static async triggerBackupDownload(backup: BackupData): Promise<void> {
    try {
      const dataStr = JSON.stringify(backup.backupData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${backup.backupName}_${backup.createdAt.split('T')[0]}.json`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);
    } catch (error) {
      throw new Error('백업 파일 다운로드에 실패했습니다.');
    }
  }
}

// 백업 유틸리티 함수들
export const backupUtils = {
  /**
   * 백업 파일 크기를 사람이 읽기 쉬운 형태로 변환
   */
  formatFileSize: (bytes?: number): string => {
    if (!bytes) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  },

  /**
   * 백업 날짜를 사람이 읽기 쉬운 형태로 변환
   */
  formatBackupDate: (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  },

  /**
   * 백업 이름 유효성 검증
   */
  validateBackupName: (name: string): { valid: boolean; error?: string } => {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: '백업 이름을 입력해주세요.' };
    }
    
    if (name.length > 100) {
      return { valid: false, error: '백업 이름은 100자를 초과할 수 없습니다.' };
    }
    
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(name)) {
      return { valid: false, error: '백업 이름에 특수문자(<>:"/\\|?*)를 사용할 수 없습니다.' };
    }
    
    return { valid: true };
  },

  /**
   * 백업 파일 유효성 검증
   */
  validateBackupFile: (file: File): { valid: boolean; error?: string } => {
    // 파일 크기 검증 (최대 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return { valid: false, error: '백업 파일 크기가 10MB를 초과할 수 없습니다.' };
    }
    
    // 파일 확장자 검증
    if (!file.name.toLowerCase().endsWith('.json')) {
      return { valid: false, error: '백업 파일은 JSON 형식이어야 합니다.' };
    }
    
    return { valid: true };
  }
};

export default BackupApi; 