"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import Image from "next/image"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pause, Play, Palette, Ruler, Maximize, Wifi, WifiOff, RefreshCw } from "lucide-react"
import { useLiveImage } from "@/hooks/use-live-image"

interface Defect {
  id: number
  type: string
  position: { x: number; y: number }
  size: { width: number; height: number }
  confidence: number
}

interface RealTimeVideoPanelProps {
  isSystemOn: boolean
  isColorMode: boolean
  onColorModeChange: (mode: boolean) => void
  defects: Defect[]
  currentCoilNumber?: string
}

export default function RealTimeVideoPanel({
  isSystemOn,
  isColorMode,
  onColorModeChange,
  defects,
  currentCoilNumber,
}: RealTimeVideoPanelProps) {
  const [isRecording, setIsRecording] = useState(true)
  const [selectedArea, setSelectedArea] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const videoRef = useRef<HTMLDivElement>(null)

  // 실시간 이미지 훅 사용 - WebSocket 기반
  const {
    currentImage,
    totalImages,
    isMock,
    isLoading,
    error,
    refreshImage,
    getImageUrl,
    isConnected,
    connectionType
  } = useLiveImage({
    imageType: 'original',
    coilNumber: currentCoilNumber,
    enabled: isSystemOn && isRecording
  })

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!videoRef.current) return

    const rect = videoRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setDragStart({ x, y })
    setIsDragging(true)
    setSelectedArea(null)
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragStart || !videoRef.current) return

      const rect = videoRef.current.getBoundingClientRect()
      const currentX = e.clientX - rect.left
      const currentY = e.clientY - rect.top

      const width = Math.abs(currentX - dragStart.x)
      const height = Math.abs(currentY - dragStart.y)
      const x = Math.min(currentX, dragStart.x)
      const y = Math.min(currentY, dragStart.y)

      setSelectedArea({ x, y, width, height })
    },
    [isDragging, dragStart],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setDragStart(null)
  }, [])

  // 픽셀을 mm로 변환 (가정: 1픽셀 = 0.1mm)
  const pixelToMm = (pixel: number) => (pixel * 0.1).toFixed(1)

  // 연결 상태 표시 - WebSocket 기반
  const getConnectionStatus = () => {
    if (!isSystemOn) return { status: 'off', text: '시스템 중지', variant: 'secondary' as const, icon: 'pause' }
    if (error) return { status: 'error', text: '연결 오류', variant: 'destructive' as const, icon: 'error' }
    
    switch (connectionType) {
      case 'websocket':
        return { status: 'websocket', text: '실시간 연결', variant: 'default' as const, icon: 'connected' }
      case 'http':
        return { status: 'http', text: 'HTTP 모드', variant: 'outline' as const, icon: 'disconnected' }
      case 'none':
        return { status: 'none', text: '연결 중', variant: 'secondary' as const, icon: 'connecting' }
      default:
        if (isMock) return { status: 'mock', text: '데모 모드', variant: 'outline' as const, icon: 'mock' }
        return { status: 'unknown', text: '상태 확인 중', variant: 'secondary' as const, icon: 'connecting' }
    }
  }

  const connectionStatus = getConnectionStatus()
  const imageUrl = getImageUrl()

  // 연결 상태 아이콘 렌더링
  const renderConnectionIcon = () => {
    switch (connectionStatus.icon) {
      case 'connected':
        return <Wifi className="w-4 h-4 text-green-400" />
      case 'disconnected':
        return <WifiOff className="w-4 h-4 text-yellow-400" />
      case 'error':
        return <WifiOff className="w-4 h-4 text-red-400" />
      case 'connecting':
        return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
      case 'pause':
        return <Pause className="w-4 h-4 text-gray-400" />
      case 'mock':
        return <Wifi className="w-4 h-4 text-orange-400" />
      default:
        return <WifiOff className="w-4 h-4 text-gray-400" />
    }
  }

  return (
    <Card className="glass-card border-white/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              실시간 영상 모니터링
              {renderConnectionIcon()}
            </CardTitle>
            <CardDescription className="text-white/80">
              카메라 1 - 메인 검사 라인
              {currentCoilNumber && ` | 코일: ${currentCoilNumber}`}
              {isMock && " | 데모 모드"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`${connectionStatus.variant === 'destructive' ? 'bg-red-500' : connectionStatus.variant === 'secondary' ? 'bg-gray-500' : 'bg-green-500'} text-white`}>
              {connectionStatus.text}
            </Badge>
            <button
              onClick={() => setIsRecording(!isRecording)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 px-3 py-1 rounded text-sm flex items-center gap-1"
            >
              {isRecording ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              onClick={refreshImage}
              disabled={isLoading}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20 px-3 py-1 rounded text-sm disabled:opacity-50 flex items-center gap-1"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={videoRef}
          className="relative bg-gray-900 rounded-lg overflow-hidden aspect-video cursor-crosshair"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {isSystemOn ? (
            <>
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt="Live camera feed"
                  width={600}
                  height={400}
                  className={`w-full h-full object-cover transition-all duration-300 ${
                    !isColorMode ? "grayscale" : ""
                  } ${isLoading ? "opacity-75" : ""}`}
                  unoptimized={true}
                  onError={(e) => {
                    console.error('이미지 로드 실패:', imageUrl)
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-800">
                  <div className="text-center text-white/60">
                    <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mb-4 mx-auto"></div>
                    <p className="text-lg">이미지 로딩 중...</p>
                    <p className="text-sm">카메라 연결을 확인하고 있습니다</p>
                  </div>
                </div>
              )}

              {/* 결함 오버레이 */}
              {defects.slice(-3).map((defect, index) => (
                <div
                  key={defect.id}
                  className="absolute border-2 border-red-500 bg-red-500/20 rounded animate-pulse"
                  style={{
                    left: `${20 + index * 100}px`,
                    top: `${50 + index * 50}px`,
                    width: "40px",
                    height: "40px",
                  }}
                >
                  <div className="absolute -top-8 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {defect.type}
                  </div>
                </div>
              ))}

              {/* 드래그 선택 영역 */}
              {selectedArea && (
                <div
                  className="absolute border-2 border-blue-500 bg-blue-500/10 rounded"
                  style={{
                    left: `${selectedArea.x}px`,
                    top: `${selectedArea.y}px`,
                    width: `${selectedArea.width}px`,
                    height: `${selectedArea.height}px`,
                  }}
                >
                  <div className="absolute -top-8 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                    {pixelToMm(selectedArea.width)} × {pixelToMm(selectedArea.height)} mm
                  </div>
                </div>
              )}

              {/* 로딩 오버레이 */}
              {isLoading && (
                <div className="absolute top-4 right-4 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  업데이트 중...
                </div>
              )}

              {/* 이미지 정보 오버레이 */}
              {currentImage && (
                <div className="absolute top-4 left-4 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {new Date(currentImage.timestamp).toLocaleTimeString()} | 코일: {currentImage.coil_number}
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-800">
              <div className="text-center text-white/60">
                <Pause className="w-16 h-16 mx-auto mb-4" />
                <p className="text-lg">시스템 중지</p>
                <p className="text-sm">카메라가 비활성화되었습니다</p>
              </div>
            </div>
          )}

          {/* 컨트롤 오버레이 */}
          <div className="absolute bottom-4 left-4 flex gap-2">
            <button
              onClick={() => onColorModeChange(!isColorMode)}
              className="bg-black/50 hover:bg-black/70 text-white border border-white/20 px-3 py-1 rounded text-sm flex items-center gap-2"
            >
              <Palette className="w-4 h-4" />
              {isColorMode ? "흑백" : "컬러"}
            </button>
            <button 
              onClick={() => setSelectedArea(null)}
              className="bg-black/50 hover:bg-black/70 text-white border border-white/20 px-3 py-1 rounded text-sm flex items-center gap-2"
            >
              <Ruler className="w-4 h-4" />
              측정
            </button>
            <button className="bg-black/50 hover:bg-black/70 text-white border border-white/20 px-3 py-1 rounded text-sm flex items-center gap-2">
              <Maximize className="w-4 h-4" />
              전체화면
            </button>
          </div>
        </div>

        {/* 측정 결과 및 상태 정보 */}
        <div className="mt-4 space-y-2">
          {selectedArea && (
            <div className="p-3 bg-white/10 rounded-lg">
              <p className="text-white text-sm">
                <strong>측정 결과:</strong> {pixelToMm(selectedArea.width)} × {pixelToMm(selectedArea.height)} mm 
                <span className="text-white/70"> (참고용 - 실제 캘리브레이션 필요)</span>
              </p>
            </div>
          )}

          {/* 연결 상태 및 통계 정보 */}
          <div className="flex justify-between items-center text-sm text-white/70">
            <div className="flex items-center gap-4">
              <span>총 이미지: {totalImages}개</span>
              {currentImage && (
                <span>마지막 업데이트: {new Date(currentImage.timestamp).toLocaleString()}</span>
              )}
              <span className="flex items-center gap-1">
                연결 타입: 
                {connectionType === 'websocket' && <span className="text-green-400">WebSocket</span>}
                {connectionType === 'http' && <span className="text-yellow-400">HTTP API</span>}
                {connectionType === 'none' && <span className="text-gray-400">연결 없음</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {connectionType === 'websocket' ? (
                <span className="text-green-400 text-xs flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  실시간 스트리밍
                </span>
              ) : (
                <span className="text-yellow-400 text-xs">폴백 모드</span>
              )}
            </div>
          </div>

          {/* 오류 메시지 */}
          {error && (
            <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
              <p className="text-red-200 text-sm">
                <strong>연결 오류:</strong> {error}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
