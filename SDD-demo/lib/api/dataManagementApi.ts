// 데이터 관리 관련 타입 정의
export interface ImageFile {
  id: number;
  original_filename: string;
  stored_filename: string;
  file_path: string;
  file_size: number;
  mime_type?: string;
  schedule_id?: number;
  defect_detection_id?: number;
  upload_time: string;
  created_at: string;
  // 조인된 데이터
  coil_id?: string;
  customer_name?: string;
  defect_type?: string;
  confidence_score?: number;
}

export interface Schedule {
  id: number;
  coil_id: string;
  customer_id: number;
  bom_id?: number;
  status: ScheduleStatus;
  start_time?: string;
  end_time?: string;
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  // 조인된 데이터
  customer_name?: string;
  customer_code?: string;
  material_type?: string;
  thickness?: number;
  width?: number;
  length?: number;
  image_count?: number;
  defect_count?: number;
  avg_confidence?: number;
}

export type ScheduleStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type FileAction = 'rename' | 'move' | 'delete' | 'copy';
export type ScheduleAction = 'update_status' | 'update_progress' | 'archive' | 'delete' | 'export_data';

export interface ImageFilters {
  page?: number;
  limit?: number;
  schedule_id?: number;
  date_from?: string;
  date_to?: string;
  file_type?: string;
  search?: string;
}

export interface ScheduleFilters {
  page?: number;
  limit?: number;
  status?: ScheduleStatus;
  customer_id?: number;
  date_from?: string;
  date_to?: string;
  search?: string;
  include_stats?: boolean;
}

export interface FileOperationRequest {
  action: FileAction;
  file_ids: number[];
  parameters?: {
    naming_pattern?: string;
    target_directory?: string;
  };
}

export interface ScheduleOperationRequest {
  action: ScheduleAction;
  schedule_ids: number[];
  parameters?: {
    new_status?: ScheduleStatus;
    progress_percentage?: number;
    format?: string;
  };
}

export interface OperationResult {
  success: boolean;
  file_id?: number;
  schedule_id?: number;
  error?: string;
  [key: string]: any;
}

export interface BatchOperationResponse {
  success: boolean;
  message: string;
  data: {
    total: number;
    success: number;
    errors: number;
    results: OperationResult[];
  };
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

// 스케줄 상태 옵션 (UI용)
export const SCHEDULE_STATUS_OPTIONS = [
  { value: 'scheduled', label: '예정', color: 'blue' },
  { value: 'in_progress', label: '진행 중', color: 'yellow' },
  { value: 'completed', label: '완료', color: 'green' },
  { value: 'cancelled', label: '취소', color: 'red' }
] as const;

// 파일 작업 옵션 (UI용)
export const FILE_ACTION_OPTIONS = [
  { value: 'rename', label: '파일명 변경', icon: 'Edit' },
  { value: 'move', label: '파일 이동', icon: 'FolderOpen' },
  { value: 'copy', label: '파일 복사', icon: 'Copy' },
  { value: 'delete', label: '파일 삭제', icon: 'Trash2' }
] as const;

// 스케줄 작업 옵션 (UI용)
export const SCHEDULE_ACTION_OPTIONS = [
  { value: 'update_status', label: '상태 변경', icon: 'RefreshCw' },
  { value: 'update_progress', label: '진행률 변경', icon: 'BarChart' },
  { value: 'archive', label: '아카이브', icon: 'Archive' },
  { value: 'export_data', label: '데이터 내보내기', icon: 'Download' },
  { value: 'delete', label: '삭제', icon: 'Trash2' }
] as const;

// 파일명 패턴 옵션 (UI용)
export const NAMING_PATTERN_OPTIONS = [
  { value: '{coil_id}_{index}', label: 'Coil ID + 순번', example: 'COIL001_001.jpg' },
  { value: '{date}_{time}_{index}', label: '날짜 + 시간 + 순번', example: '2024-01-15_143022_001.jpg' },
  { value: '{coil_id}_{date}_{index}', label: 'Coil ID + 날짜 + 순번', example: 'COIL001_2024-01-15_001.jpg' },
  { value: '{original}_{index}', label: '원본명 + 순번', example: 'original_001.jpg' },
  { value: 'defect_{coil_id}_{index}', label: '결함_Coil ID_순번', example: 'defect_COIL001_001.jpg' }
] as const;

// API 함수들
const IMAGE_BASE_URL = '/api/data-management/images';
const SCHEDULE_BASE_URL = '/api/data-management/schedules';

// 이미지 파일 관리 API
export const imageManagementApi = {
  // 이미지 파일 목록 조회
  async getImages(filters?: ImageFilters): Promise<PaginatedResponse<ImageFile>> {
    const params = new URLSearchParams();
    
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.schedule_id) params.append('schedule_id', filters.schedule_id.toString());
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.file_type) params.append('file_type', filters.file_type);
    if (filters?.search) params.append('search', filters.search);

