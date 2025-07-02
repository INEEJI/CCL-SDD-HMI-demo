import apiClient from './index';
import { mockDefects, type DefectData } from '../constants/mockDefects';

interface GetDefectsParams {
  coilId?: string;
  defectType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface GetDefectsResponse {
  data: DefectData[];
  totalCount: number;
}

// 결함 목록 조회 API (현재는 목업 데이터 사용)
export const getDefects = async (params: GetDefectsParams): Promise<GetDefectsResponse> => {
  console.log('API CALLED: getDefects with params', params);

  // 실제 API 호출 시뮬레이션
  // const response = await apiClient.get('/defects', { params });
  // return response.data;

  // --- 임시 로직 ---
  await new Promise(resolve => setTimeout(resolve, 500)); // 0.5초 딜레이

  let filtered = mockDefects;

  if (params.coilId) {
    filtered = filtered.filter(d => d.coilId.toLowerCase().includes(params.coilId!.toLowerCase()));
  }
  if (params.defectType) {
    filtered = filtered.filter(d => d.defectType === params.defectType);
  }
  if (params.startDate) {
    filtered = filtered.filter(d => new Date(d.date.split(' ')[0]) >= new Date(params.startDate!));
  }
   if (params.endDate) {
    filtered = filtered.filter(d => new Date(d.date.split(' ')[0]) <= new Date(params.endDate!));
  }

  const totalCount = filtered.length;
  
  const page = params.page || 1;
  const limit = params.limit || 10;
  const startIndex = (page - 1) * limit;

  const data = filtered.slice(startIndex, startIndex + limit);

  return { data, totalCount };
  // --- 임시 로직 끝 ---
};

// 특정 결함 정보 수정 API
export const updateDefect = async (defectId: number, data: Partial<DefectData>): Promise<DefectData> => {
    console.log(`API CALLED: updateDefect for ${defectId} with data`, data);
    // const response = await apiClient.patch(`/defects/${defectId}`, data);
    // return response.data;
    
    // --- 임시 로직 ---
    await new Promise(resolve => setTimeout(resolve, 500));
    const defect = mockDefects.find(d => d.id === defectId);
    if (!defect) throw new Error("Defect not found");
    const updated = { ...defect, ...data };
    return updated;
    // --- 임시 로직 끝 ---
}