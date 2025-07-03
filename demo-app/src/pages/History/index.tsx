import React, { useState, useEffect } from 'react';
import { getDefects } from '../../api/historyApi';
import type { DefectData } from '../../constants/mockDefects';
import toast from 'react-hot-toast';
import { Search, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'; // 아이콘 변경

const History: React.FC = () => {
  const [defects, setDefects] = useState<DefectData[]>([]);
  const [totalDefects, setTotalDefects] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ coilId: '', defectType: '', startDate: '', endDate: '' });
  const [selectedDefect, setSelectedDefect] = useState<DefectData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchDefects = async () => {
      setIsLoading(true);
      try {
        const response = await getDefects({ ...filters, page: currentPage, limit: itemsPerPage });
        setDefects(response.data);
        setTotalDefects(response.totalCount);
      } catch (error) {
        toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchDefects();
  }, [filters, currentPage]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters(prev => ({ ...prev, [name]: e.target.value }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({ coilId: '', defectType: '', startDate: '', endDate: '' });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalDefects / itemsPerPage);
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage);
  };

  const getDefectTypeColor = (type: string) => {
    switch (type) {
      case 'Scratch': return 'text-danger bg-danger/10 border-danger/30';
      case 'Dent': return 'text-warning bg-warning/10 border-warning/30';
      case 'Scale': return 'text-secondary bg-secondary/10 border-secondary/30';
      default: return 'text-text-secondary bg-surface-elevated border-border';
    }
  };
  
  const Panel = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-surface border border-border rounded-xl shadow-main backdrop-blur-xl flex flex-col ${className}`}>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">결함 이력 관리</h1>
        <span className="text-text-secondary">총 {totalDefects}건의 결함 기록</span>
      </div>

      <Panel className="p-6">
        <div className="flex items-center space-x-3 mb-4">
          <Search className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">고급 검색</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          {/* Input Fields */}
          <input name="coilId" placeholder="코일 ID" onChange={handleFilterChange} className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg" />
          <select name="defectType" onChange={handleFilterChange} className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg">
            <option value="">전체 유형</option>
            <option>Scratch</option>
            <option>Dent</option>
            <option>Scale</option>
          </select>
          <input type="date" name="startDate" onChange={handleFilterChange} className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg" />
          <input type="date" name="endDate" onChange={handleFilterChange} className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg" />
          <button onClick={handleResetFilters} className="flex items-center justify-center space-x-2 px-4 py-2 bg-secondary/80 text-white rounded-lg hover:bg-secondary">
            <RotateCcw className="h-4 w-4" />
            <span>초기화</span>
          </button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 350px)' }}>
        <Panel>
          {/* Table content... (스타일 클래스만 bg-surface 등으로 교체) */}
        </Panel>
        <Panel>
          {/* Details content... (스타일 클래스만 bg-surface 등으로 교체) */}
        </Panel>
      </div>
    </div>
  );
};

export default History;