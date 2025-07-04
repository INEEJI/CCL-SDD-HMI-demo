import { apiClient, ApiResponse } from './client';

// 시스템 설정 인터페이스
export interface SystemSetting {
  id: number;
  category: string;
  key: string;
  value: string | number | boolean | object;
  dataType: 'string' | 'number' | 'boolean' | 'json';
  description?: string;
  minValue?: number;
  maxValue?: number;
  allowedValues?: string[];
  isSensitive?: boolean;
  createdAt: string;
  updatedAt: string;
}

// 각 카테고리별 설정 타입 - 대시보드와 일치하도록 수정
export interface SensitivitySettings {
  threshold?: number;
  minDefectSize?: number;
  scratch: number;
  dent: number;
  stain: number;
  crack: number;
  global: number;
  [key: string]: any;
}

export interface HardwareSettings {
  cameraResolution?: string;
  frameRate?: number;
  lightingIntensity?: number;
  cameraSpeed: number;
  lighting: number;
  temperature: number;
  airPressure: number;
  autoAdjustment: boolean;
  [key: string]: any;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  soundAlerts?: boolean;
  emailServer?: string;
  soundEnabled: boolean;
  volume: number;
  periodicAlerts: boolean;
  criticalAlerts: boolean;
  [key: string]: any;
}

export interface PeriodicPatternSettings {
  scratch: {
    interval: number;
    count: number;
    enabled: boolean;
  };
  dent: {
    interval: number;
    count: number;
    enabled: boolean;
  };
  stain: {
    interval: number;
    count: number;
    enabled: boolean;
  };
  crack: {
    interval: number;
    count: number;
    enabled: boolean;
  };
  [key: string]: any;
}

// 전체 설정 타입
export interface AllSettings {
  sensitivity?: SensitivitySettings;
  hardware?: HardwareSettings;
  notifications?: NotificationSettings;
  periodicPatterns?: PeriodicPatternSettings;
  [key: string]: any;
}

// 설정 업데이트 요청 타입
export interface SettingUpdateRequest<T> {
  category: string;
  settings: T;
  validateOnly?: boolean;
}

// 설정 유효성 검증 결과
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// 설정 백업 타입
export interface SettingBackup {
  id: number;
  backupName: string;
  backupDescription?: string;
  backupData: AllSettings;
  createdBy: number;
  createdAt: string;
  fileSize?: number;
  checksum?: string;
}

// 설정 변경 이력 타입
export interface SettingHistory {
  id: number;
  category: string;
  key: string;
  oldValue: any;
  newValue: any;
  changedBy: number;
  changedAt: string;
  changeReason?: string;
  ipAddress?: string;
}

// 설정 복원 로그 타입
export interface SettingRestoreLog {
  id: number;
  backupId: number;
  restoredBy: number;
  restoredAt: string;
  restoreReason?: string;
  affectedCategories: string[];
  affectedSettings: number;
  success: boolean;
  errorMessage?: string;
}

// 시스템 설정 API 클라이언트
export class SettingsApi {
  /**
   * 모든 설정 조회
   */
  static async getAllSettings(): Promise<AllSettings> {
    const response = await apiClient.get<AllSettings>('/settings');
    if (!response.data) {
      throw new Error(response.error || '설정 조회에 실패했습니다.');
    }
    return response.data;
  }

  /**
   * 특정 카테고리 설정 조회
   */
  static async getSettingsByCategory<T>(category: string): Promise<T> {
    const response = await apiClient.get<AllSettings>(`/settings?category=${category}`);
    if (!response.data) {
      throw new Error(response.error || '설정 조회에 실패했습니다.');
    }
    const categoryData = response.data[category as keyof AllSettings];
    if (!categoryData) {
      throw new Error(`카테고리 '${category}'의 설정을 찾을 수 없습니다.`);
    }
    return categoryData as T;
  }

  /**
   * 설정 업데이트 (카테고리별)
   */
  static async updateSettings<T>(category: string, settings: T): Promise<T> {
    const response = await apiClient.post<T>('/settings', {
      category,
      settings
    });
    if (!response.data) {
      throw new Error(response.error || '설정 업데이트에 실패했습니다.');
    }
    return response.data;
  }

  /**
   * 설정 유효성 검증
   */
  static async validateSettings<T>(category: string, settings: T): Promise<{ success: boolean; data: ValidationResult; message?: string; errors?: string[] }> {
    const response = await apiClient.post<ValidationResult>('/settings', {
      category,
      settings,
      validateOnly: true
    });
    return {
      success: !!response.data,
      data: response.data || { valid: false },
      message: response.message,
      errors: response.error ? [response.error] : undefined
    };
  }

