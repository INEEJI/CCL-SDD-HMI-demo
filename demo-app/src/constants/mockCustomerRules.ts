export interface Rule {
  defectType: string;
  sensitivity: number; // 0-100
  minSize: number; // in mm
  notify: boolean;
}

export interface Customer {
  id: string;
  name: string;
  rules: Rule[];
}

const defectTypes = ['Scratch', 'Dent', 'Stain', 'Pin-hole'];

export const mockCustomers: Customer[] = [
  {
    id: 'customer-a',
    name: '고객사 A',
    rules: defectTypes.map(type => ({
      defectType: type,
      sensitivity: Math.floor(Math.random() * 50) + 25, // 25-74
      minSize: parseFloat((Math.random() * 0.5 + 0.1).toFixed(2)), // 0.1-0.6
      notify: Math.random() > 0.5,
    })),
  },
  {
    id: 'customer-b',
    name: '고객사 B',
    rules: defectTypes.map(type => ({
      defectType: type,
      sensitivity: Math.floor(Math.random() * 50) + 40, // 40-89
      minSize: parseFloat((Math.random() * 0.4 + 0.2).toFixed(2)), // 0.2-0.6
      notify: Math.random() > 0.3,
    })),
  },
  {
    id: 'customer-c',
    name: '고객사 C',
    rules: defectTypes.map(type => ({
      defectType: type,
      sensitivity: Math.floor(Math.random() * 30) + 60, // 60-89
      minSize: parseFloat((Math.random() * 0.2 + 0.1).toFixed(2)), // 0.1-0.3
      notify: true,
    })),
  },
]; 