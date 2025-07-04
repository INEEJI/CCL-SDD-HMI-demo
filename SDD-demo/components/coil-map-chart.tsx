"use client"

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Filter,
  Eye,
  EyeOff,
  Maximize2
} from 'lucide-react';

interface Defect {
  position: number;
  type: string;
  severity?: 'low' | 'medium' | 'high';
  timestamp?: Date;
  confidence?: number;
  id?: number;
}

interface CoilMapChartProps {
  coilLength: number;
  defects: Defect[];
  coilId?: string;
  onDefectClick?: (defect: Defect) => void;
  height?: number;
}

const CoilMapChart: React.FC<CoilMapChartProps> = ({ 
  coilLength, 
  defects, 
  coilId = "COIL-001",
  onDefectClick,
  height = 300
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedDefectTypes, setSelectedDefectTypes] = useState<string[]>(['Scratch', 'Dent', 'Stain', 'Crack']);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [showLabels, setShowLabels] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [hoveredDefect, setHoveredDefect] = useState<Defect | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const chartWidth = 900;
  const chartHeight = height;
  const margin = { top: 30, right: 40, bottom: 60, left: 80 };
  const innerWidth = chartWidth - margin.left - margin.right;
  const innerHeight = chartHeight - margin.top - margin.bottom;

  // 필터링된 결함 데이터
  const filteredDefects = defects.filter(defect => {
    const typeMatch = selectedDefectTypes.includes(defect.type);
    const severityMatch = severityFilter === 'all' || defect.severity === severityFilter;
    return typeMatch && severityMatch;
  });

  // 결함 유형별 색상 및 설정
  const getDefectConfig = (type: string, severity?: string) => {
    const configs = {
      'Scratch': { 
        color: '#EF4444', 
        shape: 'circle',
        size: severity === 'high' ? 6 : severity === 'medium' ? 5 : 4
      },
      'Dent': { 
        color: '#F59E0B', 
        shape: 'square',
        size: severity === 'high' ? 6 : severity === 'medium' ? 5 : 4
      },
      'Stain': { 
        color: '#8B5CF6', 
        shape: 'diamond',
        size: severity === 'high' ? 6 : severity === 'medium' ? 5 : 4
      },
      'Crack': { 
        color: '#DC2626', 
        shape: 'triangle',
        size: severity === 'high' ? 7 : severity === 'medium' ? 6 : 5
      }
    };
    return configs[type as keyof typeof configs] || { color: '#6366F1', shape: 'circle', size: 4 };
  };

  // 줌 제어
  const handleZoom = (direction: 'in' | 'out') => {
    setZoom(prev => {
      const newZoom = direction === 'in' ? prev * 1.2 : prev / 1.2;
      return Math.max(0.5, Math.min(5, newZoom));
    });
  };

  // 리셋
  const handleReset = () => {
    setZoom(1);
  };

  // 결함 유형 토글
  const toggleDefectType = (type: string) => {
    setSelectedDefectTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  // SVG 내에서 결함 포인트 렌더링
  const renderDefectPoint = (defect: Defect, index: number) => {
    const x = margin.left + (index / Math.max(filteredDefects.length - 1, 1)) * innerWidth;
    const y = margin.top + innerHeight - (defect.position / coilLength) * innerHeight;
    const config = getDefectConfig(defect.type, defect.severity);
    
    return (
      <g key={defect.id || index}>
        {/* 결함 포인트 */}
        {config.shape === 'circle' && (
          <circle
            cx={x}
            cy={y}
            r={config.size * zoom}
            fill={config.color}
            stroke="#FFFFFF"
            strokeWidth="1.5"
            className="cursor-pointer hover:stroke-yellow-400 transition-colors"
            onMouseEnter={() => setHoveredDefect(defect)}
            onMouseLeave={() => setHoveredDefect(null)}
            onClick={() => onDefectClick?.(defect)}
          />
        )}
        
        {config.shape === 'square' && (
          <rect
            x={x - config.size * zoom}
            y={y - config.size * zoom}
            width={config.size * zoom * 2}
            height={config.size * zoom * 2}
            fill={config.color}
            stroke="#FFFFFF"
            strokeWidth="1.5"
            className="cursor-pointer hover:stroke-yellow-400 transition-colors"
            onMouseEnter={() => setHoveredDefect(defect)}
            onMouseLeave={() => setHoveredDefect(null)}
            onClick={() => onDefectClick?.(defect)}
          />
        )}
        
        {config.shape === 'diamond' && (
          <polygon
            points={`${x},${y-config.size*zoom} ${x+config.size*zoom},${y} ${x},${y+config.size*zoom} ${x-config.size*zoom},${y}`}
            fill={config.color}
            stroke="#FFFFFF"
            strokeWidth="1.5"
            className="cursor-pointer hover:stroke-yellow-400 transition-colors"
            onMouseEnter={() => setHoveredDefect(defect)}
            onMouseLeave={() => setHoveredDefect(null)}
            onClick={() => onDefectClick?.(defect)}
          />
        )}
        
        {config.shape === 'triangle' && (
          <polygon
            points={`${x},${y-config.size*zoom} ${x-config.size*zoom},${y+config.size*zoom} ${x+config.size*zoom},${y+config.size*zoom}`}
            fill={config.color}
            stroke="#FFFFFF"
            strokeWidth="1.5"
            className="cursor-pointer hover:stroke-yellow-400 transition-colors"
            onMouseEnter={() => setHoveredDefect(defect)}
            onMouseLeave={() => setHoveredDefect(null)}
            onClick={() => onDefectClick?.(defect)}
          />
        )}
        
        {/* 결함 라벨 */}
        {showLabels && (hoveredDefect === defect || filteredDefects.length <= 20) && (
          <text
            x={x}
            y={y - config.size * zoom - 8}
            textAnchor="middle"
            className="fill-white text-xs font-medium pointer-events-none"
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.8)' }}
          >
            {defect.type}
          </text>
        )}
        
        {/* 연결선 */}
        {index > 0 && (
          <line
            x1={margin.left + ((index - 1) / Math.max(filteredDefects.length - 1, 1)) * innerWidth}
            y1={margin.top + innerHeight - (filteredDefects[index - 1].position / coilLength) * innerHeight}
            x2={x}
            y2={y}
            stroke="#6366F1"
            strokeWidth="1"
            strokeDasharray="2,2"
            opacity="0.4"
          />
        )}
      </g>
    );
  };

  return (
    <div className={`w-full ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900 p-4' : 'h-full'} flex flex-col`}>
      {/* 컨트롤 패널 */}
      <div className="flex items-center justify-between mb-4 p-3 bg-gray-800/50 rounded-lg border border-gray-600">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleZoom('in')}
              className="text-white border-gray-600"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleZoom('out')}
              className="text-white border-gray-600"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-white border-gray-600"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLabels(!showLabels)}
              className="text-white border-gray-600"
            >
              {showLabels ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              className="text-white border-gray-600"
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="w-32 text-white border-gray-600">
              <SelectValue placeholder="심각도" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체</SelectItem>
              <SelectItem value="high">높음</SelectItem>
              <SelectItem value="medium">중간</SelectItem>
              <SelectItem value="low">낮음</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2">
          <Badge variant="outline" className="text-white border-gray-600">
            줌: {Math.round(zoom * 100)}%
          </Badge>
          <Badge variant="outline" className="text-white border-gray-600">
            결함: {filteredDefects.length}개
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="text-white border-gray-600"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="flex-1 relative overflow-hidden">
        <svg 
          ref={svgRef}
          width="100%" 
          height="100%" 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="bg-gray-900 rounded-lg border border-gray-600"
        >
          {/* 배경 그리드 */}
          {showGrid && (
            <>
              <defs>
                <pattern id="grid" width="40" height="20" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 20" fill="none" stroke="#404040" strokeWidth="0.5" opacity="0.3"/>
                </pattern>
              </defs>
              <rect width={chartWidth} height={chartHeight} fill="url(#grid)" />
            </>
          )}
          
          {/* 차트 영역 배경 */}
          <rect
            x={margin.left}
            y={margin.top}
            width={innerWidth}
            height={innerHeight}
            fill="#1F2937"
            stroke="#4B5563"
            strokeWidth="1"
            rx="4"
          />
          
          {/* Y축 */}
          <g>
            <text
              x={margin.left - 50}
              y={margin.top + innerHeight / 2}
              textAnchor="middle"
              className="fill-gray-400 text-sm font-medium"
              transform={`rotate(-90, ${margin.left - 50}, ${margin.top + innerHeight / 2})`}
            >
              코일 위치 (m)
            </text>
            
            {/* Y축 눈금 */}
            {[0, coilLength * 0.25, coilLength * 0.5, coilLength * 0.75, coilLength].map((tick) => (
              <g key={tick}>
                <line
                  x1={margin.left - 5}
                  y1={margin.top + innerHeight - (tick / coilLength) * innerHeight}
                  x2={margin.left + innerWidth}
                  y2={margin.top + innerHeight - (tick / coilLength) * innerHeight}
                  stroke="#374151"
                  strokeWidth="1"
                  strokeDasharray="2,2"
                />
                <text
                  x={margin.left - 10}
                  y={margin.top + innerHeight - (tick / coilLength) * innerHeight + 4}
                  textAnchor="end"
                  className="fill-gray-500 text-xs"
                >
                  {Math.round(tick)}m
                </text>
              </g>
            ))}
          </g>
          
          {/* X축 */}
          <g>
            <text
              x={margin.left + innerWidth / 2}
              y={chartHeight - 20}
              textAnchor="middle"
              className="fill-gray-400 text-sm font-medium"
            >
              시간 순서 ({coilId})
            </text>
            
            {/* X축 눈금 */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const x = margin.left + ratio * innerWidth;
              const index = Math.round(ratio * (filteredDefects.length - 1));
              return (
                <g key={ratio}>
                  <line
                    x1={x}
                    y1={margin.top}
                    x2={x}
                    y2={margin.top + innerHeight + 5}
                    stroke="#374151"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <text
                    x={x}
                    y={margin.top + innerHeight + 20}
                    textAnchor="middle"
                    className="fill-gray-500 text-xs"
                  >
                    {index + 1}
                  </text>
                </g>
              );
            })}
          </g>
          
          {/* 결함 포인트들 */}
          {filteredDefects.map((defect, index) => renderDefectPoint(defect, index))}
          
          {/* 차트 제목 */}
          <text
            x={margin.left + innerWidth / 2}
            y={20}
            textAnchor="middle"
            className="fill-white text-lg font-bold"
          >
            코일별 결함 시각화 - {coilId}
          </text>
        </svg>
        
        {/* 호버 툴팁 */}
        {hoveredDefect && (
          <div className="absolute top-4 right-4 bg-gray-800 border border-gray-600 rounded-lg p-3 text-white text-sm z-10">
            <div className="font-semibold">{hoveredDefect.type}</div>
            <div>위치: {hoveredDefect.position}m</div>
            {hoveredDefect.severity && <div>심각도: {hoveredDefect.severity}</div>}
            {hoveredDefect.confidence && <div>신뢰도: {hoveredDefect.confidence}%</div>}
            {hoveredDefect.timestamp && (
              <div>시간: {hoveredDefect.timestamp.toLocaleTimeString('ko-KR')}</div>
            )}
          </div>
        )}
      </div>
      
      {/* 범례 및 필터 */}
      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg border border-gray-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <Label className="text-white font-medium">결함 유형:</Label>
            {['Scratch', 'Dent', 'Stain', 'Crack'].map(type => {
              const config = getDefectConfig(type);
              const isSelected = selectedDefectTypes.includes(type);
              const count = defects.filter(d => d.type === type).length;
              
              return (
                <button
                  key={type}
                  onClick={() => toggleDefectType(type)}
                  className={`flex items-center space-x-2 px-3 py-1 rounded-md border transition-colors ${
                    isSelected 
                      ? 'bg-gray-700 border-gray-500' 
                      : 'bg-gray-800 border-gray-600 opacity-50'
                  }`}
                >
                  <div 
                    className="w-3 h-3 rounded-sm" 
                    style={{ backgroundColor: config.color }}
                  />
                  <span className="text-sm text-gray-300">{type}</span>
                  <Badge variant="secondary" className="text-xs">
                    {count}
                  </Badge>
                </button>
              );
            })}
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Label className="text-white text-sm">심각도별:</Label>
              <div className="flex space-x-1">
                {['high', 'medium', 'low'].map(severity => {
                  const colors = { high: '#DC2626', medium: '#F59E0B', low: '#10B981' };
                  const count = defects.filter(d => d.severity === severity).length;
                  return (
                    <div key={severity} className="flex items-center space-x-1">
                      <div 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: colors[severity as keyof typeof colors] }}
                      />
                      <span className="text-xs text-gray-400">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoilMapChart; 