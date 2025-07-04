'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileImage, 
  Edit3, 
  Download,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  BarChart,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  MoreHorizontal,
  Trash2,
  FolderOpen,
  Copy,
  Archive,
  Play,
  Pause,
  Square,
  Calendar,
  Users,
  FileText,
  Settings
} from 'lucide-react';
import { 
  ImageFile,
  Schedule,
  ScheduleStatus,
  FileAction,
  ScheduleAction,
  imageManagementApi,
  scheduleManagementApi,
  dataManagementUtils,
  SCHEDULE_STATUS_OPTIONS,
  FILE_ACTION_OPTIONS,
  SCHEDULE_ACTION_OPTIONS,
  NAMING_PATTERN_OPTIONS
} from '@/lib/api/dataManagementApi';
import { toast } from 'sonner';

export default function DataManagementPage() {
  const [activeTab, setActiveTab] = useState('images');
  const [loading, setLoading] = useState(false);
  
  // 이미지 파일 관리 상태
  const [images, setImages] = useState<ImageFile[]>([]);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [imageFilters, setImageFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    schedule_id: '',
    date_from: '',
    date_to: '',
    file_type: ''
  });
  const [imagePagination, setImagePagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  
  // 스케줄 관리 상태
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedSchedules, setSelectedSchedules] = useState<number[]>([]);
  const [scheduleFilters, setScheduleFilters] = useState({
    page: 1,
    limit: 20,
    search: '',
    status: '',
    customer_id: '',
    date_from: '',
    date_to: ''
  });
  const [schedulePagination, setSchedulePagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  
  // 다이얼로그 상태
  const [showBatchDialog, setShowBatchDialog] = useState(false);
  const [batchAction, setBatchAction] = useState<FileAction | ScheduleAction | null>(null);
  const [batchParameters, setBatchParameters] = useState<any>({});

  // 이미지 파일 데이터 로드
  const loadImages = async () => {
    try {
      setLoading(true);
      const response = await imageManagementApi.getImages({
        ...imageFilters,
        schedule_id: imageFilters.schedule_id ? Number(imageFilters.schedule_id) : undefined
      });
      
      if (response.success) {
        setImages(response.data);
        setImagePagination(response.pagination);
      }
    } catch (error) {
      console.error('이미지 로드 실패:', error);
      toast.error('이미지 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 스케줄 데이터 로드
  const loadSchedules = async () => {
    try {
      setLoading(true);
      const response = await scheduleManagementApi.getSchedules({
        ...scheduleFilters,
        status: scheduleFilters.status as ScheduleStatus || undefined,
        customer_id: scheduleFilters.customer_id ? Number(scheduleFilters.customer_id) : undefined,
        include_stats: true
      });
      
      if (response.success) {
        setSchedules(response.data);
        setSchedulePagination(response.pagination);
      }
    } catch (error) {
      console.error('스케줄 로드 실패:', error);
      toast.error('스케줄 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 초기 데이터 로드
  useEffect(() => {
    if (activeTab === 'images') {
      loadImages();
    } else if (activeTab === 'schedules') {
      loadSchedules();
    }
  }, [activeTab, imageFilters, scheduleFilters]);

  // 이미지 선택 핸들러
  const handleImageSelect = (imageId: number, checked: boolean) => {
    if (checked) {
      setSelectedImages(prev => [...prev, imageId]);
    } else {
      setSelectedImages(prev => prev.filter(id => id !== imageId));
    }
  };

  // 모든 이미지 선택/해제
  const handleSelectAllImages = (checked: boolean) => {
    if (checked) {
      setSelectedImages(images.map(img => img.id));
    } else {
      setSelectedImages([]);
    }
  };

  // 스케줄 선택 핸들러
  const handleScheduleSelect = (scheduleId: number, checked: boolean) => {
    if (checked) {
      setSelectedSchedules(prev => [...prev, scheduleId]);
    } else {
      setSelectedSchedules(prev => prev.filter(id => id !== scheduleId));
    }
  };

  // 모든 스케줄 선택/해제
  const handleSelectAllSchedules = (checked: boolean) => {
    if (checked) {
      setSelectedSchedules(schedules.map(schedule => schedule.id));
    } else {
      setSelectedSchedules([]);
    }
  };

  // 일괄 작업 실행
  const handleBatchOperation = async () => {
    if (!batchAction) return;

    try {
      setLoading(true);
      let response;

      if (activeTab === 'images') {
        response = await imageManagementApi.performBatchOperation({
          action: batchAction as FileAction,
          file_ids: selectedImages,
          parameters: batchParameters
        });
      } else {
        response = await scheduleManagementApi.performBatchOperation({
          action: batchAction as ScheduleAction,
          schedule_ids: selectedSchedules,
          parameters: batchParameters
        });
      }

      if (response.success) {
        toast.success(response.message);
        setShowBatchDialog(false);
        setBatchAction(null);
        setBatchParameters({});
        setSelectedImages([]);
        setSelectedSchedules([]);
        
        // 데이터 새로고침
        if (activeTab === 'images') {
          loadImages();
        } else {
          loadSchedules();
        }
      } else {
        toast.error(response.message || '작업 실행에 실패했습니다.');
      }
    } catch (error) {
      console.error('일괄 작업 실패:', error);
      toast.error('작업 실행 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 상태 배지 컴포넌트
  const StatusBadge = ({ status }: { status: ScheduleStatus }) => {
    const statusOption = SCHEDULE_STATUS_OPTIONS.find(opt => opt.value === status);
    return (
      <Badge variant={statusOption?.color === 'green' ? 'default' : 'secondary'}>
        {statusOption?.label || status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">데이터 관리</h1>
        <div className="flex space-x-2">
          <Button 
            variant="outline" 
            onClick={() => activeTab === 'images' ? loadImages() : loadSchedules()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            새로고침
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="images">이미지 파일 관리</TabsTrigger>
          <TabsTrigger value="schedules">스케줄 관리</TabsTrigger>
        </TabsList>

        <TabsContent value="images" className="space-y-4">
          {/* 이미지 파일 필터 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                필터 및 검색
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="image-search">검색</Label>
                  <Input
                    id="image-search"
                    placeholder="파일명으로 검색..."
                    value={imageFilters.search}
                    onChange={(e) => setImageFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-filter">스케줄</Label>
                  <Select 
                    value={imageFilters.schedule_id} 
                    onValueChange={(value) => setImageFilters(prev => ({ ...prev, schedule_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="스케줄 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">전체</SelectItem>
                      {schedules.map(schedule => (
                        <SelectItem key={schedule.id} value={schedule.id.toString()}>
                          {schedule.coil_id} - {schedule.customer_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date-from">시작 날짜</Label>
                  <Input
                    id="date-from"
                    type="date"
                    value={imageFilters.date_from}
                    onChange={(e) => setImageFilters(prev => ({ ...prev, date_from: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="date-to">종료 날짜</Label>
                  <Input
                    id="date-to"
                    type="date"
                    value={imageFilters.date_to}
                    onChange={(e) => setImageFilters(prev => ({ ...prev, date_to: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 이미지 파일 목록 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <FileImage className="h-5 w-5 mr-2" />
                  이미지 파일 목록 ({imagePagination.total}개)
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {selectedImages.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        {selectedImages.length}개 선택됨
                      </span>
                      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-2" />
                            일괄 작업
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>일괄 작업 ({selectedImages.length}개 파일)</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>작업 유형</Label>
                              <Select 
                                value={batchAction || ''} 
                                onValueChange={(value) => setBatchAction(value as FileAction)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="작업 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {FILE_ACTION_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {batchAction === 'rename' && (
                              <div>
                                <Label>파일명 패턴</Label>
                                <Select 
                                  value={batchParameters.naming_pattern || ''} 
                                  onValueChange={(value) => setBatchParameters((prev: any) => ({ ...prev, naming_pattern: value }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="패턴 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {NAMING_PATTERN_OPTIONS.map(option => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label} ({option.example})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            
                            {(batchAction === 'move' || batchAction === 'copy') && (
                              <div>
                                <Label>대상 디렉토리</Label>
                                <Input
                                  placeholder="/path/to/directory"
                                  value={batchParameters.target_directory || ''}
                                  onChange={(e) => setBatchParameters((prev: any) => ({ ...prev, target_directory: e.target.value }))}
                                />
                              </div>
                            )}
                            
                            <div className="flex justify-end space-x-2">
                              <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
                                취소
                              </Button>
                              <Button onClick={handleBatchOperation} disabled={!batchAction || loading}>
                                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                실행
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedImages.length === images.length && images.length > 0}
                          onCheckedChange={handleSelectAllImages}
                        />
                      </TableHead>
                      <TableHead>파일명</TableHead>
                      <TableHead>크기</TableHead>
                      <TableHead>스케줄</TableHead>
                      <TableHead>결함 정보</TableHead>
                      <TableHead>업로드 시간</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {images.map((image) => (
                      <TableRow key={image.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedImages.includes(image.id)}
                            onCheckedChange={(checked) => handleImageSelect(image.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <FileImage className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{image.original_filename}</span>
                          </div>
                        </TableCell>
                        <TableCell>{dataManagementUtils.formatFileSize(image.file_size)}</TableCell>
                        <TableCell>
                          {image.coil_id ? (
                            <div>
                              <div className="font-medium">{image.coil_id}</div>
                              <div className="text-sm text-gray-500">{image.customer_name}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {image.defect_type ? (
                            <div>
                              <div className="font-medium">{image.defect_type}</div>
                              <div className="text-sm text-gray-500">
                                신뢰도: {image.confidence_score?.toFixed(2)}%
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {new Date(image.upload_time).toLocaleString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* 페이지네이션 */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  총 {imagePagination.total}개 중 {(imagePagination.page - 1) * imagePagination.limit + 1}-{Math.min(imagePagination.page * imagePagination.limit, imagePagination.total)}개 표시
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={imagePagination.page === 1}
                    onClick={() => setImageFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    이전
                  </Button>
                  <span className="text-sm">
                    {imagePagination.page} / {imagePagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={imagePagination.page === imagePagination.totalPages}
                    onClick={() => setImageFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          {/* 스케줄 필터 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                필터 및 검색
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <Label htmlFor="schedule-search">검색</Label>
                  <Input
                    id="schedule-search"
                    placeholder="Coil ID로 검색..."
                    value={scheduleFilters.search}
                    onChange={(e) => setScheduleFilters(prev => ({ ...prev, search: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="status-filter">상태</Label>
                  <Select 
                    value={scheduleFilters.status} 
                    onValueChange={(value) => setScheduleFilters(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="상태 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">전체</SelectItem>
                      {SCHEDULE_STATUS_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="schedule-date-from">시작 날짜</Label>
                  <Input
                    id="schedule-date-from"
                    type="date"
                    value={scheduleFilters.date_from}
                    onChange={(e) => setScheduleFilters(prev => ({ ...prev, date_from: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-date-to">종료 날짜</Label>
                  <Input
                    id="schedule-date-to"
                    type="date"
                    value={scheduleFilters.date_to}
                    onChange={(e) => setScheduleFilters(prev => ({ ...prev, date_to: e.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 스케줄 목록 */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center">
                  <Calendar className="h-5 w-5 mr-2" />
                  스케줄 목록 ({schedulePagination.total}개)
                </CardTitle>
                <div className="flex items-center space-x-2">
                  {selectedSchedules.length > 0 && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">
                        {selectedSchedules.length}개 선택됨
                      </span>
                      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-2" />
                            일괄 작업
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>일괄 작업 ({selectedSchedules.length}개 스케줄)</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label>작업 유형</Label>
                              <Select 
                                value={batchAction || ''} 
                                onValueChange={(value) => setBatchAction(value as ScheduleAction)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="작업 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SCHEDULE_ACTION_OPTIONS.map(option => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            {batchAction === 'update_status' && (
                              <div>
                                <Label>새 상태</Label>
                                <Select 
                                  value={batchParameters.new_status || ''} 
                                  onValueChange={(value) => setBatchParameters((prev: any) => ({ ...prev, new_status: value }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="상태 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {SCHEDULE_STATUS_OPTIONS.map(option => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            
                            {batchAction === 'update_progress' && (
                              <div>
                                <Label>진행률 (%)</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  placeholder="0-100"
                                  value={batchParameters.progress_percentage || ''}
                                  onChange={(e) => setBatchParameters((prev: any) => ({ ...prev, progress_percentage: Number(e.target.value) }))}
                                />
                              </div>
                            )}
                            
                            {batchAction === 'export_data' && (
                              <div>
                                <Label>내보내기 형식</Label>
                                <Select 
                                  value={batchParameters.format || 'json'} 
                                  onValueChange={(value) => setBatchParameters((prev: any) => ({ ...prev, format: value }))}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="형식 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="json">JSON</SelectItem>
                                    <SelectItem value="csv">CSV</SelectItem>
                                    <SelectItem value="excel">Excel</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                            
                            <div className="flex justify-end space-x-2">
                              <Button variant="outline" onClick={() => setShowBatchDialog(false)}>
                                취소
                              </Button>
                              <Button onClick={handleBatchOperation} disabled={!batchAction || loading}>
                                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                실행
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedSchedules.length === schedules.length && schedules.length > 0}
                          onCheckedChange={handleSelectAllSchedules}
                        />
                      </TableHead>
                      <TableHead>Coil ID</TableHead>
                      <TableHead>고객사</TableHead>
                      <TableHead>상태</TableHead>
                      <TableHead>진행률</TableHead>
                      <TableHead>이미지/결함</TableHead>
                      <TableHead>생성일</TableHead>
                      <TableHead>작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {schedules.map((schedule) => (
                      <TableRow key={schedule.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedSchedules.includes(schedule.id)}
                            onCheckedChange={(checked) => handleScheduleSelect(schedule.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{schedule.coil_id}</div>
                          <div className="text-sm text-gray-500">
                            {schedule.material_type} - {schedule.thickness}mm
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{schedule.customer_name}</div>
                          <div className="text-sm text-gray-500">{schedule.customer_code}</div>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={schedule.status} />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Progress value={schedule.progress_percentage} className="h-2" />
                            <div className="text-sm text-gray-500">
                              {schedule.progress_percentage}%
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div>이미지: {schedule.image_count || 0}개</div>
                            <div>결함: {schedule.defect_count || 0}개</div>
                            {schedule.avg_confidence && (
                              <div className="text-gray-500">
                                평균 신뢰도: {schedule.avg_confidence.toFixed(1)}%
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {new Date(schedule.created_at).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* 페이지네이션 */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-gray-600">
                  총 {schedulePagination.total}개 중 {(schedulePagination.page - 1) * schedulePagination.limit + 1}-{Math.min(schedulePagination.page * schedulePagination.limit, schedulePagination.total)}개 표시
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={schedulePagination.page === 1}
                    onClick={() => setScheduleFilters(prev => ({ ...prev, page: prev.page - 1 }))}
                  >
                    이전
                  </Button>
                  <span className="text-sm">
                    {schedulePagination.page} / {schedulePagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={schedulePagination.page === schedulePagination.totalPages}
                    onClick={() => setScheduleFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  >
                    다음
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 