"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Upload, Play, Pause, Settings, BarChart3, CheckCircle, AlertCircle, Zap, Brain } from "lucide-react"

export default function ModelManagementPage() {
  const [selectedModel, setSelectedModel] = useState<any>(null)
  const [deploymentMode, setDeploymentMode] = useState("single")
  const [isDeploying, setIsDeploying] = useState(false)

  const models = [
    {
      id: 1,
      name: "DefectNet v2.1",
      version: "2.1.0",
      type: "불량 검출",
      status: "활성",
      accuracy: 94.5,
      precision: 92.8,
      recall: 96.2,
      f1Score: 94.5,
      deployedAt: "2024-01-10",
      bomAssigned: ["BOM-A-001", "BOM-A-002"],
      description: "주요 불량 유형 검출을 위한 메인 모델",
      fileSize: "245MB",
      trainingData: "15,000 images",
    },
    {
      id: 2,
      name: "ClassifyNet v1.3",
      version: "1.3.2",
      type: "불량 분류",
      status: "대기",
      accuracy: 89.2,
      precision: 87.5,
      recall: 91.0,
      f1Score: 89.2,
      deployedAt: null,
      bomAssigned: [],
      description: "불량 유형 세부 분류를 위한 보조 모델",
      fileSize: "180MB",
      trainingData: "12,000 images",
    },
    {
      id: 3,
      name: "DefectNet v2.0",
      version: "2.0.5",
      type: "불량 검출",
      status: "비활성",
      accuracy: 91.8,
      precision: 89.3,
      recall: 94.1,
      f1Score: 91.6,
      deployedAt: "2024-01-05",
      bomAssigned: [],
      description: "이전 버전 불량 검출 모델",
      fileSize: "220MB",
      trainingData: "10,000 images",
    },
  ]

  const bomList = [
    { id: "BOM-A-001", name: "스테인리스 스틸 A급", description: "두께 0.5mm, 폭 1200mm" },
    { id: "BOM-A-002", name: "스테인리스 스틸 B급", description: "두께 0.8mm, 폭 1000mm" },
    { id: "BOM-B-001", name: "알루미늄 합금 A급", description: "두께 0.3mm, 폭 1500mm" },
    { id: "BOM-B-002", name: "알루미늄 합금 B급", description: "두께 0.6mm, 폭 1200mm" },
  ]

  const deploymentSystems = [
    { id: "main", name: "메인 검출 시스템", status: "정상", currentModel: "DefectNet v2.1" },
    { id: "backup", name: "백업 검출 시스템", status: "대기", currentModel: "DefectNet v2.0" },
    { id: "test", name: "테스트 시스템", status: "정상", currentModel: "ClassifyNet v1.3" },
  ]

  const handleDeploy = async (modelId: number, systemId: string) => {
    setIsDeploying(true)
    try {
      // 실제 구현에서는 FTP 전송 API 호출
      await new Promise((resolve) => setTimeout(resolve, 3000))
      console.log(`모델 ${modelId}를 시스템 ${systemId}에 배포 완료`)
    } catch (error) {
      console.error("배포 실패:", error)
    } finally {
      setIsDeploying(false)
    }
  }

  return (
    <div className="min-h-screen aurora-bg p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="glass-panel rounded-lg p-6">
          <h1 className="text-3xl font-bold text-white">AI 모델 관리</h1>
          <p className="text-white/80">결함 검출에 사용되는 AI 모델을 관리, 배포하고 성능을 확인합니다</p>
        </div>

        {/* 모델 배포 설정 */}
        <Card className="glass-card border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings className="w-5 h-5" />
              모델 배포 설정
            </CardTitle>
            <CardDescription className="text-white/80">검출 모델 운영 방식 설정</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">배포 모드</Label>
                  <Select value={deploymentMode} onValueChange={setDeploymentMode}>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">단일 모델 (불량 검출만)</SelectItem>
                      <SelectItem value="multi">다중 모델 (검출 + 분류)</SelectItem>
                      <SelectItem value="ensemble">앙상블 모델 (여러 모델 조합)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-white">자동 모델 전환</Label>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-white">성능 모니터링</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-white">A/B 테스트</Label>
                  <Switch />
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">현재 활성 모델</h3>
                <div className="p-4 bg-white/10 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">DefectNet v2.1</span>
                    <Badge variant="default">활성</Badge>
                  </div>
                  <div className="text-sm text-white/80 space-y-1">
                    <p>정확도: 94.5%</p>
                    <p>배포일: 2024-01-10</p>
                    <p>처리 속도: 45ms/frame</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 모델 목록 */}
        <Card className="glass-card border-white/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  모델 목록
                </CardTitle>
                <CardDescription className="text-white/80">등록된 AI 모델 관리</CardDescription>
              </div>
              <Button className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                <Upload className="w-4 h-4 mr-2" />새 모델 업로드
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/20">
                    <TableHead className="text-white/80">모델명</TableHead>
                    <TableHead className="text-white/80">버전</TableHead>
                    <TableHead className="text-white/80">유형</TableHead>
                    <TableHead className="text-white/80">상태</TableHead>
                    <TableHead className="text-white/80">성능</TableHead>
                    <TableHead className="text-white/80">BOM 할당</TableHead>
                    <TableHead className="text-white/80">작업</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {models.map((model) => (
                    <TableRow key={model.id} className="border-white/10 hover:bg-white/5">
                      <TableCell className="text-white">
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-sm text-white/60">{model.description}</div>
                          <div className="text-xs text-white/40 mt-1">
                            {model.fileSize} • {model.trainingData}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-white">{model.version}</TableCell>
                      <TableCell className="text-white">{model.type}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            model.status === "활성" ? "default" : model.status === "대기" ? "secondary" : "outline"
                          }
                        >
                          {model.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm text-white">정확도: {model.accuracy}%</div>
                          <Progress value={model.accuracy} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {model.bomAssigned.map((bom) => (
                            <Badge key={bom} variant="outline" className="text-xs">
                              {bom}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedModel(model)}
                                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                              >
                                <BarChart3 className="w-4 h-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl">
                              <DialogHeader>
                                <DialogTitle>모델 성능 정보</DialogTitle>
                                <DialogDescription>
                                  {model.name} - {model.version}
                                </DialogDescription>
                              </DialogHeader>
                              {selectedModel && (
                                <div className="space-y-6">
                                  <div className="grid grid-cols-4 gap-4">
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-blue-600">{selectedModel.accuracy}%</div>
                                      <div className="text-sm text-gray-600">정확도</div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-green-600">
                                        {selectedModel.precision}%
                                      </div>
                                      <div className="text-sm text-gray-600">정밀도</div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-purple-600">{selectedModel.recall}%</div>
                                      <div className="text-sm text-gray-600">재현율</div>
                                    </div>
                                    <div className="text-center p-4 border rounded-lg">
                                      <div className="text-2xl font-bold text-orange-600">{selectedModel.f1Score}%</div>
                                      <div className="text-sm text-gray-600">F1 Score</div>
                                    </div>
                                  </div>
                                  <div className="space-y-4">
                                    <h3 className="text-lg font-semibold">BOM 할당 관리</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                      {bomList.map((bom) => (
                                        <div
                                          key={bom.id}
                                          className="flex items-center justify-between p-3 border rounded-lg"
                                        >
                                          <div>
                                            <span className="text-sm font-medium">{bom.name}</span>
                                            <p className="text-xs text-gray-600">{bom.description}</p>
                                          </div>
                                          <Switch checked={selectedModel.bomAssigned.includes(bom.id)} />
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </DialogContent>
                          </Dialog>
                          {model.status === "활성" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                            >
                              <Pause className="w-4 h-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                            >
                              <Play className="w-4 h-4" />
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                          >
                            <Settings className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* FTP 배포 */}
        <Card className="glass-card border-white/20">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Zap className="w-5 h-5" />
              모델 배포
            </CardTitle>
            <CardDescription className="text-white/80">선택된 모델을 검출 프로그램에 FTP 전송</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-white">배포할 모델 선택</Label>
                  <Select>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="모델 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id.toString()}>
                          {model.name} - {model.version}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">대상 시스템</Label>
                  <Select>
                    <SelectTrigger className="bg-white/10 border-white/20 text-white">
                      <SelectValue placeholder="시스템 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {deploymentSystems.map((system) => (
                        <SelectItem key={system.id} value={system.id}>
                          {system.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-white">FTP 서버 설정</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      placeholder="서버 주소"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                    <Input
                      placeholder="포트"
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/60"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white">배포 상태</h3>
                <div className="space-y-3">
                  {deploymentSystems.map((system) => (
                    <div key={system.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                      {system.status === "정상" ? (
                        <CheckCircle className="w-5 h-5 text-green-400" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-400" />
                      )}
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{system.name}</p>
                        <p className="text-xs text-white/60">현재: {system.currentModel}</p>
                      </div>
                      <Badge variant={system.status === "정상" ? "default" : "secondary"} className="text-xs">
                        {system.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => handleDeploy(1, "main")}
                disabled={isDeploying}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
              >
                <Zap className="w-4 h-4 mr-2" />
                {isDeploying ? "배포 중..." : "모델 배포"}
              </Button>
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                배포 이력 확인
              </Button>
              <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                롤백
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
