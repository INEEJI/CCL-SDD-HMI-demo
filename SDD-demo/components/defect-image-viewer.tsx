"use client"

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Palette, 
  Ruler, 
  Move,
  Download,
  Maximize2,
  X
} from "lucide-react"

interface DefectImageViewerProps {
  imageUrl: string
  defectInfo: {
    id: string
    coilId: string
    defectType: string
    position: number
    date: string
    customer: string
    size?: {
      width: number
      height: number
    }
    confidence?: number
  }
  onClose?: () => void
  isFullscreen?: boolean
}

interface MeasurementPoint {
  x: number
  y: number
}

interface Measurement {
  id: string
  start: MeasurementPoint
  end: MeasurementPoint
  pixelDistance: number
  mmDistance: number
}

export default function DefectImageViewer({ 
  imageUrl, 
  defectInfo, 
  onClose,
  isFullscreen = false 
}: DefectImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isGrayscale, setIsGrayscale] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isMeasuring, setIsMeasuring] = useState(false)
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [currentMeasurement, setCurrentMeasurement] = useState<Partial<Measurement> | null>(null)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)

  // 픽셀을 mm로 변환하는 비율 (실제 카메라 설정에 따라 조정 필요)
  const PIXEL_TO_MM_RATIO = 0.1 // 1픽셀 = 0.1mm (예시값)

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev * 1.2, 5))
  }, [])

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev / 1.2, 0.2))
  }, [])

  const handleReset = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
    setMeasurements([])
    setCurrentMeasurement(null)
    setIsMeasuring(false)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (isMeasuring) {
      const rect = imageRef.current?.getBoundingClientRect()
      if (rect) {
        const x = (e.clientX - rect.left) / scale
        const y = (e.clientY - rect.top) / scale
        
        if (!currentMeasurement?.start) {
          setCurrentMeasurement({ start: { x, y } })
        } else {
          const pixelDistance = Math.sqrt(
            Math.pow(x - currentMeasurement.start.x, 2) + 
            Math.pow(y - currentMeasurement.start.y, 2)
          )
          const mmDistance = pixelDistance * PIXEL_TO_MM_RATIO
          
          const newMeasurement: Measurement = {
            id: Date.now().toString(),
            start: currentMeasurement.start,
            end: { x, y },
            pixelDistance,
            mmDistance
          }
          
          setMeasurements(prev => [...prev, newMeasurement])
          setCurrentMeasurement(null)
        }
      }
    } else {
      setIsDragging(true)
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }
  }, [isMeasuring, currentMeasurement, scale, position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && !isMeasuring) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      })
    }
  }, [isDragging, isMeasuring, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true)
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      })
    }
  }, [])

  const clearMeasurements = useCallback(() => {
    setMeasurements([])
    setCurrentMeasurement(null)
  }, [])

  const downloadImage = useCallback(() => {
    const link = document.createElement('a')
    link.href = imageUrl
    link.download = `defect_${defectInfo.id}_${defectInfo.coilId}.jpg`
    link.click()
  }, [imageUrl, defectInfo])

  const getDefectTypeColor = (type: string) => {
    switch (type) {
      case 'Scratch': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'Dent': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'Scale': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'Pin hole': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <Card className={`glass-card border-white/20 ${isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Maximize2 className="w-5 h-5" />
            결함 이미지 분석
          </CardTitle>
          {onClose && (
            <Button
              onClick={onClose}
              variant="ghost"
              size="sm"
              className="text-white/60 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {/* 결함 정보 */}
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge className={getDefectTypeColor(defectInfo.defectType)}>
            {defectInfo.defectType}
          </Badge>
          <span className="text-white/60">코일: {defectInfo.coilId}</span>
          <span className="text-white/60">위치: {defectInfo.position}m</span>
          <span className="text-white/60">고객: {defectInfo.customer}</span>
          {defectInfo.confidence && (
            <span className="text-white/60">신뢰도: {(defectInfo.confidence * 100).toFixed(1)}%</span>
          )}
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
            <Button
              onClick={() => setIsGrayscale(!isGrayscale)}
              size="sm"
              className={`${isGrayscale ? 'bg-blue-500' : 'bg-white/10'} text-white hover:bg-blue-600`}
            >
              <Palette className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => setIsMeasuring(!isMeasuring)}
              size="sm"
              className={`${isMeasuring ? 'bg-green-500' : 'bg-white/10'} text-white hover:bg-green-600`}
            >
              <Ruler className="w-4 h-4" />
            </Button>
            {measurements.length > 0 && (
              <Button
                onClick={clearMeasurements}
                size="sm"
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                측정 초기화
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">
              {Math.round(scale * 100)}%
            </span>
            <Button
              onClick={downloadImage}
              size="sm"
              className="bg-white/10 text-white hover:bg-white/20"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* 이미지 뷰어 */}
        <div 
          ref={containerRef}
          className={`relative overflow-hidden ${isFullscreen ? 'h-[calc(100vh-200px)]' : 'h-96'} bg-black/20`}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div
            className="absolute inset-0 flex items-center justify-center cursor-move"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              transformOrigin: 'center'
            }}
          >
            <img
              ref={imageRef}
              src={imageUrl}
              alt={`결함 ${defectInfo.id}`}
              className={`max-w-full max-h-full object-contain ${isGrayscale ? 'grayscale' : ''}`}
              onLoad={handleImageLoad}
              onError={(e) => {
                e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjMzM0MTU1Ii8+CjxwYXRoIGQ9Ik0xNzUgMTUwQzE3NSAxMzYuMTkzIDE4Ni4xOTMgMTI1IDIwMCAxMjVDMjEzLjgwNyAxMjUgMjI1IDEzNi4xOTMgMjI1IDE1MEMyMjUgMTYzLjgwNyAyMTMuODA3IDE3NSAyMDAgMTc1QzE4Ni4xOTMgMTc1IDE3NSAxNjMuODA3IDE3NSAxNTBaIiBmaWxsPSIjNjQ3NDhCIi8+CjxwYXRoIGQ9Ik0xNjAgMTgwSDI0MFYxOTBIMTYwVjE4MFoiIGZpbGw9IiM2NDc0OEIiLz4KPHRleHQgeD0iMjAwIiB5PSIyMjAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM5Q0E0QUYiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZm9udC13ZWlnaHQ9IjUwMCI+7J2066+47KeAIOyXhuydjDwvdGV4dD4KPC9zdmc+'
              }}
              draggable={false}
            />
          </div>

          {/* 측정 오버레이 */}
          {imageLoaded && (
            <svg
              className="absolute inset-0 pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center'
              }}
            >
              {/* 완료된 측정 */}
              {measurements.map((measurement) => (
                <g key={measurement.id}>
                  <line
                    x1={measurement.start.x}
                    y1={measurement.start.y}
                    x2={measurement.end.x}
                    y2={measurement.end.y}
                    stroke="#22d3ee"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                  <circle
                    cx={measurement.start.x}
                    cy={measurement.start.y}
                    r="4"
                    fill="#22d3ee"
                  />
                  <circle
                    cx={measurement.end.x}
                    cy={measurement.end.y}
                    r="4"
                    fill="#22d3ee"
                  />
                  <text
                    x={(measurement.start.x + measurement.end.x) / 2}
                    y={(measurement.start.y + measurement.end.y) / 2 - 10}
                    fill="#22d3ee"
                    fontSize="12"
                    textAnchor="middle"
                    className="font-bold"
                  >
                    {measurement.mmDistance.toFixed(1)}mm
                  </text>
                </g>
              ))}
              
              {/* 현재 측정 중인 선 */}
              {currentMeasurement?.start && (
                <circle
                  cx={currentMeasurement.start.x}
                  cy={currentMeasurement.start.y}
                  r="4"
                  fill="#fbbf24"
                  className="animate-pulse"
                />
              )}
            </svg>
          )}

          {/* 상태 표시 */}
          {isMeasuring && (
            <div className="absolute top-4 left-4 bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-sm border border-green-500/30">
              <Ruler className="w-4 h-4 inline mr-1" />
              측정 모드 - 두 점을 클릭하세요
            </div>
          )}
        </div>

        {/* 측정 결과 */}
        {measurements.length > 0 && (
          <div className="p-4 border-t border-white/10">
            <h4 className="text-white font-medium mb-2">측정 결과</h4>
            <div className="space-y-2">
              {measurements.map((measurement, index) => (
                <div key={measurement.id} className="flex items-center justify-between text-sm">
                  <span className="text-white/60">측정 {index + 1}:</span>
                  <div className="flex items-center gap-4">
                    <span className="text-white">{measurement.mmDistance.toFixed(2)}mm</span>
                    <span className="text-white/60">({measurement.pixelDistance.toFixed(0)}px)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 이미지 정보 */}
        {imageLoaded && (
          <div className="p-4 border-t border-white/10 text-sm text-white/60">
            <div className="flex items-center justify-between">
              <span>이미지 크기: {imageDimensions.width} × {imageDimensions.height}px</span>
              <span>검출 시간: {defectInfo.date}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
