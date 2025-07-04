// 시스템 진단 관련 타입 정의
export interface SystemDiagnostic {
  id: number;
  diagnostic_type: DiagnosticType;
  description?: string;
  status: DiagnosticStatus;
  external_service_url?: string;
  parameters?: Record<string, any>;
  results?: Record<string, any>;
  error_message?: string;
  performed_by: number;
  performed_by_name?: string;
  started_at: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DiagnosticService {
  id: number;
  service_name: string;
  service_type: ServiceType;
  service_url: string;
  iframe_url?: string;
  description?: string;
  configuration?: Record<string, any>;
  supported_diagnostics?: DiagnosticType[];
  is_active: boolean;
  created_by: number;
  created_by_name?: string;
  updated_by?: number;
  updated_by_name?: string;
  created_at: string;
  updated_at: string;
}

export type DiagnosticType = 
  | 'camera_calibration'
  | 'equipment_status'
  | 'test_pattern'
  | 'system_health'
  | 'network_test';

export type DiagnosticStatus = 
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ServiceType = 
  | 'camera_calibration'
  | 'equipment_monitoring'
  | 'test_automation'
  | 'system_health'
  | 'comprehensive';

export interface DiagnosticFilters {
  page?: number;
  limit?: number;
  type?: DiagnosticType;
  status?: DiagnosticStatus;
  date_from?: string;
  date_to?: string;
}

export interface ServiceFilters {
  type?: ServiceType;
  active?: boolean;
}

export interface CreateDiagnosticRequest {
  diagnostic_type: DiagnosticType;
  description?: string;
  external_service_url?: string;
  parameters?: Record<string, any>;
}

export interface UpdateDiagnosticRequest {
  status?: DiagnosticStatus;
  results?: Record<string, any>;
  error_message?: string;
  completed_at?: string;
}

export interface CreateServiceRequest {
  service_name: string;
  service_type: ServiceType;
  service_url: string;
  iframe_url?: string;
  description?: string;
  configuration?: Record<string, any>;
  supported_diagnostics?: DiagnosticType[];
  is_active?: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 진단 유형 옵션 (UI용)
export const DIAGNOSTIC_TYPE_OPTIONS = [
  { value: 'camera_calibration', label: '카메라 교정' },
  { value: 'equipment_status', label: '장비 상태 확인' },
  { value: 'test_pattern', label: '테스트 패턴' },
  { value: 'system_health', label: '시스템 상태' },
  { value: 'network_test', label: '네트워크 테스트' }
] as const;

// 진단 상태 옵션 (UI용)
export const DIAGNOSTIC_STATUS_OPTIONS = [
  { value: 'in_progress', label: '진행 중', color: 'blue' },
  { value: 'completed', label: '완료', color: 'green' },
  { value: 'failed', label: '실패', color: 'red' },
  { value: 'cancelled', label: '취소', color: 'gray' }
] as const;

// 서비스 유형 옵션 (UI용)
export const SERVICE_TYPE_OPTIONS = [
  { value: 'camera_calibration', label: '카메라 교정' },
  { value: 'equipment_monitoring', label: '장비 모니터링' },
  { value: 'test_automation', label: '테스트 자동화' },
  { value: 'system_health', label: '시스템 상태' },
  { value: 'comprehensive', label: '종합 진단' }
] as const;

// API 함수들
const BASE_URL = '/api/diagnostics';

// 진단 세션 관련 API
export const diagnosticsApi = {
  // 진단 이력 조회
  async getDiagnostics(filters?: DiagnosticFilters): Promise<PaginatedResponse<SystemDiagnostic>> {
    const params = new URLSearchParams();
    
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);

    const response = await fetch(`${BASE_URL}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 특정 진단 세션 조회
  async getDiagnostic(id: number): Promise<ApiResponse<SystemDiagnostic>> {
    const response = await fetch(`${BASE_URL}/${id}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 새 진단 세션 시작
  async createDiagnostic(data: CreateDiagnosticRequest): Promise<ApiResponse<SystemDiagnostic>> {
    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 진단 세션 업데이트
  async updateDiagnostic(id: number, data: UpdateDiagnosticRequest): Promise<ApiResponse<SystemDiagnostic>> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 진단 세션 삭제
  async deleteDiagnostic(id: number): Promise<ApiResponse<void>> {
    const response = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
};

// 외부 서비스 관련 API
export const diagnosticServicesApi = {
  // 외부 진단 서비스 목록 조회
  async getServices(filters?: ServiceFilters): Promise<ApiResponse<DiagnosticService[]>> {
    const params = new URLSearchParams();
    
    if (filters?.type) params.append('type', filters.type);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());

    const response = await fetch(`${BASE_URL}/services?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 새 외부 진단 서비스 등록
  async createService(data: CreateServiceRequest): Promise<ApiResponse<DiagnosticService>> {
    const response = await fetch(`${BASE_URL}/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  }
};

// 유틸리티 함수들
export const diagnosticsUtils = {
  // 진단 유형 라벨 가져오기
  getDiagnosticTypeLabel(type: DiagnosticType): string {
    const option = DIAGNOSTIC_TYPE_OPTIONS.find(opt => opt.value === type);
    return option?.label || type;
  },

  // 진단 상태 라벨 가져오기
  getDiagnosticStatusLabel(status: DiagnosticStatus): string {
    const option = DIAGNOSTIC_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || status;
  },

  // 진단 상태 색상 가져오기
  getDiagnosticStatusColor(status: DiagnosticStatus): string {
    const option = DIAGNOSTIC_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'gray';
  },

  // 서비스 유형 라벨 가져오기
  getServiceTypeLabel(type: ServiceType): string {
    const option = SERVICE_TYPE_OPTIONS.find(opt => opt.value === type);
    return option?.label || type;
  },

  // 진단 소요 시간 계산
  getDiagnosticDuration(started_at: string, completed_at?: string): string {
    const start = new Date(started_at);
    const end = completed_at ? new Date(completed_at) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}분 ${seconds}초`;
    } else {
      return `${seconds}초`;
    }
  },

  // iframe URL 검증
  isValidIframeUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'https:' || parsedUrl.protocol === 'http:';
    } catch {
      return false;
    }
  }
}; 