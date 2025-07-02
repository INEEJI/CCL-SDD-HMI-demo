import React from 'react';

interface Defect {
  position: number;
  type: string;
}

interface CoilMapChartProps {
  coilLength: number;
  defects: Defect[];
}

const CoilMapChart: React.FC<CoilMapChartProps> = ({ coilLength, defects }) => {
  const chartWidth = 800;
  const chartHeight = 120;
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  const getDefectColor = (type: string) => {
    switch (type) {
      case 'Scratch': return '#EF4444'; // danger color
      case 'Dent': return '#F59E0B';    // warning color
      default: return '#6366F1';        // secondary color
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-hidden">
        <svg 
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="bg-dark-elevated rounded-lg border border-dark-border"
        >
          {/* 배경 그리드 */}
          <defs>
            <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#404040" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width={chartWidth} height={chartHeight} fill="url(#grid)" />
          
          {/* 차트 영역 배경 */}
          <rect
            x={margin.left}
            y={margin.top}
            width={innerWidth}
            height={innerHeight}
            fill="#262626"
            stroke="#404040"
            strokeWidth="1"
            rx="4"
          />
          
          {/* Y축 라벨 */}
          <text
            x={margin.left - 40}
            y={margin.top + innerHeight / 2}
            textAnchor="middle"
            className="fill-text-secondary text-xs"
            transform={`rotate(-90, ${margin.left - 40}, ${margin.top + innerHeight / 2})`}
          >
            코일 위치 (m)
          </text>
          
          {/* X축 라벨 */}
          <text
            x={margin.left + innerWidth / 2}
            y={chartHeight - 10}
            textAnchor="middle"
            className="fill-text-secondary text-xs"
          >
            시간 순서
          </text>
          
          {/* Y축 눈금 */}
          {[0, 500, 1000, 1500, 2000].map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left - 5}
                y1={margin.top + innerHeight - (tick / coilLength) * innerHeight}
                x2={margin.left}
                y2={margin.top + innerHeight - (tick / coilLength) * innerHeight}
                stroke="#A3A3A3"
                strokeWidth="1"
              />
              <text
                x={margin.left - 10}
                y={margin.top + innerHeight - (tick / coilLength) * innerHeight + 4}
                textAnchor="end"
                className="fill-text-muted text-xs"
              >
                {tick}
              </text>
            </g>
          ))}
          
          {/* 결함 포인트 */}
          {defects.map((defect, index) => {
            const x = margin.left + (index / Math.max(defects.length - 1, 1)) * innerWidth;
            const y = margin.top + innerHeight - (defect.position / coilLength) * innerHeight;
            const color = getDefectColor(defect.type);
            
            return (
              <g key={index}>
                {/* 결함 포인트 */}
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth="1"
                  className="drop-shadow-sm"
                />
                
                {/* 결함 타입 라벨 (최근 5개만 표시) */}
                {index >= defects.length - 5 && (
                  <text
                    x={x}
                    y={y - 8}
                    textAnchor="middle"
                    className="fill-text-primary text-xs font-medium"
                    style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
                  >
                    {defect.type}
                  </text>
                )}
                
                {/* 연결선 (이전 포인트와 연결) */}
                {index > 0 && (
                  <line
                    x1={margin.left + ((index - 1) / Math.max(defects.length - 1, 1)) * innerWidth}
                    y1={margin.top + innerHeight - (defects[index - 1].position / coilLength) * innerHeight}
                    x2={x}
                    y2={y}
                    stroke="#6366F1"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                    opacity="0.6"
                  />
                )}
              </g>
            );
          })}
          
          {/* 차트 제목 */}
          <text
            x={margin.left + innerWidth / 2}
            y={15}
            textAnchor="middle"
            className="fill-text-primary text-sm font-semibold"
          >
            실시간 결함 분포도
          </text>
        </svg>
      </div>
      
      {/* 범례 */}
      <div className="flex items-center justify-center space-x-6 mt-4 p-3 bg-dark-elevated rounded-lg border border-dark-border">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-danger"></div>
          <span className="text-sm text-text-secondary">Scratch</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-warning"></div>
          <span className="text-sm text-text-secondary">Dent</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-secondary opacity-60"></div>
          <span className="text-sm text-text-secondary">연결선</span>
        </div>
      </div>
    </div>
  );
};

export default CoilMapChart; 