    const response = await fetch(`${IMAGE_BASE_URL}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 이미지 파일 일괄 작업
  async performBatchOperation(request: FileOperationRequest): Promise<BatchOperationResponse> {
    const response = await fetch(IMAGE_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 파일명 일괄 변경
  async renameFiles(fileIds: number[], namingPattern: string): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'rename',
      file_ids: fileIds,
      parameters: { naming_pattern: namingPattern }
    });
  },

  // 파일 이동
  async moveFiles(fileIds: number[], targetDirectory: string): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'move',
      file_ids: fileIds,
      parameters: { target_directory: targetDirectory }
    });
  },

  // 파일 복사
  async copyFiles(fileIds: number[], targetDirectory: string): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'copy',
      file_ids: fileIds,
      parameters: { target_directory: targetDirectory }
    });
  },

  // 파일 삭제
  async deleteFiles(fileIds: number[]): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'delete',
      file_ids: fileIds
    });
  }
};

// 스케줄 관리 API
export const scheduleManagementApi = {
  // 스케줄 목록 조회
  async getSchedules(filters?: ScheduleFilters): Promise<PaginatedResponse<Schedule>> {
    const params = new URLSearchParams();
    
    if (filters?.page) params.append('page', filters.page.toString());
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.status) params.append('status', filters.status);
    if (filters?.customer_id) params.append('customer_id', filters.customer_id.toString());
    if (filters?.date_from) params.append('date_from', filters.date_from);
    if (filters?.date_to) params.append('date_to', filters.date_to);
    if (filters?.search) params.append('search', filters.search);
    if (filters?.include_stats) params.append('include_stats', filters.include_stats.toString());

    const response = await fetch(`${SCHEDULE_BASE_URL}?${params}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 스케줄 일괄 작업
  async performBatchOperation(request: ScheduleOperationRequest): Promise<BatchOperationResponse> {
    const response = await fetch(SCHEDULE_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  },

  // 스케줄 상태 일괄 변경
  async updateStatus(scheduleIds: number[], newStatus: ScheduleStatus): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'update_status',
      schedule_ids: scheduleIds,
      parameters: { new_status: newStatus }
    });
  },

  // 스케줄 진행률 일괄 변경
  async updateProgress(scheduleIds: number[], progressPercentage: number): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'update_progress',
      schedule_ids: scheduleIds,
      parameters: { progress_percentage: progressPercentage }
    });
  },

  // 스케줄 아카이브
  async archiveSchedules(scheduleIds: number[]): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'archive',
      schedule_ids: scheduleIds
    });
  },

  // 스케줄 데이터 내보내기
  async exportData(scheduleIds: number[], format = 'json'): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'export_data',
      schedule_ids: scheduleIds,
      parameters: { format }
    });
  },

  // 스케줄 삭제
  async deleteSchedules(scheduleIds: number[]): Promise<BatchOperationResponse> {
    return this.performBatchOperation({
      action: 'delete',
      schedule_ids: scheduleIds
    });
  }
};

// 유틸리티 함수들
export const dataManagementUtils = {
  // 스케줄 상태 라벨 가져오기
  getScheduleStatusLabel(status: ScheduleStatus): string {
    const option = SCHEDULE_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.label || status;
  },

  // 스케줄 상태 색상 가져오기
  getScheduleStatusColor(status: ScheduleStatus): string {
    const option = SCHEDULE_STATUS_OPTIONS.find(opt => opt.value === status);
    return option?.color || 'gray';
  },

  // 파일 크기 포맷팅
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  },

  // 파일 확장자 가져오기
  getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
  },

  // 이미지 파일 여부 확인
  isImageFile(mimeType?: string): boolean {
    if (!mimeType) return false;
    return mimeType.startsWith('image/');
  },

  // 진행률 계산
  calculateProgress(current: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((current / total) * 100);
  },

  // 소요 시간 계산
  calculateDuration(startTime?: string, endTime?: string): string {
    if (!startTime) return '-';
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diffMs = end.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}시간 ${minutes}분`;
    } else {
      return `${minutes}분`;
    }
  },

  // 파일명 패턴 미리보기 생성
  generatePatternPreview(pattern: string, sampleData?: any): string {
    const now = new Date();
    return pattern
      .replace('{index}', '001')
      .replace('{coil_id}', sampleData?.coil_id || 'COIL001')
      .replace('{date}', now.toISOString().split('T')[0])
      .replace('{time}', now.toTimeString().split(' ')[0].replace(/:/g, ''))
      .replace('{original}', sampleData?.original_filename?.split('.')[0] || 'original')
      + '.jpg';
  },

  // 배치 작업 결과 요약
  summarizeBatchResults(results: OperationResult[]): string {
    const success = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const total = results.length;
    
    if (failed === 0) {
      return `모든 작업이 성공했습니다. (${total}개)`;
    } else if (success === 0) {
      return `모든 작업이 실패했습니다. (${total}개)`;
    } else {
      return `${success}개 성공, ${failed}개 실패 (총 ${total}개)`;
    }
  },

  // 선택된 항목 수 표시
  getSelectionText(selectedCount: number, totalCount: number): string {
    if (selectedCount === 0) {
      return `총 ${totalCount}개 항목`;
    } else if (selectedCount === totalCount) {
      return `모든 항목 선택됨 (${totalCount}개)`;
    } else {
      return `${selectedCount}개 선택됨 (총 ${totalCount}개)`;
    }
  }
}; 