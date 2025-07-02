export interface ModelPerformance {
  precision: number;
  recall: number;
  f1Score: number;
  history: { month: string; accuracy: number }[];
}

export interface AiModel {
  id: string;
  name: string;
  version: string;
  status: 'active' | 'inactive' | 'archived';
  accuracy: number;
  createdAt: string;
  description: string;
  performance: ModelPerformance;
  type: 'Detection' | 'Classification';
}

export const mockModels: AiModel[] = [
  {
    id: 'model-001',
    name: 'ScratchNet',
    version: 'v2.1.0',
    status: 'active',
    accuracy: 98.5,
    createdAt: '2024-05-20T10:00:00Z',
    description: '고속 스크래치 검출에 최적화된 CNN 기반 모델',
    performance: {
      precision: 0.99,
      recall: 0.98,
      f1Score: 0.985,
      history: [
        { month: 'Jan', accuracy: 96.5 },
        { month: 'Feb', accuracy: 97.0 },
        { month: 'Mar', accuracy: 97.2 },
        { month: 'Apr', accuracy: 98.1 },
        { month: 'May', accuracy: 98.5 },
      ],
    },
    type: 'Detection',
  },
  {
    id: 'model-002',
    name: 'DefectClassifier',
    version: 'v1.5.2',
    status: 'active',
    accuracy: 95.2,
    createdAt: '2024-06-15T14:30:00Z',
    description: '다양한 유형의 결함을 분류하는 모델 (스크래치, 찍힘, 오염 등)',
    performance: {
      precision: 0.96,
      recall: 0.94,
      f1Score: 0.95,
      history: [
        { month: 'Feb', accuracy: 93.0 },
        { month: 'Mar', accuracy: 94.1 },
        { month: 'Apr', accuracy: 94.5 },
        { month: 'May', accuracy: 95.0 },
        { month: 'Jun', accuracy: 95.2 },
      ],
    },
    type: 'Classification',
  },
  {
    id: 'model-003',
    name: 'ScratchNet',
    version: 'v2.0.0',
    status: 'inactive',
    accuracy: 97.8,
    createdAt: '2024-03-10T09:00:00Z',
    description: '이전 버전의 스크래치 검출 모델',
     performance: {
      precision: 0.98,
      recall: 0.97,
      f1Score: 0.975,
      history: [
        { month: 'Dec', accuracy: 95.5 },
        { month: 'Jan', accuracy: 96.0 },
        { month: 'Feb', accuracy: 97.1 },
        { month: 'Mar', accuracy: 97.8 },
      ],
    },
    type: 'Detection',
  },
    {
    id: 'model-004',
    name: 'PinHole-Detector',
    version: 'v1.0.0',
    status: 'archived',
    accuracy: 99.2,
    createdAt: '2023-11-22T18:00:00Z',
    description: '핀홀 결함에 특화된 초기 모델',
     performance: {
      precision: 0.99,
      recall: 0.99,
      f1Score: 0.99,
      history: [
        { month: 'Sep', accuracy: 98.5 },
        { month: 'Oct', accuracy: 99.0 },
        { month: 'Nov', accuracy: 99.2 },
      ],
    },
    type: 'Detection',
  },
]; 