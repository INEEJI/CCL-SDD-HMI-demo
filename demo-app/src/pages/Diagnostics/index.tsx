import React, { useState } from 'react';
import { CheckCircleIcon, XCircleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

const StatusIndicator: React.FC<{ label: string; isOk: boolean }> = ({ label, isOk }) => (
  <div className={`flex items-center justify-between p-4 rounded-lg shadow-sm ${isOk ? 'bg-green-50' : 'bg-red-50'}`}>
    <span className="text-lg font-medium text-dark">{label}</span>
    {isOk ? (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircleIcon className="h-7 w-7" />
        <span className="font-semibold">정상</span>
      </div>
    ) : (
      <div className="flex items-center gap-2 text-red-600">
        <XCircleIcon className="h-7 w-7" />
        <span className="font-semibold">오류</span>
      </div>
    )}
  </div>
);

const Diagnostics: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const systemStatus = {
    cameraConnection: true,
    lightingControl: true,
    dataStorage: false,
    networkConnection: true,
    aiModelService: true,
  };

  return (
    <div className="p-4 flex flex-col gap-6">
       <h1 className="text-2xl font-bold text-dark">시스템 진단</h1>

      {/* System Status Section */}
      <div className="bg-surface p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold mb-4 border-b pb-2 text-dark">실시간 시스템 상태</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <StatusIndicator label="카메라 연결" isOk={systemStatus.cameraConnection} />
          <StatusIndicator label="조명 제어 시스템" isOk={systemStatus.lightingControl} />
          <StatusIndicator label="데이터 저장소" isOk={systemStatus.dataStorage} />
          <StatusIndicator label="네트워크 연결" isOk={systemStatus.networkConnection} />
          <StatusIndicator label="AI 모델 서비스" isOk={systemStatus.aiModelService} />
        </div>
      </div>

      {/* Camera Calibration Section */}
      <div className="bg-surface p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-dark">카메라 보정 (Calibration)</h2>
        <p className="text-muted mb-4">
          카메라의 초점, 정렬, 스케일 등을 확인하고 보정합니다. 아래 버튼을 눌러 테스트 패턴을 확인하세요.
        </p>
        <div className="flex gap-4">
            <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2 bg-secondary text-white font-bold rounded-lg hover:bg-highlight transition-colors shadow"
            >
            테스트 패턴 보기
            </button>
            <a
                href="https://www.dpreview.com/reviews/testing-the-canon-eos-5d-mark-iv/5"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2 bg-gray-600 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors shadow"
            >
                외부 진단 페이지
                <ArrowTopRightOnSquareIcon className="h-5 w-5" />
            </a>
        </div>
      </div>

      {/* Calibration Pattern Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface p-4 rounded-xl shadow-2xl max-w-4xl w-full">
            <div className="flex justify-between items-center border-b pb-3 mb-4">
              <h3 className="text-xl font-bold text-dark">카메라 테스트 패턴</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 font-bold text-2xl p-1 rounded-full leading-none">&times;</button>
            </div>
            <div className="flex justify-center bg-background p-4 rounded-lg">
              <img src="https://i.stack.imgur.com/zE33A.png" alt="Camera Calibration Pattern" className="max-w-full h-auto rounded-md border" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Diagnostics; 