// 고객사별 불량 기준 설정 API 클라이언트

export interface CustomerDefectRule {
  id: number;
  customer_id: number;
  customer_name: string;
  customer_code: string;
  defect_type: string;
  min_confidence_score: number;
  max_defect_size_width: number;
  max_defect_size_height: number;
  max_defect_count_per_meter: number;
  severity_level: 'low' | 'medium' | 'high' | 'critical';
  is_critical: boolean;
  action_required: string;
  notification_enabled: boolean;
  description: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by_username: string;
}

export interface CreateCustomerDefectRuleRequest {
  customer_id: number;
  defect_type: string;
  min_confidence_score?: number;
  max_defect_size_width: number;
  max_defect_size_height: number;
  max_defect_count_per_meter?: number;
  severity_level?: 'low' | 'medium' | 'high' | 'critical';
  is_critical?: boolean;
  action_required?: string;
  notification_enabled?: boolean;
  description?: string;
}

export interface UpdateCustomerDefectRuleRequest {
  min_confidence_score?: number;
  max_defect_size_width?: number;
  max_defect_size_height?: number;
  max_defect_count_per_meter?: number;
  severity_level?: 'low' | 'medium' | 'high' | 'critical';
  is_critical?: boolean;
  action_required?: string;
  notification_enabled?: boolean;
  description?: string;
  is_active?: boolean;
}

export interface Customer {
  id: number;
  name: string;
  code: string;
  contact_person: string;
  contact_email: string;
  contact_phone: string;
  address: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DefectType {
  value: string;
  label: string;
  korean_name: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  total?: number;
  message?: string;
  error?: string;
  code?: string;
}

// 고객사별 불량 기준 목록 조회
export async function getCustomerDefectRules(params?: {
  customer_id?: number;
  defect_type?: string;
  is_active?: boolean;
}): Promise<ApiResponse<CustomerDefectRule[]>> {
  const searchParams = new URLSearchParams();
  
  if (params?.customer_id) {
    searchParams.append('customer_id', params.customer_id.toString());
  }
  
  if (params?.defect_type) {
    searchParams.append('defect_type', params.defect_type);
  }
  
  if (params?.is_active !== undefined) {
    searchParams.append('is_active', params.is_active.toString());
  }

  const url = `/api/customer-rules${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// 특정 고객사 불량 기준 조회
export async function getCustomerDefectRule(id: number): Promise<ApiResponse<CustomerDefectRule>> {
  const response = await fetch(`/api/customer-rules/${id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// 고객사별 불량 기준 생성
export async function createCustomerDefectRule(
  data: CreateCustomerDefectRuleRequest
): Promise<ApiResponse<CustomerDefectRule>> {
  const response = await fetch('/api/customer-rules', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

// 고객사별 불량 기준 수정
export async function updateCustomerDefectRule(
  id: number,
  data: UpdateCustomerDefectRuleRequest
): Promise<ApiResponse<CustomerDefectRule>> {
  const response = await fetch(`/api/customer-rules/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  return response.json();
}

// 고객사별 불량 기준 삭제
export async function deleteCustomerDefectRule(id: number): Promise<ApiResponse<void>> {
  const response = await fetch(`/api/customer-rules/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// 고객사 목록 조회
export async function getCustomers(params?: {
  is_active?: boolean;
  search?: string;
}): Promise<ApiResponse<Customer[]>> {
  const searchParams = new URLSearchParams();
  
  if (params?.is_active !== undefined) {
    searchParams.append('is_active', params.is_active.toString());
  }
  
  if (params?.search) {
    searchParams.append('search', params.search);
  }

  const url = `/api/customers${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// 결함 유형 목록 조회
export async function getDefectTypes(): Promise<ApiResponse<DefectType[]>> {
  const response = await fetch('/api/defect-types', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return response.json();
}

// 심각도 레벨 옵션
export const severityLevels = [
  { value: 'low', label: '낮음', color: 'bg-green-100 text-green-800' },
  { value: 'medium', label: '보통', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: '높음', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: '심각', color: 'bg-red-100 text-red-800' }
] as const;

// 조치 필요 옵션
export const actionRequiredOptions = [
  { value: 'log_only', label: '기록만' },
  { value: 'alert_only', label: '알림만' },
  { value: 'slow_down', label: '속도 조절' },
  { value: 'immediate_stop', label: '즉시 정지' }
] as const; 