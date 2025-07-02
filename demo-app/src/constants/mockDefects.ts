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
  { id: '1', coilId: 'MOCK-COIL-001', date: '2024-07-02 10:30:15', customer: '(주)가상철강', defectType: 'Scratch', position: 150, imageUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?Text=Defect1' },
  { id: '2', coilId: 'MOCK-COIL-001', date: '2024-07-02 10:32:45', customer: '(주)가상철강', defectType: 'Dent', position: 850, imageUrl: 'https://via.placeholder.com/150/FF0000/FFFFFF?Text=Defect2' },
  { id: '3', coilId: 'MOCK-COIL-002', date: '2024-07-01 15:10:05', customer: '미래소재', defectType: 'Scale', position: 320, imageUrl: 'https://via.placeholder.com/150/00FF00/FFFFFF?Text=Defect3' },
  { id: '4', coilId: 'MOCK-COIL-002', date: '2024-07-01 15:12:20', customer: '미래소재', defectType: 'Scratch', position: 1240, imageUrl: 'https://via.placeholder.com/150/00FF00/FFFFFF?Text=Defect4' },
  { id: '5', coilId: 'MOCK-COIL-003', date: '2024-06-30 09:05:30', customer: '하이테크', defectType: 'Pin hole', position: 50, imageUrl: 'https://via.placeholder.com/150/0000FF/FFFFFF?Text=Defect5' },
]; 