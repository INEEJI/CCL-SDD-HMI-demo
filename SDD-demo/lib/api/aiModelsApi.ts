// AI 모델 관리 API 클라이언트

export interface AIModel {
  id: number;
  model_name: string;
  version: string;
  model_type: string;
  file_path: string;
  file_size: number;
  checksum: string;
  description: string;
  is_active: boolean;
  is_deployed: boolean;
  accuracy_score: number;
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface CreateModelRequest {
  modelName: string;
  version: string;
  modelType: string;
  filePath: string;
  fileSize?: number;
  checksum?: string;
  description?: string;
  accuracyScore?: number;
}

export interface UpdateModelRequest {
  description?: string;
  accuracyScore?: number;
  isActive?: boolean;
}

export interface ModelUploadRequest {
  file: File;
  modelName: string;
  version: string;
  modelType: string;
  description?: string;
  accuracyScore?: string;
}

export interface ModelMetrics {
  model: AIModel;
  performance_by_defect_type: Array<{
    defect_type: string;
    total_detections: number;
    avg_confidence: number;
    min_confidence: number;
    max_confidence: number;
    high_confidence_count: number;
    medium_confidence_count: number;
    low_confidence_count: number;
  }>;
  performance_trend: Array<{
    date: string;
    detection_count: number;
    avg_confidence: number;
    defect_types_count: number;
  }>;
  overall_statistics: {
    total_detections: number;
    unique_defect_types: number;
    overall_avg_confidence: number;
    first_detection: string;
    last_detection: string;
  };
  defect_type_distribution: Array<{
    defect_type: string;
    count: number;
    percentage: number;
  }>;
  metrics_summary: {
    total_detections: number;
    accuracy_score: number;
    avg_confidence: number;
    active_days: number;
    defect_types_covered: number;
  };
}

export interface ModelComparison {
  models: AIModel[];
  performance_data: Array<{
    model_id: number;
    statistics: any;
    defect_type_performance: any[];
    daily_trend: any[];
  }>;
  comparison_period: number;
  comparison_summary: {
    best_accuracy: AIModel;
    most_active: any;
    highest_confidence: any;
    most_consistent: any;
  };
}

export interface ApiResponse<T> {
  success?: boolean;
  data?: T;
  totalCount?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  message?: string;
  error?: string;
  code?: string;
}

// AI 모델 목록 조회
export async function getAIModels(params?: {
  page?: number;
  limit?: number;
  isActive?: boolean;
  isDeployed?: boolean;
}): Promise<ApiResponse<AIModel[]>> {
  const searchParams = new URLSearchParams();
  
  if (params?.page) {
    searchParams.append('page', params.page.toString());
  }
  
  if (params?.limit) {
    searchParams.append('limit', params.limit.toString());
  }
  
  if (params?.isActive !== undefined) {
    searchParams.append('isActive', params.isActive.toString());
  }
  
  if (params?.isDeployed !== undefined) {
    searchParams.append('isDeployed', params.isDeployed.toString());
  }

  const url = `/api/models${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// 특정 AI 모델 조회
export async function getAIModel(id: number): Promise<ApiResponse<AIModel>> {
  const response = await fetch(`/api/models/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// AI 모델 생성
export async function createAIModel(data: CreateModelRequest): Promise<ApiResponse<AIModel>> {
  const response = await fetch('/api/models', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

// AI 모델 수정
export async function updateAIModel(
  id: number,
  data: UpdateModelRequest
): Promise<ApiResponse<AIModel>> {
  const response = await fetch(`/api/models/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

// AI 모델 삭제
export async function deleteAIModel(id: number): Promise<ApiResponse<void>> {
  const response = await fetch(`/api/models/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// AI 모델 파일 업로드
export async function uploadAIModel(data: ModelUploadRequest): Promise<ApiResponse<AIModel>> {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('modelName', data.modelName);
  formData.append('version', data.version);
  formData.append('modelType', data.modelType);
  
  if (data.description) {
    formData.append('description', data.description);
  }
  
  if (data.accuracyScore) {
    formData.append('accuracyScore', data.accuracyScore);
  }

  const response = await fetch('/api/models/upload', {
    method: 'POST',
    body: formData,
  });

  return response.json();
}

// 업로드 정보 조회
export async function getUploadInfo(): Promise<ApiResponse<any>> {
  const response = await fetch('/api/models/upload', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// AI 모델 배포/해제
export async function deployAIModel(id: number, deploy: boolean): Promise<ApiResponse<AIModel>> {
  const response = await fetch(`/api/models/${id}/deploy`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ deploy }),
  });

  return response.json();
}

// AI 모델 배포 상태 조회
export async function getModelDeployStatus(id: number): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/models/${id}/deploy`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// AI 모델 성능 지표 조회
export async function getModelMetrics(id: number): Promise<ApiResponse<ModelMetrics>> {
  const response = await fetch(`/api/models/${id}/metrics`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// AI 모델 성능 지표 업데이트
export async function updateModelMetrics(
  id: number,
  data: { accuracy_score?: number }
): Promise<ApiResponse<AIModel>> {
  const response = await fetch(`/api/models/${id}/metrics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

// AI 모델 성능 벤치마크 실행
export async function runModelBenchmark(id: number): Promise<ApiResponse<any>> {
  const response = await fetch(`/api/models/${id}/metrics`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// AI 모델 비교
export async function compareModels(
  model_ids: number[],
  comparison_period?: number
): Promise<ApiResponse<ModelComparison>> {
  const response = await fetch('/api/models/compare', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model_ids, comparison_period }),
  });

  return response.json();
}

// 비교 가능한 모델 목록 조회
export async function getComparableModels(): Promise<ApiResponse<any>> {
  const response = await fetch('/api/models/compare', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// 모델 타입 옵션
export const modelTypes = [
  { value: 'CNN', label: 'CNN (Convolutional Neural Network)' },
  { value: 'ResNet', label: 'ResNet' },
  { value: 'YOLO', label: 'YOLO (You Only Look Once)' },
  { value: 'SSD', label: 'SSD (Single Shot MultiBox Detector)' },
  { value: 'R-CNN', label: 'R-CNN (Region-based CNN)' },
  { value: 'Transformer', label: 'Transformer' },
  { value: 'Custom', label: '사용자 정의' }
] as const;

// 모델 상태 옵션
export const modelStatusOptions = [
  { value: 'active', label: '활성', color: 'bg-green-100 text-green-800' },
  { value: 'inactive', label: '비활성', color: 'bg-gray-100 text-gray-800' },
  { value: 'deployed', label: '배포됨', color: 'bg-blue-100 text-blue-800' },
  { value: 'pending', label: '대기 중', color: 'bg-yellow-100 text-yellow-800' }
] as const; 