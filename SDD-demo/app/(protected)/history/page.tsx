"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  FileImage, 
  Calendar, 
  MapPin, 
  User,
  Edit,
  Save,
  X,
  Maximize2,
  Eye,
  Filter
} from "lucide-react"
import { getDefects, updateDefect } from "@/lib/api/historyApi"
import DefectImageViewer from "@/components/defect-image-viewer"
import CoilUnrolledView from "@/components/coil-unrolled-view"
import type { DefectData } from "@/lib/data/mockDefects"
import toast from "react-hot-toast"

export default function HistoryPage() {
  const [defects, setDefects] = useState<DefectData[]>([])
  const [totalDefects, setTotalDefects] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [filters, setFilters] = useState({ 
    coilId: '', 
    defectType: 'all', 
    startDate: '', 
    endDate: '',
    customer: 'all',
    minConfidence: '',
    maxConfidence: ''
  })
  const [selectedDefect, setSelectedDefect] = useState<DefectData | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false)
  const [editingDefect, setEditingDefect] = useState<DefectData | null>(null)
  const [activeTab, setActiveTab] = useState("list")
  const itemsPerPage = 10

  // 편집 폼 상태
  const [editForm, setEditForm] = useState({
    defectType: '',
    position: 0,
    customer: '',
    notes: ''
  })

  useEffect(() => {
    const fetchDefects = async () => {
      setIsLoading(true)
      try {
        const response = await getDefects({ ...filters, page: currentPage, limit: itemsPerPage })
        setDefects(response.data)
        setTotalDefects(response.totalCount)
      } catch (error) {
        toast.error("데이터를 불러오는 중 오류가 발생했습니다.")
      } finally {
        setIsLoading(false)
      }
    }
    fetchDefects()
  }, [filters, currentPage])

  const handleFilterChange = (field: string, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }))
    setCurrentPage(1)
  }

  const handleResetFilters = () => {
    setFilters({ 
      coilId: '', 
      defectType: 'all', 
      startDate: '', 
      endDate: '',
      customer: 'all',
      minConfidence: '',
      maxConfidence: ''
    })
    setCurrentPage(1)
  }

  const totalPages = Math.ceil(totalDefects / itemsPerPage)
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= totalPages) setCurrentPage(newPage)
  }

  const getDefectTypeColor = (type: string) => {
    switch (type) {
      case 'Scratch': return 'bg-red-500/20 text-red-400 border-red-500/30'
      case 'Dent': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'Scale': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'Pin hole': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    }
  }

  // 결함 편집 핸들러
  const handleEditDefect = (defect: DefectData) => {
    setEditingDefect(defect)
    setEditForm({
      defectType: defect.defectType,
      position: defect.position,
      customer: defect.customer,
      notes: ''
    })
    setIsEditDialogOpen(true)
  }

  // 결함 정보 저장
  const handleSaveDefect = async () => {
    if (!editingDefect) return

    try {
      await updateDefect(editingDefect.id, {
        defectType: editForm.defectType,
        position: editForm.position,
        customer: editForm.customer
      })
      
      // 로컬 상태 업데이트
      setDefects(prev => prev.map(d => 
        d.id === editingDefect.id 
          ? { ...d, ...editForm }
          : d
      ))
      
      toast.success("결함 정보가 성공적으로 수정되었습니다.")
      setIsEditDialogOpen(false)
      setEditingDefect(null)
    } catch (error) {
      toast.error("결함 정보 수정 중 오류가 발생했습니다.")
    }
  }

  // 이미지 뷰어 열기
  const handleViewImage = (defect: DefectData) => {
    setSelectedDefect(defect)
    setIsImageViewerOpen(true)
  }

  // 코일 전도 뷰용 데이터 변환
  const getCoilUnrolledData = () => {
    if (!selectedDefect) return { defects: [], coilLength: 1000 }
    
    const coilDefects = defects
      .filter(d => d.coilId === selectedDefect.coilId)
      .map(d => ({
        id: d.id,
        position: d.position,
        defectType: d.defectType,
        severity: 'medium' as const,
        date: d.date,
        coilId: d.coilId
      }))
    
    return {
      defects: coilDefects,
      coilLength: Math.max(...coilDefects.map(d => d.position), 1000)
    }
  }

  return (
    <div className="min-h-screen aurora-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="glass-panel rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white">결함 이력 관리</h1>
              <p className="text-white/80">과거 결함 검출 기록 조회 및 분석</p>
            </div>
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-500 px-4 py-2">
                <Calendar className="w-4 h-4 mr-2" />
                총 {totalDefects}건의 결함 기록
              </Badge>
            </div>
          </div>
        </div>

        {/* 고급 검색 */}
        <Card className="glass-card border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center">
              <Filter className="text-blue-400 mr-2" />
              고급 검색 및 필터
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 items-end">
              <div>
                <Label className="text-white/80">코일 ID</Label>
                <Input
                  placeholder="코일 ID"
                  value={filters.coilId}
                  onChange={(e) => handleFilterChange('coilId', e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div>
                <Label className="text-white/80">결함 유형</Label>
                <Select value={filters.defectType} onValueChange={(value: string) => handleFilterChange('defectType', value)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="전체 유형" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 유형</SelectItem>
                    <SelectItem value="Scratch">Scratch</SelectItem>
                    <SelectItem value="Dent">Dent</SelectItem>
                    <SelectItem value="Scale">Scale</SelectItem>
                    <SelectItem value="Pin hole">Pin hole</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/80">고객사</Label>
                <Select value={filters.customer} onValueChange={(value: string) => handleFilterChange('customer', value)}>
                  <SelectTrigger className="bg-white/5 border-white/10 text-white">
                    <SelectValue placeholder="전체 고객사" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">전체 고객사</SelectItem>
                    <SelectItem value="고객사 A">고객사 A</SelectItem>
                    <SelectItem value="고객사 B">고객사 B</SelectItem>
                    <SelectItem value="고객사 C">고객사 C</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-white/80">시작 날짜</Label>
                <Input
                  type="date"
                  value={filters.startDate}
                  onChange={(e) => handleFilterChange('startDate', e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">종료 날짜</Label>
                <Input
                  type="date"
                  value={filters.endDate}
                  onChange={(e) => handleFilterChange('endDate', e.target.value)}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div>
                <Label className="text-white/80">신뢰도 범위</Label>
                <div className="flex gap-1">
                  <Input
                    type="number"
                    placeholder="최소"
                    min="0"
                    max="100"
                    value={filters.minConfidence}
                    onChange={(e) => handleFilterChange('minConfidence', e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/50 text-xs"
                  />
                  <Input
                    type="number"
                    placeholder="최대"
                    min="0"
                    max="100"
                    value={filters.maxConfidence}
                    onChange={(e) => handleFilterChange('maxConfidence', e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-white/50 text-xs"
                  />
                </div>
              </div>
              <Button
                onClick={handleResetFilters}
                className="bg-white/10 text-white hover:bg-white/20"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                초기화
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 탭 컨테이너 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10">
            <TabsTrigger value="list" className="text-white data-[state=active]:bg-white/20">
              목록 보기
            </TabsTrigger>
            <TabsTrigger value="analysis" className="text-white data-[state=active]:bg-white/20">
              상세 분석
            </TabsTrigger>
            <TabsTrigger value="coil-view" className="text-white data-[state=active]:bg-white/20">
              코일 전도
            </TabsTrigger>
          </TabsList>

          {/* 목록 보기 탭 */}
          <TabsContent value="list" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 500px)' }}>
              {/* 결함 목록 */}
              <Card className="glass-card border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">결함 목록</CardTitle>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="max-h-96 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10">
                              <TableHead className="text-white/80">코일 ID</TableHead>
                              <TableHead className="text-white/80">유형</TableHead>
                              <TableHead className="text-white/80">위치</TableHead>
                              <TableHead className="text-white/80">날짜</TableHead>
                              <TableHead className="text-white/80">작업</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {defects.map((defect) => (
                              <TableRow 
                                key={defect.id} 
                                className={`border-white/10 cursor-pointer hover:bg-white/5 ${
                                  selectedDefect?.id === defect.id ? 'bg-blue-500/20' : ''
                                }`}
                                onClick={() => setSelectedDefect(defect)}
                              >
                                <TableCell className="text-white font-medium">{defect.coilId}</TableCell>
                                <TableCell>
                                  <Badge className={getDefectTypeColor(defect.defectType)}>
                                    {defect.defectType}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-white/80">{defect.position}m</TableCell>
                                <TableCell className="text-white/80">{defect.date}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleViewImage(defect)
                                      }}
                                      className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                    >
                                      <Eye className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        handleEditDefect(defect)
                                      }}
                                      className="bg-green-500/20 text-green-400 hover:bg-green-500/30"
                                    >
                                      <Edit className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* 페이지네이션 */}
                      <div className="flex items-center justify-between">
                        <div className="text-white/60 text-sm">
                          {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, totalDefects)} / {totalDefects}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="bg-white/10 text-white hover:bg-white/20"
                          >
                            <ChevronLeft className="w-4 h-4" />
                          </Button>
                          <span className="text-white text-sm px-2">
                            {currentPage} / {totalPages}
                          </span>
                          <Button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="bg-white/10 text-white hover:bg-white/20"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* 결함 상세 정보 */}
              <Card className="glass-card border-white/20">
                <CardHeader>
                  <CardTitle className="text-white">결함 상세 정보</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedDefect ? (
                    <div className="space-y-6">
                      {/* 결함 이미지 */}
                      <div className="aspect-video bg-white/5 border border-white/10 rounded-lg overflow-hidden">
                        <img
                          src={selectedDefect.imageUrl}
                          alt={`Defect ${selectedDefect.id}`}
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => handleViewImage(selectedDefect)}
                          onError={(e) => {
                            e.currentTarget.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMzM0MTU1Ii8+CjxwYXRoIGQ9Ik04MCAxMDBDODAgODkuNTQ0NCA4OC41NDQ0IDgxIDEwMCA4MUMxMTEuNDU2IDgxIDEyMCA4OS41NDQ0IDEyMCAxMEMxMjAgMTEwLjQ1NiAxMTEuNDU2IDExOSAxMDAgMTE5Qzg4LjU0NDQgMTE5IDgwIDExMC40NTYgODAgMTAwWiIgZmlsbD0iIzY0NzQ4QiIvPgo8L3N2Zz4K'
                          }}
                        />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                          <Maximize2 className="w-8 h-8 text-white" />
                        </div>
                      </div>

                      {/* 결함 정보 */}
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center text-white/60 text-sm">
                              <FileImage className="w-4 h-4 mr-2" />
                              결함 ID
                            </div>
                            <div className="text-white font-medium">{selectedDefect.id}</div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center text-white/60 text-sm">
                              <MapPin className="w-4 h-4 mr-2" />
                              위치
                            </div>
                            <div className="text-white font-medium">{selectedDefect.position}m</div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-white/60 text-sm">
                            <User className="w-4 h-4 mr-2" />
                            고객사
                          </div>
                          <div className="text-white font-medium">{selectedDefect.customer}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center text-white/60 text-sm">
                            <Calendar className="w-4 h-4 mr-2" />
                            검출 시간
                          </div>
                          <div className="text-white font-medium">{selectedDefect.date}</div>
                        </div>

                        <div className="space-y-2">
                          <div className="text-white/60 text-sm">결함 유형</div>
                          <Badge className={getDefectTypeColor(selectedDefect.defectType)}>
                            {selectedDefect.defectType}
                          </Badge>
                        </div>
                      </div>

                      {/* 액션 버튼 */}
                      <div className="flex gap-2">
                        <Button 
                          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                          onClick={() => handleViewImage(selectedDefect)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          이미지 분석
                        </Button>
                        <Button 
                          className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                          onClick={() => handleEditDefect(selectedDefect)}
                        >
                          <Edit className="w-4 h-4 mr-2" />
                          정보 수정
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-white/60">
                      <div className="text-center">
                        <FileImage className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>결함을 선택하여 상세 정보를 확인하세요</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 상세 분석 탭 */}
          <TabsContent value="analysis">
            {selectedDefect ? (
              <DefectImageViewer
                imageUrl={selectedDefect.imageUrl}
                defectInfo={{
                  id: selectedDefect.id,
                  coilId: selectedDefect.coilId,
                  defectType: selectedDefect.defectType,
                  position: selectedDefect.position,
                  date: selectedDefect.date,
                  customer: selectedDefect.customer,
                  confidence: 0.95 // 예시 신뢰도
                }}
                isFullscreen={false}
              />
            ) : (
              <Card className="glass-card border-white/20 h-96">
                <CardContent className="flex items-center justify-center h-full">
                  <div className="text-center text-white/60">
                    <FileImage className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">결함을 선택하여 상세 분석을 시작하세요</p>
                    <p className="text-sm mt-2">목록에서 결함을 클릭하면 이미지 분석 도구를 사용할 수 있습니다</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 코일 전도 탭 */}
          <TabsContent value="coil-view">
            {selectedDefect ? (
              <CoilUnrolledView
                coilId={selectedDefect.coilId}
                coilLength={getCoilUnrolledData().coilLength}
                defects={getCoilUnrolledData().defects}
                currentPosition={selectedDefect.position}
                onDefectClick={(defect) => {
                  const foundDefect = defects.find(d => d.id === defect.id)
                  if (foundDefect) setSelectedDefect(foundDefect)
                }}
              />
            ) : (
              <Card className="glass-card border-white/20 h-96">
                <CardContent className="flex items-center justify-center h-full">
                  <div className="text-center text-white/60">
                    <MapPin className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">코일을 선택하여 전도를 확인하세요</p>
                    <p className="text-sm mt-2">목록에서 결함을 클릭하면 해당 코일의 전도를 볼 수 있습니다</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* 결함 정보 수정 다이얼로그 */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="glass-card border-white/20 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">결함 정보 수정</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-white/80">결함 유형</Label>
                  <Select value={editForm.defectType} onValueChange={(value) => setEditForm(prev => ({ ...prev, defectType: value }))}>
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Scratch">Scratch</SelectItem>
                      <SelectItem value="Dent">Dent</SelectItem>
                      <SelectItem value="Scale">Scale</SelectItem>
                      <SelectItem value="Pin hole">Pin hole</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">위치 (미터)</Label>
                  <Input
                    type="number"
                    value={editForm.position}
                    onChange={(e) => setEditForm(prev => ({ ...prev, position: Number(e.target.value) }))}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">고객사</Label>
                <Input
                  value={editForm.customer}
                  onChange={(e) => setEditForm(prev => ({ ...prev, customer: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">수정 사유</Label>
                <Textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="수정 사유를 입력하세요"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/50"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button 
                  onClick={handleSaveDefect}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Save className="w-4 h-4 mr-2" />
                  저장
                </Button>
                <Button 
                  onClick={() => setIsEditDialogOpen(false)}
                  className="flex-1 bg-white/10 text-white hover:bg-white/20"
                >
                  <X className="w-4 h-4 mr-2" />
                  취소
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* 이미지 뷰어 다이얼로그 */}
        <Dialog open={isImageViewerOpen} onOpenChange={setIsImageViewerOpen}>
          <DialogContent className="max-w-6xl max-h-[90vh] p-0 border-0 bg-transparent">
            {selectedDefect && (
              <DefectImageViewer
                imageUrl={selectedDefect.imageUrl}
                defectInfo={{
                  id: selectedDefect.id,
                  coilId: selectedDefect.coilId,
                  defectType: selectedDefect.defectType,
                  position: selectedDefect.position,
                  date: selectedDefect.date,
                  customer: selectedDefect.customer,
                  confidence: 0.95
                }}
                onClose={() => setIsImageViewerOpen(false)}
                isFullscreen={true}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
