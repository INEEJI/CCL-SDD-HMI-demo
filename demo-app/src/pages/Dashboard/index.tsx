import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import CoilMapChart from '../../components/common/CoilMapChart';
import { useScheduleStore } from '../../store/scheduleStore';
// 아이콘 import
import { Power, Settings, Video, CircuitBoard, AlertTriangle, Database, Info } from 'lucide-react';

interface Defect {
  position: number;
  type: string;
}

const Dashboard: React.FC = () => {
  const [isSystemOn, setIsSystemOn] = useState(true);
  const [sensitivity, setSensitivity] = useState(80);
  const [defects, setDefects] = useState<Defect[]>([]);
  const { selectedSchedule } = useScheduleStore();
  const coilLength = 2000; // 가상 코일 길이 (m)
  const lastNotificationTime = useRef(0);

  useEffect(() => {
    if (isSystemOn) {
      const interval = setInterval(() => {
        // 주기성 결함 발생 시뮬레이션을 위해 로직 수정
        let newDefect: Defect;
        const isPeriodicAttempt = Math.random() < 0.1; // 10% 확률로 주기성 결함 발생 시도

        if (isPeriodicAttempt && defects.length > 2) {
            // 마지막 결함이 Scratch일 때만 시도
            const lastDefect = defects[defects.length - 1];
            if(lastDefect.type === 'Scratch') {
                newDefect = { position: lastDefect.position + 50 + (Math.random() - 0.5) * 5, type: 'Scratch' };
            } else {
                 newDefect = { position: Math.floor(Math.random() * coilLength), type: 'Dent' };
            }
        } else {
            newDefect = {
                position: Math.floor(Math.random() * coilLength),
                type: Math.random() > 0.3 ? 'Scratch' : 'Dent', // Scratch 발생 확률 증가
            };
        }
        
        // 위치가 코일 길이를 넘지 않도록 조정
        if(newDefect.position >= coilLength) newDefect.position = coilLength -1;
        if(newDefect.position < 0) newDefect.position = 0;


        setDefects((prevDefects) => {
          const updatedDefects = [...prevDefects, newDefect];
          
          // 주기성 결함 감지 로직
          const now = Date.now();
          if (updatedDefects.length > 2 && now - lastNotificationTime.current > 10000) { // 10초 쿨다운
            const lastThree = updatedDefects.slice(-3);
            if (lastThree.every(d => d.type === 'Scratch')) {
              const d1 = lastThree[0], d2 = lastThree[1], d3 = lastThree[2];
              const isPeriodic = Math.abs((d2.position - d1.position) - 50) < 10 && Math.abs((d3.position - d2.position) - 50) < 10;
              if (isPeriodic) {
                toast.error(`주기성 결함 발생: 약 50m 간격으로 연속 스크래치 3회 감지!`, {
                  icon: <AlertTriangle className="text-warning" />,
                  style: {
                    background: '#2D333B',
                    color: '#C9D1D9',
                    border: '1px solid #F85149'
                  }
                });
                lastNotificationTime.current = now;
              }
            }
          }
          return updatedDefects;
        });
      }, 2000); // 2초마다 결함 추가

      return () => clearInterval(interval);
    }
  }, [isSystemOn]); // 'defects'를 의존성 배열에서 제거

  // 패널을 위한 스타일 컴포넌트
  const Panel = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-surface border border-border rounded-xl shadow-main backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
  
  const PanelHeader = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="p-4 border-b border-border flex items-center">
      {icon}
      <h2 className="text-lg font-semibold text-text-primary ml-3">{title}</h2>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* 상태 헤더 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-text-primary tracking-tight">실시간 모니터링</h1>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isSystemOn ? 'bg-accent animate-pulse' : 'bg-danger'}`}></div>
            <span className="font-semibold text-text-secondary">
              {isSystemOn ? '시스템 가동 중' : '시스템 중지'}
            </span>
          </div>
          <div className="text-md text-text-secondary">
            감지된 결함: <span className="text-warning font-bold">{defects.length}</span>개
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6" style={{ height: 'calc(100vh - 160px)' }}>
        {/* 메인 영상 및 차트 영역 */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          {/* 실시간 영상 패널 */}
          <Panel className="flex-grow-[3] flex flex-col">
            <PanelHeader icon={<Video className="text-primary" />} title="실시간 영상 스트림" />
            <div className="flex-grow bg-black/50 rounded-b-xl flex items-center justify-center text-text-secondary text-lg p-4">
              {isSystemOn ? (
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                  <p>카메라 스트림 연결 중...</p>
                </div>
              ) : (
                <p>시스템이 중지되었습니다</p>
              )}
            </div>
          </Panel>

          {/* 코일 전도 차트 */}
          <Panel className="flex-grow-[2] flex flex-col">
            <PanelHeader icon={<CircuitBoard className="text-primary" />} title="코일 전도 (Unrolled View)" />
            <div className="p-4 flex-grow">
              <CoilMapChart coilLength={coilLength} defects={defects} />
            </div>
          </Panel>
        </div>

        {/* 제어판 */}
        <Panel className="xl:col-span-1 p-6 flex flex-col">
          <div className="flex items-center border-b border-border pb-4 mb-6">
            <Settings className="text-primary w-6 h-6"/>
            <h2 className="text-xl font-bold text-text-primary ml-3">운영 제어판</h2>
          </div>
          
          <div className="space-y-6">
            {/* 시스템 제어 */}
            <div className="space-y-3">
              <h3 className="font-semibold text-text-secondary text-sm uppercase tracking-wider">시스템 제어</h3>
              <div className="bg-surface-elevated p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-text-primary">전원 상태</span>
                  <span className={`text-sm font-bold ${isSystemOn ? 'text-accent' : 'text-danger'}`}>
                    {isSystemOn ? 'ON' : 'OFF'}
                  </span>
                </div>
                <button
                  onClick={() => setIsSystemOn(!isSystemOn)}
                  className={`w-full flex items-center justify-center px-4 py-3 rounded-lg font-bold text-white transition-all duration-300 transform hover:scale-105 shadow-lg ${
                    isSystemOn 
                      ? 'bg-danger/80 hover:bg-danger' 
                      : 'bg-accent/80 hover:bg-accent'
                  }`}
                >
                  <Power className="w-5 h-5 mr-2" />
                  {isSystemOn ? '시스템 중지' : '시스템 시작'}
                </button>
              </div>
            </div>

            {/* 민감도 조절 */}
            <div className="space-y-3">
              <h3 className="font-semibold text-text-secondary text-sm uppercase tracking-wider">민감도 설정</h3>
              <div className="bg-surface-elevated p-4 rounded-lg border border-border">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-text-primary">민감도</span>
                  <span className="text-primary font-bold text-lg">{sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-full h-1.5 bg-border rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #58A6FF 0%, #58A6FF ${sensitivity}%, #30363D ${sensitivity}%, #30363D 100%)`
                  }}
                />
              </div>
            </div>

            {/* 현재 코일 정보 */}
            <div className="space-y-3">
               <h3 className="font-semibold text-text-secondary text-sm uppercase tracking-wider">현재 코일 정보</h3>
               {selectedSchedule ? (
                 <div className="bg-surface-elevated p-4 rounded-lg border border-border space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">코일 ID</span>
                    <span className="text-text-primary font-mono font-semibold">{selectedSchedule.coilId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">고객사</span>
                    <span className="text-text-primary font-semibold">{selectedSchedule.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">BOM ID</span>
                    <span className="text-text-primary font-mono font-semibold">{selectedSchedule.bomId}</span>
                  </div>
                 </div>
               ) : (
                 <div className="bg-surface-elevated p-4 rounded-lg border border-border text-center">
                   <Info className="mx-auto text-secondary mb-2" />
                   <p className="text-text-primary mb-1">선택된 코일 없음</p>
                   <p className="text-xs text-text-secondary">데이터 관리에서 스케줄을 선택하세요.</p>
                 </div>
               )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default Dashboard; 