  /**
   * 민감도 설정 조회
   */
  static async getSensitivitySettings(): Promise<SensitivitySettings> {
    return this.getSettingsByCategory<SensitivitySettings>('sensitivity');
  }

  /**
   * 민감도 설정 업데이트
   */
  static async updateSensitivitySettings(settings: SensitivitySettings): Promise<SensitivitySettings> {
    return this.updateSettings('sensitivity', settings);
  }

  /**
   * 하드웨어 설정 조회
   */
  static async getHardwareSettings(): Promise<HardwareSettings> {
    return this.getSettingsByCategory<HardwareSettings>('hardware');
  }

  /**
   * 하드웨어 설정 업데이트
   */
  static async updateHardwareSettings(settings: HardwareSettings): Promise<HardwareSettings> {
    return this.updateSettings('hardware', settings);
  }

  /**
   * 알림 설정 조회
   */
  static async getNotificationSettings(): Promise<NotificationSettings> {
    return this.getSettingsByCategory<NotificationSettings>('notifications');
  }

  /**
   * 알림 설정 업데이트
   */
  static async updateNotificationSettings(settings: NotificationSettings): Promise<NotificationSettings> {
    return this.updateSettings('notifications', settings);
  }

  /**
   * 주기성 패턴 설정 조회
   */
  static async getPeriodicPatternSettings(): Promise<PeriodicPatternSettings> {
    return this.getSettingsByCategory<PeriodicPatternSettings>('periodicPatterns');
  }

  /**
   * 주기성 패턴 설정 업데이트
   */
  static async updatePeriodicPatternSettings(settings: PeriodicPatternSettings): Promise<PeriodicPatternSettings> {
    return this.updateSettings('periodicPatterns', settings);
  }

  /**
   * 설정 백업 생성
   */
  static async createBackup(backupName: string, backupDescription?: string): Promise<SettingBackup> {
    const response = await apiClient.post<SettingBackup>('/settings/backup', {
      backupName,
      backupDescription
    });
    if (!response.data) {
      throw new Error(response.error || '설정 백업 생성에 실패했습니다.');
    }
    return response.data;
  }

  /**
   * 설정 백업 목록 조회
   */
  static async getBackupList(): Promise<{ data: SettingBackup[]; totalCount: number }> {
    const response = await apiClient.get<SettingBackup[]>('/settings/backup');
    return {
      data: response.data || [],
      totalCount: response.totalCount || 0
    };
  }

  /**
   * 설정 백업 복원
   */
  static async restoreBackup(backupId: number, restoreReason?: string): Promise<SettingRestoreLog> {
    const response = await apiClient.post<SettingRestoreLog>(`/settings/backup/${backupId}/restore`, {
      restoreReason
    });
    if (!response.data) {
      throw new Error(response.error || '설정 백업 복원에 실패했습니다.');
    }
    return response.data;
  }

  /**
   * 설정 백업 삭제
   */
  static async deleteBackup(backupId: number): Promise<void> {
    const response = await apiClient.delete(`/settings/backup/${backupId}`);
    if (response.error) {
      throw new Error(response.error);
    }
  }

  /**
   * 설정 변경 이력 조회
   */
  static async getSettingHistory(params?: {
    category?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: SettingHistory[]; totalCount: number }> {
    const response = await apiClient.get<SettingHistory[]>('/settings/history', params);
    return {
      data: response.data || [],
      totalCount: response.totalCount || 0
    };
  }

  /**
   * 설정 복원 이력 조회
   */
  static async getRestoreHistory(params?: {
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: SettingRestoreLog[]; totalCount: number }> {
    const response = await apiClient.get<SettingRestoreLog[]>('/settings/restore-history', params);
    return {
      data: response.data || [],
      totalCount: response.totalCount || 0
    };
  }
}

// 유틸리티 함수들
export const settingsUtils = {
  /**
   * 설정 값 포맷팅
   */
  formatSettingValue: (value: string | number | boolean | object, dataType: string): string => {
    switch (dataType) {
      case 'boolean':
        return value ? '활성화' : '비활성화';
      case 'number':
        return value.toString();
      case 'json':
        return JSON.stringify(value, null, 2);
      default:
        return value.toString();
    }
  },

  /**
   * 설정 카테고리 이름 변환
   */
  getCategoryDisplayName: (category: string): string => {
    const displayNames: Record<string, string> = {
      sensitivity: '민감도 설정',
      hardware: '하드웨어 설정',
      notifications: '알림 설정',
      periodicPatterns: '주기성 패턴',
      system: '시스템 설정',
      quality: '품질 관리',
      ai: 'AI 모델 설정',
      security: '보안 설정',
      logging: '로깅 설정'
    };
    
    return displayNames[category] || category;
  }
};

export default SettingsApi; 