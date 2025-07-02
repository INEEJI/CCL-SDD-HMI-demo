import React, { useState, useRef, useEffect } from 'react';
import { mockModels } from '../../constants/mockModels';
import type { AiModel } from '../../constants/mockModels';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';
import { Line } from 'react-chartjs-2';
import toast from 'react-hot-toast';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const statusStyles = {
  active: 'bg-green-100 text-green-800 border border-green-200',
  inactive: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  archived: 'bg-gray-200 text-gray-800 border border-gray-300',
};

const ModelManagement: React.FC = () => {
  const [models, setModels] = useState<AiModel[]>(mockModels);
  const [selectedModel, setSelectedModel] = useState<AiModel | null>(models[0] || null);
  const chartRef = useRef<ChartJS<'line'>>(null);

  const handleSelectModel = (model: AiModel) => {
    setSelectedModel(model);
  };

  const handleDeployModel = () => {
    if (!selectedModel) return;
    if (selectedModel.status === 'active') {
      alert(`모델 '${selectedModel.name} (${selectedModel.version})'은(는) 이미 활성화 상태입니다.`);
      return;
    }
    if (window.confirm(`'${selectedModel.name} (${selectedModel.version})' 모델을 검출 시스템에 배포하시겠습니까?`)) {
      // Simulate deployment
      const updatedModels = models.map(m => {
        if (m.status === 'active') return { ...m, status: 'inactive' as const };
        if (m.id === selectedModel.id) return { ...m, status: 'active' as const };
        return m;
      });
      setModels(updatedModels);
      setSelectedModel(prev => prev ? { ...prev, status: 'active' } : null);
      toast.success(`${selectedModel.name} (${selectedModel.version})이 활성 모델로 배포되었습니다.`);
      console.log(`Deployed model: ${selectedModel.id}`);
    }
  };
  
  const chartData = {
    labels: selectedModel?.performance.history.map(h => h.month) || [],
    datasets: [
      {
        label: '월별 정확도 (%)',
        data: selectedModel?.performance.history.map(h => h.accuracy) || [],
        borderColor: 'rgb(54, 162, 235)',
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: '모델 성능 이력' },
    },
    scales: { y: { min: 80, max: 100 } },
  };

  return (
    <div className="p-4 flex flex-col gap-6">
      <h1 className="text-2xl font-bold text-dark">AI 모델 관리</h1>

      {/* Models List Table */}
      <div className="bg-surface p-6 rounded-xl shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-dark">모델 목록</h2>
        <div className="max-h-[22rem] overflow-y-auto border rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-background sticky top-0">
              <tr>
                {['모델명', '버전', '타입', '정확도', '상태', '생성일'].map(h => (
                  <th key={h} className="px-6 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {models.map((model) => (
                <tr key={model.id} onClick={() => handleSelectModel(model)} className={`cursor-pointer transition-colors ${selectedModel?.id === model.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-dark">{model.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{model.version}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{model.type}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">{model.accuracy.toFixed(2)}%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[model.status]}`}>
                      {model.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">{new Date(model.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Model Details & Actions */}
      {selectedModel && (
        <div className="bg-surface p-6 rounded-xl shadow-lg">
          <h2 className="text-2xl font-bold mb-4 text-secondary">{selectedModel.name} ({selectedModel.version})</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Details & Performance */}
            <div className="lg:col-span-2">
              <p className="text-muted mb-4">{selectedModel.description}</p>
              <div className="grid grid-cols-3 gap-4 text-center mb-4 p-4 bg-background rounded-lg">
                <div>
                  <div className="text-sm text-muted">Precision</div>
                  <div className="text-2xl font-bold text-accent">{selectedModel.performance.precision.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">Recall</div>
                  <div className="text-2xl font-bold text-accent">{selectedModel.performance.recall.toFixed(3)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted">F1-Score</div>
                  <div className="text-2xl font-bold text-accent">{selectedModel.performance.f1Score.toFixed(3)}</div>
                </div>
              </div>
              <div className="h-64 relative mt-4">
                <Line ref={chartRef} options={chartOptions} data={chartData} />
              </div>
            </div>

            {/* Right Column: Actions */}
            <div className="space-y-6 bg-background p-6 rounded-lg border">
              <div>
                <h3 className="text-lg font-semibold mb-3 text-dark">모델 배포</h3>
                <button onClick={handleDeployModel} className="w-full px-4 py-2 bg-primary text-white font-bold rounded-lg hover:bg-highlight transition-colors shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed" disabled={selectedModel.status === 'active' || selectedModel.status === 'archived'}>
                  {selectedModel.status === 'active' ? '현재 활성 모델' : (selectedModel.status === 'archived' ? '보관된 모델' : '이 모델 배포하기')}
                </button>
              </div>
               <div>
                <h3 className="text-lg font-semibold mb-3 text-dark">다중 모델 설정</h3>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input id="detection-model" name="model-type" type="radio" className="h-4 w-4 text-accent border-gray-300 focus:ring-accent" defaultChecked={selectedModel.type === 'Detection'} />
                    <label htmlFor="detection-model" className="ml-3 block text-sm font-medium text-muted">단순 불량 판정</label>
                  </div>
                  <div className="flex items-center">
                    <input id="classification-model" name="model-type" type="radio" className="h-4 w-4 text-accent border-gray-300 focus:ring-accent" defaultChecked={selectedModel.type === 'Classification'} />
                    <label htmlFor="classification-model" className="ml-3 block text-sm font-medium text-muted">유형 분류</label>
                  </div>
                </div>
              </div>
               <div>
                <h3 className="text-lg font-semibold mb-3 text-dark">BOM별 모델 설정</h3>
                <select className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-lg">
                  <option>BOM-A-123 (현재 모델)</option>
                  <option>BOM-B-456</option>
                  <option>BOM-C-789</option>
                </select>
                 <button className="mt-2 w-full px-4 py-2 bg-gray-600 text-white text-sm font-semibold rounded-lg hover:bg-gray-700">설정 저장</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelManagement; 