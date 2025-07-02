import type { Schedule } from '../store/scheduleStore';

export const mockSchedules: Schedule[] = [
  {
    coilId: 'C240725A-001',
    customerName: '고객사 A',
    bomId: 'BOM-A-123',
    createdAt: '2024-07-25T09:00:00Z',
  },
  {
    coilId: 'C240725B-002',
    customerName: '고객사 B',
    bomId: 'BOM-B-456',
    createdAt: '2024-07-25T10:30:00Z',
  },
  {
    coilId: 'C240724C-003',
    customerName: '고객사 C',
    bomId: 'BOM-C-789',
    createdAt: '2024-07-24T14:00:00Z',
  },
  {
    coilId: 'C240724A-004',
    customerName: '고객사 A',
    bomId: 'BOM-A-124',
    createdAt: '2024-07-24T16:45:00Z',
  }
]; 