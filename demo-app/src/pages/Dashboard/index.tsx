import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import CoilMapChart from '../../components/common/CoilMapChart';
import { useScheduleStore } from '../../store/scheduleStore';
import { Power, Settings, Video, CircuitBoard, AlertTriangle, Info } from 'lucide-react';

interface Defect {
  position: number;
  type: string;
}

const Dashboard: React.FC = () => {
  const [isSystemOn, setIsSystemOn] = useState(true);
  const [sensitivity, setSensitivity] = useState(80);
  const [defects, setDefects] = useState<Defect[]>([]);
  const { selectedSchedule } = useScheduleStore();
  const coilLength = 2000;
  const lastNotificationTime = useRef(0);

  useEffect(() => {
    if (isSystemOn) {
      const interval = setInterval(() => {
        setDefects((prevDefects) => {
          let newDefect: Defect;
          const isPeriodicAttempt = Math.random() < 0.1;

          if (isPeriodicAttempt && prevDefects.length > 2) {
            const lastDefect = prevDefects[prevDefects.length - 1];
            if (lastDefect.type === 'Scratch') {
              newDefect = { position: lastDefect.position + 50 + (Math.random() - 0.5) * 5, type: 'Scratch' };
            } else {
              newDefect = { position: Math.floor(Math.random() * coilLength), type: 'Dent' };
            }
          } else {
            newDefect = {
              position: Math.floor(Math.random() * coilLength),
              type: Math.random() > 0.3 ? 'Scratch' : 'Dent',
            };
          }

          if (newDefect.position >= coilLength) newDefect.position = coilLength - 1;
          if (newDefect.position < 0) newDefect.position = 0;

          const updatedDefects = [...prevDefects, newDefect];

          const now = Date.now();
          if (updatedDefects.length > 2 && now - lastNotificationTime.current > 10000) {
            const lastThree = updatedDefects.slice(-3);
            if (lastThree.every(d => d.type === 'Scratch')) {
              const d1 = lastThree[0], d2 = lastThree[1], d3 = lastThree[2];
              const isPeriodic = Math.abs((d2.position - d1.position) - 50) < 10 && Math.abs((d3.position - d2.position) - 50) < 10;
              if (isPeriodic) {
                toast.error(`주기성 결함 발생: 약 50m 간격으로 연속 스크래치 3회 감지!`);
              }
            }
          }
          return updatedDefects;
        });
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isSystemOn, coilLength]);

  // 패널 스타일을 위한 헬퍼 컴포넌트
  const Panel = ({ children, className = '' }: { children: React.ReactNode, className?: string }) => (
    <div className={`bg-surface border border-border-color rounded-lg shadow-sm ${className}`}>
      {children}
    </div>
  );

  // 패널 헤더 스타일을 위한 헬퍼 컴포넌트
  const PanelHeader = ({ icon, title }: { icon: React.ReactNode, title: string }) => (
    <div className="p-4 border-b border-border-color flex items-center">
      {icon}
      <h2 className="text-lg font-bold text-text-primary ml-2">{title}</h2>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">실시간 모니터링</h1>
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isSystemOn ? 'bg-success' : 'bg-danger'}`}></div>
            <span className="font-semibold text-text-secondary">
              {isSystemOn ? '시스템 가동 중' : '시스템 중지'}
            </span>
          </div>
          <div className="text-text-secondary">
            감지된 결함: <span className="text-danger font-bold">{defects.length}</span>개
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3 flex flex-col gap-6">
          <Panel className="flex-grow-[3] flex flex-col">
            <PanelHeader icon={<Video className="text-primary" />} title="실시간 영상 스트림" />
            <div className="flex-grow bg-gray-900 rounded-b-lg flex items-center justify-center text-white p-4">
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
          <Panel className="flex-grow-[2] flex flex-col">
            <PanelHeader icon={<CircuitBoard className="text-primary" />} title="코일 전도 (Unrolled View)" />
            <div className="p-4 flex-grow">
              <CoilMapChart coilLength={coilLength} defects={defects} />
            </div>
          </Panel>
        </div>

        <Panel className="xl:col-span-1 p-4 flex flex-col">
          <PanelHeader icon={<Settings className="text-primary" />} title="운영 제어판" />
          <div className="p-2 space-y-6 mt-2">
            <div className="space-y-2">
              <h3 className="font-semibold text-text-secondary text-sm">시스템 제어</h3>
              <div className="bg-background p-3 rounded-md border border-border-color">
                <button
                  onClick={() => setIsSystemOn(!isSystemOn)}
                  className={`w-full flex items-center justify-center px-4 py-2 rounded-md font-bold text-white transition-colors shadow-sm ${isSystemOn ? 'bg-danger hover:bg-red-600' : 'bg-success hover:bg-green-600'}`}
                >
                  <Power className="w-4 h-4 mr-2" />
                  {isSystemOn ? '시스템 중지' : '시스템 시작'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-text-secondary text-sm">민감도 설정</h3>
              <div className="bg-background p-3 rounded-md border border-border-color">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-primary">민감도</span>
                  <span className="text-primary font-bold text-lg">{sensitivity}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(Number(e.target.value))}
                  className="w-full h-2 bg-border-color rounded-lg appearance-none cursor-pointer slider"
                />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-text-secondary text-sm">현재 코일 정보</h3>
              {selectedSchedule ? (
                <div className="bg-background p-3 rounded-md border border-border-color space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">코일 ID:</span>
                    <span className="text-text-primary font-mono font-semibold">{selectedSchedule.coilId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">고객사:</span>
                    <span className="text-text-primary font-semibold">{selectedSchedule.customerName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">BOM ID:</span>
                    <span className="text-text-primary font-mono font-semibold">{selectedSchedule.bomId}</span>
                  </div>
                </div>
              ) : (
                <div className="bg-background p-4 rounded-md border border-border-color text-center text-sm text-text-secondary">
                  <Info className="mx-auto h-6 w-6 mb-2" />
                  선택된 코일 없음
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
