// API 클라이언트 설정
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // 브라우저 환경에서는 현재 호스트와 포트 사용
    return `${window.location.protocol}//${window.location.hostname}:${window.location.port}/api`;
  }
  // 서버 환경에서는 환경 변수 또는 기본값 사용
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
};

const API_BASE_URL = getApiBaseUrl();

// 공통 API 응답 타입
export interface ApiResponse<T = any> {
  data?: T;
  totalCount?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  message?: string;
  error?: string;
}

// API 클라이언트 클래스
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    console.log('[API 클라이언트] 초기화됨:', { baseUrl: this.baseUrl })
  }

  // GET 요청
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    console.log('[API 클라이언트] GET 요청:', { url: url.toString(), params })

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[API 클라이언트] GET 응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[API 클라이언트] GET 요청 실패:', { 
          status: response.status, 
          statusText: response.statusText, 
          errorText 
        })
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[API 클라이언트] GET 응답 데이터:', result)
      return result
    } catch (error) {
      console.error('[API 클라이언트] GET 요청 중 오류:', error)
      throw error
    }
  }

  // POST 요청
  async post<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    console.log('[API 클라이언트] POST 요청:', { endpoint, data })

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      console.log('[API 클라이언트] POST 응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[API 클라이언트] POST 요청 실패:', { 
          status: response.status, 
          statusText: response.statusText, 
          errorText 
        })
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[API 클라이언트] POST 응답 데이터:', result)
      return result
    } catch (error) {
      console.error('[API 클라이언트] POST 요청 중 오류:', error)
      throw error
    }
  }

  // PUT 요청
  async put<T>(endpoint: string, data?: any): Promise<ApiResponse<T>> {
    console.log('[API 클라이언트] PUT 요청:', { endpoint, data })

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: data ? JSON.stringify(data) : undefined,
      });

      console.log('[API 클라이언트] PUT 응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[API 클라이언트] PUT 요청 실패:', { 
          status: response.status, 
          statusText: response.statusText, 
          errorText 
        })
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[API 클라이언트] PUT 응답 데이터:', result)
      return result
    } catch (error) {
      console.error('[API 클라이언트] PUT 요청 중 오류:', error)
      throw error
    }
  }

  // DELETE 요청
  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    console.log('[API 클라이언트] DELETE 요청:', { endpoint })

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[API 클라이언트] DELETE 응답 상태:', response.status, response.statusText)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[API 클라이언트] DELETE 요청 실패:', { 
          status: response.status, 
          statusText: response.statusText, 
          errorText 
        })
        throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`)
      }

      const result = await response.json()
      console.log('[API 클라이언트] DELETE 응답 데이터:', result)
      return result
    } catch (error) {
      console.error('[API 클라이언트] DELETE 요청 중 오류:', error)
      throw error
    }
  }
}

// API 클라이언트 인스턴스
export const apiClient = new ApiClient();

// 스케줄 관련 API
export const scheduleApi = {
  // 스케줄 목록 조회
  getSchedules: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    customerId?: string;
  }) => apiClient.get('/schedules', params),

  // 스케줄 생성
  createSchedule: (data: {
    coilId: string;
    customerId: number;
    bomId?: number;
    startTime?: string;
    endTime?: string;
  }) => apiClient.post('/schedules', data),

  // 스케줄 상세 조회
  getSchedule: (id: string) => apiClient.get(`/schedules/${id}`),

  // 스케줄 수정
  updateSchedule: (id: string, data: any) => apiClient.put(`/schedules/${id}`, data),

  // 스케줄 삭제
  deleteSchedule: (id: string) => apiClient.delete(`/schedules/${id}`),
};

// 결함 검출 관련 API
export const defectApi = {
  // 결함 검출 결과 조회
  getDefects: (params?: {
    page?: number;
    limit?: number;
    scheduleId?: string;
    defectType?: string;
    startDate?: string;
    endDate?: string;
  }) => apiClient.get('/defects', params),

  // 결함 검출 결과 저장
  createDefect: (data: {
    scheduleId: number;
    modelId?: number;
    defectType: string;
    defectSizeWidth?: number;
    defectSizeHeight?: number;
    defectPositionX?: number;
    defectPositionY?: number;
    defectPositionMeter?: number;
    confidenceScore?: number;
    imagePath?: string;
  }) => apiClient.post('/defects', data),

  // 결함 검출 결과 상세 조회
  getDefect: (id: string) => apiClient.get(`/defects/${id}`),

  // 결함 검출 결과 수정
  updateDefect: (id: string, data: any) => apiClient.put(`/defects/${id}`, data),

  // 결함 검출 결과 삭제
  deleteDefect: (id: string) => apiClient.delete(`/defects/${id}`),
};

// AI 모델 관련 API
export const modelApi = {
  // 모델 목록 조회
  getModels: (params?: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    isDeployed?: boolean;
  }) => apiClient.get('/models', params),

  // 새 모델 등록
  createModel: (data: {
    modelName: string;
    version: string;
    modelType: string;
    filePath: string;
    fileSize?: number;
    checksum?: string;
    description?: string;
    accuracyScore?: number;
    createdBy?: number;
  }) => apiClient.post('/models', data),

  // 모델 상세 조회
  getModel: (id: string) => apiClient.get(`/models/${id}`),

  // 모델 정보 수정
  updateModel: (id: string, data: {
    description?: string;
    accuracyScore?: number;
    isActive?: boolean;
  }) => apiClient.put(`/models/${id}`, data),

  // 모델 삭제
  deleteModel: (id: string) => apiClient.delete(`/models/${id}`),

  // 모델 배포/해제
  deployModel: (id: string, deploy: boolean) => 
    apiClient.put(`/models/${id}/deploy`, { deploy }),

  // 모델 배포 상태 조회
  getModelDeployStatus: (id: string) => apiClient.get(`/models/${id}/deploy`),
};

// AI 결과 수신 관련 API
export const aiResultApi = {
  // AI 모델 서버로부터 결과 수신 (외부 AI 서버에서 호출)
  submitResults: (data: {
    scheduleId: number;
    modelId?: number;
    originalImagePath?: string;
    labeledImageBase64?: string;
    labeledImageFilename?: string;
    detections: Array<{
      defectType: string;
      defectSizeWidth?: number;
      defectSizeHeight?: number;
      defectPositionX?: number;
      defectPositionY?: number;
      defectPositionMeter?: number;
      confidenceScore?: number;
      detectionTime?: string;
    }>;
  }) => apiClient.post('/ai-results', data),

  // AI 처리 결과 조회
  getAiResults: (params?: {
    scheduleId?: string;
    modelId?: string;
    limit?: number;
  }) => apiClient.get('/ai-results', params),
}; 