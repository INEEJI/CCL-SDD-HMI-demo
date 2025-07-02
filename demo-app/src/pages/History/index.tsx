import React, { useState, useEffect } from 'react';
import { getDefects } from '../../api/historyApi';
import type { DefectData } from '../../constants/mockDefects';
import toast from 'react-hot-toast';
import { MagnifyingGlassIcon, ArrowPathIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

const History: React.FC = () => {
  const [defects, setDefects] = useState<DefectData[]>([]);
  const [totalDefects, setTotalDefects] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({
    coilId: '',
    defectType: '',
    startDate: '',
    endDate: '',
  });
  const [selectedDefect, setSelectedDefect] = useState<DefectData | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const fetchDefects = async () => {
      setIsLoading(true);
      try {
        const response = await getDefects({
          ...filters,
          page: currentPage,
          limit: itemsPerPage,
        });
        setDefects(response.data);
        setTotalDefects(response.totalCount);
      } catch (error) {
        console.error("Failed to fetch defects:", error);
        toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDefects();
  }, [filters, currentPage]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilters({
      coilId: '',
      defectType: '',
      startDate: '',
      endDate: '',
    });
    setCurrentPage(1);
  };

  const totalPages = Math.ceil(totalDefects / itemsPerPage);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const getDefectTypeColor = (type: string) => {
    switch (type) {
      case 'Scratch': return 'text-danger bg-danger bg-opacity-10 border-danger';
      case 'Dent': return 'text-warning bg-warning bg-opacity-10 border-warning';
      case 'Scale': return 'text-secondary bg-secondary bg-opacity-10 border-secondary';
      case 'Pin hole': return 'text-highlight bg-highlight bg-opacity-10 border-highlight';
      default: return 'text-text-secondary bg-dark-elevated border-dark-border';
    }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">결함 이력 관리</h1>
        <div className="flex items-center space-x-2 text-sm text-text-muted">
          <span>총 {totalDefects}건의 결함 기록</span>
        </div>
      </div>

      {/* 고급 검색 및 필터 */}
      <div className="bg-dark-surface rounded-xl shadow-dark-lg border border-dark-border p-6">
        <div className="flex items-center space-x-3 mb-4">
          <MagnifyingGlassIcon className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-text-primary">고급 검색</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="space-y-1">
            <label htmlFor="coilId" className="block text-xs font-medium text-text-secondary">
              코일 ID
            </label>
            <input
              type="text"
              name="coilId"
              id="coilId"
              placeholder="예: C240725A-001"
              value={filters.coilId}
              onChange={handleFilterChange}
              className="w-full px-3 py-1.5 bg-dark-elevated border border-dark-border rounded-lg text-text-primary placeholder-text-muted focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            />
          </div>
          
          <div className="space-y-1">
            <label htmlFor="defectType" className="block text-xs font-medium text-text-secondary">
              결함 유형
            </label>
            <select
              name="defectType"
              id="defectType"
              value={filters.defectType}
              onChange={handleFilterChange}
              className="w-full px-3 py-1.5 bg-dark-elevated border border-dark-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            >
              <option value="">전체</option>
              <option value="Scratch">Scratch</option>
              <option value="Dent">Dent</option>
              <option value="Scale">Scale</option>
              <option value="Pin hole">Pin hole</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label htmlFor="startDate" className="block text-xs font-medium text-text-secondary">
              조회 시작일
            </label>
            <input
              type="date"
              name="startDate"
              id="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
              className="w-full px-3 py-1.5 bg-dark-elevated border border-dark-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            />
          </div>
          
          <div className="space-y-1">
            <label htmlFor="endDate" className="block text-xs font-medium text-text-secondary">
              조회 종료일
            </label>
            <input
              type="date"
              name="endDate"
              id="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
              className="w-full px-3 py-1.5 bg-dark-elevated border border-dark-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary focus:border-transparent transition-all duration-200"
            />
          </div>
          
          <button
            onClick={handleResetFilters}
            className="flex items-center justify-center space-x-2 px-4 py-1.5 bg-secondary text-white rounded-lg hover:bg-indigo-600 transition-all duration-200 transform hover:scale-105 font-medium"
          >
            <ArrowPathIcon className="h-4 w-4" />
            <span>초기화</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-300px)]">
        {/* 조업 실적 테이블 */}
        <div className="bg-dark-surface rounded-xl shadow-dark-lg border border-dark-border flex flex-col">
          <div className="p-4 border-b border-dark-border">
            <h2 className="text-lg font-semibold text-text-primary">
              조업 실적 <span className="text-primary">({totalDefects}건)</span>
            </h2>
          </div>
          
          <div className="flex-1 overflow-hidden relative">
            {isLoading && (
              <div className="absolute inset-0 bg-dark-bg bg-opacity-75 flex items-center justify-center z-10">
                <div className="flex flex-col items-center space-y-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                  <p className="text-text-secondary text-sm">데이터 로딩 중...</p>
                </div>
              </div>
            )}
            
            {!isLoading && defects.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-dark-elevated rounded-full flex items-center justify-center">
                    <MagnifyingGlassIcon className="h-8 w-8 text-text-muted" />
                  </div>
                  <p className="text-text-muted">조회된 데이터가 없습니다.</p>
                </div>
              </div>
            )}
            
            <div className="overflow-y-auto h-full">
              <table className="w-full text-sm">
                <thead className="bg-dark-elevated sticky top-0 z-10">
                  <tr>
                    {['날짜', '코일 ID', '결함 유형', '위치 (m)'].map(header => (
                      <th key={header} className="px-4 py-3 text-left font-semibold text-text-secondary border-b border-dark-border">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {defects.map((defect) => (
                    <tr
                      key={defect.id}
                      className={`border-b border-dark-border hover:bg-dark-elevated cursor-pointer transition-all duration-200 ${
                        selectedDefect?.id === defect.id ? 'bg-primary bg-opacity-10 border-primary' : ''
                      }`}
                      onClick={() => setSelectedDefect(defect)}
                    >
                      <td className="px-4 py-3 text-text-muted">{defect.date}</td>
                      <td className="px-4 py-3 text-text-primary font-medium font-mono">{defect.coilId}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getDefectTypeColor(defect.defectType)}`}>
                          {defect.defectType}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-text-primary font-mono">{defect.position}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-dark-border">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium bg-dark-elevated text-text-secondary border border-dark-border rounded-lg hover:bg-dark-border hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  <span>이전</span>
                </button>
                
                <span className="text-sm text-text-muted">
                  페이지 <span className="font-medium text-text-primary">{currentPage}</span> / {totalPages}
                </span>
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoading}
                  className="flex items-center space-x-2 px-3 py-2 text-sm font-medium bg-dark-elevated text-text-secondary border border-dark-border rounded-lg hover:bg-dark-border hover:text-text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  <span>다음</span>
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 상세 분석 뷰 */}
        <div className="bg-dark-surface rounded-xl shadow-dark-lg border border-dark-border flex flex-col">
          <div className="p-4 border-b border-dark-border">
            <h2 className="text-lg font-semibold text-text-primary">상세 분석</h2>
          </div>
          
          <div className="flex-1 p-4">
            {selectedDefect ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-text-primary">
                    {selectedDefect.coilId}
                  </h3>
                  <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getDefectTypeColor(selectedDefect.defectType)}`}>
                    {selectedDefect.defectType}
                  </span>
                </div>
                
                <div className="bg-black rounded-lg overflow-hidden border border-dark-border">
                  <img
                    src={selectedDefect.imageUrl}
                    alt="결함 이미지"
                    className="w-full h-64 object-contain"
                  />
                </div>
                
                <div className="bg-dark-elevated rounded-lg p-4 border border-dark-border">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">고객사</span>
                      <p className="text-text-primary font-medium">{selectedDefect.customer}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">결함 ID</span>
                      <p className="text-text-primary font-mono">{selectedDefect.id}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">발생 시각</span>
                      <p className="text-text-primary">{selectedDefect.date}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-medium text-text-muted uppercase tracking-wide">발생 위치</span>
                      <p className="text-text-primary font-mono">{selectedDefect.position}m</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-4 bg-dark-elevated rounded-full flex items-center justify-center">
                    <MagnifyingGlassIcon className="h-8 w-8 text-text-muted" />
                  </div>
                  <p className="text-text-muted">테이블에서 분석할 결함 항목을 선택하세요.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default History; 