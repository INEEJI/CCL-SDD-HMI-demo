import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useScheduleStore } from '../../store/scheduleStore';
import { mockSchedules } from '../../constants/mockSchedules';

const DataManagement: React.FC = () => {
  const { selectedSchedule, selectSchedule, setSchedules } = useScheduleStore();
  const [tempId, setTempId] = useState('');
  const [correctCoilId, setCorrectCoilId] = useState('');

  useEffect(() => {
    // Load schedules into the store on component mount
    setSchedules(mockSchedules);
  }, [setSchedules]);

  const handleRename = () => {
    if (!tempId || !correctCoilId) {
      toast.error('임시 ID와 변경할 코일 ID를 모두 입력해주세요.');
      return;
    }

    // 실제로는 서버 API를 호출하여 파일명을 변경
    console.log(`임시 ID "${tempId}"를 "${correctCoilId}"로 변경`);
    
    // 성공 시뮬레이션
    toast.success(`파일명이 성공적으로 변경되었습니다: ${tempId} → ${correctCoilId}`);
    
    // 입력 필드 초기화
    setTempId('');
    setCorrectCoilId('');
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-dark mb-0">데이터 관리</h1>
      {/* Schedule Selection */}
      <div className="bg-surface p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-dark mb-4">생산 스케줄 선택</h2>
        <div className="mb-4 p-4 bg-background border border-gray-200 rounded-lg">
          <p className="text-muted">
            현재 선택된 코일: {' '}
            <span className="font-semibold text-accent">
              {selectedSchedule ? `${selectedSchedule.coilId} (${selectedSchedule.customerName})` : '선택되지 않음'}
            </span>
          </p>
          <p className="text-sm text-gray-400 mt-1">선택된 코일 정보는 대시보드 등 다른 페이지에 연동됩니다.</p>
        </div>
        <div className="max-h-80 overflow-y-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-background sticky top-0">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">코일 ID</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">고객사</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">생산일시</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">작업</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockSchedules.map((schedule) => (
                <tr
                  key={schedule.coilId}
                  className={`transition-colors ${selectedSchedule?.coilId === schedule.coilId ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark">{schedule.coilId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{schedule.customerName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{new Date(schedule.createdAt).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <button
                      onClick={() => selectSchedule(schedule)}
                      className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        selectedSchedule?.coilId === schedule.coilId
                          ? 'bg-accent text-white cursor-not-allowed'
                          : 'bg-gray-200 text-muted hover:bg-highlight hover:text-white'
                      }`}
                      disabled={selectedSchedule?.coilId === schedule.coilId}
                    >
                      {selectedSchedule?.coilId === schedule.coilId ? '선택됨' : '선택'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Image File Renaming */}
      <div className="bg-surface p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold text-dark mb-4">이미지 파일명 일괄 변경</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label htmlFor="temp-id" className="block text-sm font-medium text-muted">임시 ID 검색</label>
            <input
              type="text"
              id="temp-id"
              value={tempId}
              onChange={(e) => setTempId(e.target.value)}
              placeholder="예: TEMP_0725_1130"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="md:col-span-1">
            <label htmlFor="correct-id" className="block text-sm font-medium text-muted">변경할 코일 ID</label>
            <input
              type="text"
              id="correct-id"
              value={correctCoilId}
              onChange={(e) => setCorrectCoilId(e.target.value)}
              placeholder="예: C240725A-001"
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div className="md:col-span-1">
            <button
              onClick={handleRename}
              className="w-full px-4 py-2 bg-secondary text-white font-bold rounded-lg hover:bg-highlight transition-colors shadow"
            >
              일괄 변경 실행
            </button>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          * 지정된 임시 ID와 연관된 모든 이미지 파일의 메타데이터(파일명)를 올바른 코일 ID 형식으로 변경합니다. (현재는 시뮬레이션)
        </p>
      </div>
    </div>
  );
};

export default DataManagement; 