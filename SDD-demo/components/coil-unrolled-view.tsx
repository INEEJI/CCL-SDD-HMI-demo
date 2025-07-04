"use client"

import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Maximize2,
  MapPin,
  Ruler,
  Info
} from "lucide-react"

interface DefectPosition {
  id: string
  position: number // 위치 (미터)
  defectType: string
  severity: 'low' | 'medium' | 'high'
  date: string
  coilId: string
}

interface CoilUnrolledViewProps {
  coilId: string
  coilLength: number // 코일 전체 길이 (미터)
  defects: DefectPosition[]
  currentPosition?: number // 현재 진행 위치
  onDefectClick?: (defect: DefectPosition) => void
  className?: string
}

export default function CoilUnrolledView({
  coilId,
  coilLength,
  defects,
  currentPosition,
  onDefectClick,
  className = ""
}: CoilUnrolledViewProps) {
  const [scale, setScale] = useState(1)
  const [scrollPosition, setScrollPosition] = useState(0)
  const [hoveredDefect, setHoveredDefect] = useState<DefectPosition | null>(null)
  const [selectedDefect, setSelectedDefect] = useState<DefectPosition | null>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const coilRef = useRef<HTMLDivElement>(null)

  // 결함 유형별 색상 정의
  const getDefectColor = (type: string, severity: string) => {
    const colors = {
      'Scratch': {
        low: '#fbbf24',
        medium: '#f59e0b', 
        high: '#d97706'
      },
      'Dent': {
        low: '#60a5fa',
        medium: '#3b82f6',
        high: '#1d4ed8'
      },
      'Scale': {
        low: '#34d399',
        medium: '#10b981',
        high: '#059669'
      },
      'Pin hole': {
        low: '#f472b6',
        medium: '#ec4899',
        high: '#be185d'
      }
    }
    return colors[type as keyof typeof colors]?.[severity as keyof typeof colors.Scratch] || '#6b7280'
  }

  // 줌 인
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev * 1.5, 10))
  }

  // 줌 아웃
  const handleZoomOut = () => {
    setScale(prev => Math.max(prev / 1.5, 0.5))
  }

  // 리셋
  const handleReset = () => {
    setScale(1)
    setScrollPosition(0)
    setSelectedDefect(null)
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0
    }
  }

  // 결함 클릭 처리
  const handleDefectClick = (defect: DefectPosition) => {
    setSelectedDefect(defect)
    onDefectClick?.(defect)
  }

  // 특정 위치로 스크롤
  const scrollToPosition = (position: number) => {
    if (scrollContainerRef.current && coilRef.current) {
      const containerWidth = scrollContainerRef.current.clientWidth
      const coilWidth = coilRef.current.clientWidth
      const positionRatio = position / coilLength
      const scrollLeft = (positionRatio * coilWidth) - (containerWidth / 2)
      scrollContainerRef.current.scrollLeft = Math.max(0, scrollLeft)
    }
  }

  // 현재 위치로 자동 스크롤
  useEffect(() => {
    if (currentPosition !== undefined) {
      scrollToPosition(currentPosition)
    }
  }, [currentPosition, coilLength])

  // 결함 통계 계산
  const defectStats = defects.reduce((acc, defect) => {
    acc[defect.defectType] = (acc[defect.defectType] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <Card className={`glass-card border-white/20 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            코일 전도 - {coilId}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-white border-white/20">
              {coilLength}m
            </Badge>
            <Badge variant="outline" className="text-white border-white/20">
              {defects.length}개 결함
            </Badge>
          </div>
        </div>

        {/* 결함 통계 */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {Object.entries(defectStats).map(([type, count]) => (
            <div key={type} className="flex items-center gap-1">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getDefectColor(type, 'medium') }}
              />
              <span className="text-white/60">{type}: {count}</span>
            </div>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* 도구 모음 */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Button
              onClick={handleZoomIn}
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleZoomOut}
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleReset}
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Separator orientation="vertical" className="h-6 bg-white/20" />
            {currentPosition !== undefined && (
              <Button
                onClick={() => scrollToPosition(currentPosition)}
                size="sm"
                className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
              >
                <Maximize2 className="w-4 h-4" />
                현재 위치로
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">
              {Math.round(scale * 100)}%
            </span>
            {selectedDefect && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                {selectedDefect.position}m 선택됨
              </Badge>
            )}
          </div>
        </div>

        {/* 코일 전도 뷰 */}
        <div className="relative">
          {/* 스케일 표시 */}
          <div className="px-4 py-2 bg-black/20 border-b border-white/10">
            <div className="flex justify-between text-xs text-white/60">
              <span>0m</span>
              <span>{Math.round(coilLength / 4)}m</span>
              <span>{Math.round(coilLength / 2)}m</span>
              <span>{Math.round(coilLength * 3 / 4)}m</span>
              <span>{coilLength}m</span>
            </div>
          </div>

          {/* 스크롤 가능한 코일 뷰 */}
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto h-32 bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800"
            style={{ scrollbarWidth: 'thin' }}
          >
            <div 
              ref={coilRef}
              className="relative h-full bg-gradient-to-b from-gray-600 via-gray-500 to-gray-600 border-y-2 border-gray-400"
              style={{ 
                width: `${Math.max(800, coilLength * scale)}px`,
                minWidth: '100%'
              }}
            >
              {/* 코일 표면 텍스처 */}
              <div className="absolute inset-0 opacity-20">
                <div className="w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
              </div>

              {/* 현재 진행 위치 표시 */}
              {currentPosition !== undefined && (
                <div
                  className="absolute top-0 bottom-0 w-1 bg-green-400 shadow-lg z-10"
                  style={{ 
                    left: `${(currentPosition / coilLength) * 100}%`,
                    boxShadow: '0 0 10px rgba(34, 197, 94, 0.6)'
                  }}
                >
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    현재: {currentPosition}m
                  </div>
                </div>
              )}

              {/* 결함 위치 표시 */}
              {defects.map((defect) => (
                <div
                  key={defect.id}
                  className={`absolute top-0 bottom-0 w-2 cursor-pointer transition-all duration-200 hover:w-3 ${
                    selectedDefect?.id === defect.id ? 'w-3 z-20' : 'z-10'
                  }`}
                  style={{ 
                    left: `${(defect.position / coilLength) * 100}%`,
                    backgroundColor: getDefectColor(defect.defectType, defect.severity),
                    boxShadow: hoveredDefect?.id === defect.id || selectedDefect?.id === defect.id
                      ? `0 0 10px ${getDefectColor(defect.defectType, defect.severity)}`
                      : 'none'
                  }}
                  onClick={() => handleDefectClick(defect)}
                  onMouseEnter={() => setHoveredDefect(defect)}
                  onMouseLeave={() => setHoveredDefect(null)}
                >
                  {/* 결함 정보 툴팁 */}
                  {(hoveredDefect?.id === defect.id || selectedDefect?.id === defect.id) && (
                    <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 bg-black/90 text-white text-xs px-3 py-2 rounded shadow-lg whitespace-nowrap z-30">
                      <div className="font-medium">{defect.defectType}</div>
                      <div className="text-white/70">{defect.position}m</div>
                      <div className="text-white/70">{defect.date}</div>
                      {/* 화살표 */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-black/90"></div>
                    </div>
                  )}
                </div>
              ))}

              {/* 거리 마커 */}
              {Array.from({ length: Math.ceil(coilLength / 100) }, (_, i) => (i + 1) * 100).map((position) => (
                position <= coilLength && (
                  <div
                    key={position}
                    className="absolute top-0 bottom-0 w-px bg-white/30"
                    style={{ left: `${(position / coilLength) * 100}%` }}
                  >
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-white/60">
                      {position}m
                    </div>
                  </div>
                )
              ))}
            </div>
          </div>

          {/* 스크롤 인디케이터 */}
          <div className="px-4 py-2 bg-black/20 border-t border-white/10">
            <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 left-0 h-full bg-blue-500/50 rounded-full transition-all duration-200"
                style={{ 
                  width: `${Math.min(100, (scrollContainerRef.current?.clientWidth || 0) / (coilRef.current?.clientWidth || 1) * 100)}%`,
                  left: `${(scrollPosition / Math.max(1, (coilRef.current?.clientWidth || 1) - (scrollContainerRef.current?.clientWidth || 0))) * 100}%`
                }}
              />
            </div>
          </div>
        </div>

        {/* 선택된 결함 상세 정보 */}
        {selectedDefect && (
          <div className="p-4 border-t border-white/10 bg-black/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-white font-medium flex items-center gap-2">
                <Info className="w-4 h-4" />
                결함 상세 정보
              </h4>
              <Button
                onClick={() => setSelectedDefect(null)}
                size="sm"
                variant="ghost"
                className="text-white/60 hover:text-white hover:bg-white/10"
              >
                닫기
              </Button>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-white/60">결함 유형:</span>
                <div className="flex items-center gap-2 mt-1">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: getDefectColor(selectedDefect.defectType, selectedDefect.severity) }}
                  />
                  <span className="text-white">{selectedDefect.defectType}</span>
                </div>
              </div>
              <div>
                <span className="text-white/60">위치:</span>
                <div className="text-white mt-1">{selectedDefect.position}m</div>
              </div>
              <div>
                <span className="text-white/60">심각도:</span>
                <div className="text-white mt-1 capitalize">{selectedDefect.severity}</div>
              </div>
              <div>
                <span className="text-white/60">검출 일시:</span>
                <div className="text-white mt-1">{selectedDefect.date}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
