export interface DefectData {
  id: string;
  coilId: string;
  date: string;
  customer: string;
  defectType: string;
  position: number;
  imageUrl: string;
}

export const mockDefects: DefectData[] = [
  { 
    id: '1', 
    coilId: 'C240725A-001', 
    date: '2024-07-02 10:30:15', 
    customer: '고객사 A', 
    defectType: 'Scratch', 
    position: 150, 
    imageUrl: '/images/20250409135914_1730_crop_3.jpg' 
  },
  { 
    id: '2', 
    coilId: 'C240725A-001', 
    date: '2024-07-02 10:32:45', 
    customer: '고객사 A', 
    defectType: 'Dent', 
    position: 850, 
    imageUrl: '/images/20250409135914_1730_crop_4.jpg' 
  },
  { 
    id: '3', 
    coilId: 'C240725B-002', 
    date: '2024-07-01 15:10:05', 
    customer: '고객사 B', 
    defectType: 'Scale', 
    position: 320, 
    imageUrl: '/images/20250409135914_1731_crop_3.jpg' 
  },
  { 
    id: '4', 
    coilId: 'C240725B-002', 
    date: '2024-07-01 15:12:20', 
    customer: '고객사 B', 
    defectType: 'Scratch', 
    position: 1240, 
    imageUrl: '/images/20250409135914_1731_crop_4.jpg' 
  },
  { 
    id: '5', 
    coilId: 'C240724C-003', 
    date: '2024-06-30 09:05:30', 
    customer: '고객사 C', 
    defectType: 'Pin hole', 
    position: 50, 
    imageUrl: '/images/20250409135914_1732_crop_3.jpg' 
  },
  { 
    id: '6', 
    coilId: 'C240724C-003', 
    date: '2024-06-30 09:08:15', 
    customer: '고객사 C', 
    defectType: 'Scratch', 
    position: 450, 
    imageUrl: '/images/20250409135914_1732_crop_4.jpg' 
  },
  { 
    id: '7', 
    coilId: 'C240724A-004', 
    date: '2024-06-29 14:20:30', 
    customer: '고객사 A', 
    defectType: 'Dent', 
    position: 780, 
    imageUrl: '/images/20250409135914_1733_crop_3.jpg' 
  },
  { 
    id: '8', 
    coilId: 'C240724A-004', 
    date: '2024-06-29 14:25:45', 
    customer: '고객사 A', 
    defectType: 'Scale', 
    position: 1200, 
    imageUrl: '/images/20250409135914_1733_crop_4.jpg' 
  },
]; 