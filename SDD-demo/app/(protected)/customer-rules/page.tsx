"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Save, Plus, Trash2, Building2, Settings } from "lucide-react"

export default function CustomerRulesPage() {
  const [selectedCustomer, setSelectedCustomer] = useState("company-a")
  const [customers] = useState([
    {
      id: "company-a",
      name: "A 업체",
      standards: {
        scratch: { threshold: 2.0, sensitivity: 80, alertEnabled: true },
        stain: { threshold: 1.5, sensitivity: 70, alertEnabled: true },
        hole: { threshold: 0.5, sensitivity: 90, alertEnabled: true },
      },
    },
    {
      id: "company-b",
      name: "B 업체",
      standards: {
        scratch: { threshold: 1.5, sensitivity: 85, alertEnabled: true },
        stain: { threshold: 1.0, sensitivity: 75, alertEnabled: false },
        hole: { threshold: 0.3, sensitivity: 95, alertEnabled: true },
      },
    },
    {
      id: "company-c",
      name: "C 업체",
      standards: {
        scratch: { threshold: 2.5, sensitivity: 75, alertEnabled: true },
        stain: { threshold: 2.0, sensitivity: 65, alertEnabled: true },
        hole: { threshold: 0.8, sensitivity: 85, alertEnabled: true },
      },
    },
  ])

  const [currentStandards, setCurrentStandards] = useState(
    customers.find((c) => c.id === selectedCustomer)?.standards || customers[0].standards,
  )

  const defectTypes = [
    { key: "scratch", name: "스크래치", unit: "mm", color: "bg-red-500" },
    { key: "stain", name: "얼룩", unit: "mm", color: "bg-yellow-500" },
    { key: "hole", name: "구멍", unit: "mm", color: "bg-blue-500" },
  ]

  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomer(customerId)
    const customer = customers.find((c) => c.id === customerId)
    if (customer) {
      setCurrentStandards(customer.standards)
    }
  }

  const updateStandard = (defectType: string, field: string, value: any) => {
    setCurrentStandards((prev) => ({
      ...prev,
      [defectType]: {
        ...prev[defectType as keyof typeof prev],
        [field]: value,
      },
    }))
  }

  const handleSave = () => {
    console.log("저장된 기준:", { customer: selectedCustomer, standards: currentStandards })
    // 실제 구현에서는 API 호출
  }

  return (
    <div className="min-h-screen aurora-bg p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="glass-panel rounded-lg p-6">
          <h1 className="text-3xl font-bold text-white">고객사별 불량 기준 설정</h1>
          <p className="text-white/80">고객사별로 상이한 불량 판정 기준을 설정하고 관리합니다</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 고객사 목록 */}
          <div className="lg:col-span-1">
            <Card className="glass-card border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  고객사 목록
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {customers.map((customer) => (
                  <div
                    key={customer.id}
                    className={`p-3 rounded-lg cursor-pointer transition-all ${
                      selectedCustomer === customer.id
                        ? "bg-white/20 border-2 border-white/40"
                        : "bg-white/10 hover:bg-white/15"
                    }`}
                    onClick={() => handleCustomerChange(customer.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{customer.name}</span>
                      {selectedCustomer === customer.id && (
                        <Badge variant="default" className="text-xs">
                          선택됨
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}

                <Button variant="outline" className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20">
                  <Plus className="w-4 h-4 mr-2" />새 고객사 추가
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* 기준 설정 */}
          <div className="lg:col-span-3">
            <Card className="glass-card border-white/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  {customers.find((c) => c.id === selectedCustomer)?.name} 불량 기준 설정
                </CardTitle>
                <CardDescription className="text-white/80">선택된 고객사의 불량 판정 기준을 설정합니다</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {defectTypes.map((defectType) => (
                  <div key={defectType.key} className="p-6 bg-white/5 rounded-lg space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded ${defectType.color}`} />
                      <h3 className="text-lg font-semibold text-white">{defectType.name}</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* 임계값 설정 */}
                      <div className="space-y-3">
                        <Label className="text-white">임계값 ({defectType.unit})</Label>
                        <Input
                          type="number"
                          step="0.1"
                          value={currentStandards[defectType.key as keyof typeof currentStandards].threshold}
                          onChange={(e) => updateStandard(defectType.key, "threshold", Number(e.target.value))}
                          className="bg-white/10 border-white/20 text-white"
                        />
                        <p className="text-xs text-white/60">이 값 이상의 {defectType.name}을 불량으로 판정합니다</p>
                      </div>

                      {/* 민감도 설정 */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-white">민감도</Label>
                          <span className="text-white/80 text-sm">
                            {currentStandards[defectType.key as keyof typeof currentStandards].sensitivity}%
                          </span>
                        </div>
                        <Slider
                          value={[currentStandards[defectType.key as keyof typeof currentStandards].sensitivity]}
                          onValueChange={(value) => updateStandard(defectType.key, "sensitivity", value[0])}
                          max={100}
                          step={5}
                          className="w-full"
                        />
                        <p className="text-xs text-white/60">높을수록 더 민감하게 검출합니다</p>
                      </div>

                      {/* 알림 설정 */}
                      <div className="space-y-3">
                        <Label className="text-white">실시간 알림</Label>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={currentStandards[defectType.key as keyof typeof currentStandards].alertEnabled}
                            onCheckedChange={(checked) => updateStandard(defectType.key, "alertEnabled", checked)}
                          />
                          <span className="text-white/80 text-sm">
                            {currentStandards[defectType.key as keyof typeof currentStandards].alertEnabled
                              ? "활성화"
                              : "비활성화"}
                          </span>
                        </div>
                        <p className="text-xs text-white/60">검출 시 즉시 알림을 전송합니다</p>
                      </div>
                    </div>

                    {/* 미리보기 */}
                    <div className="mt-4 p-3 bg-white/10 rounded border-l-4 border-blue-500">
                      <p className="text-white text-sm">
                        <strong>설정 요약:</strong> {defectType.name}{" "}
                        {currentStandards[defectType.key as keyof typeof currentStandards].threshold}
                        {defectType.unit} 이상, 민감도{" "}
                        {currentStandards[defectType.key as keyof typeof currentStandards].sensitivity}%, 알림{" "}
                        {currentStandards[defectType.key as keyof typeof currentStandards].alertEnabled
                          ? "켜짐"
                          : "꺼짐"}
                      </p>
                    </div>
                  </div>
                ))}

                {/* 저장 버튼 */}
                <div className="flex gap-3 pt-4">
                  <Button onClick={handleSave} className="bg-white/20 hover:bg-white/30 text-white border-white/30">
                    <Save className="w-4 h-4 mr-2" />
                    설정 저장
                  </Button>
                  <Button variant="outline" className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                    기본값 복원
                  </Button>
                  <Button
                    variant="outline"
                    className="bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    고객사 삭제
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 기준 비교 */}
        <Card className="glass-card border-white/20">
          <CardHeader>
            <CardTitle className="text-white">고객사별 기준 비교</CardTitle>
            <CardDescription className="text-white/80">모든 고객사의 불량 기준을 한눈에 비교합니다</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left text-white p-3">고객사</th>
                    {defectTypes.map((type) => (
                      <th key={type.key} className="text-left text-white p-3">
                        {type.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id} className="border-b border-white/10">
                      <td className="text-white p-3 font-medium">{customer.name}</td>
                      {defectTypes.map((type) => (
                        <td key={type.key} className="text-white p-3">
                          <div className="space-y-1">
                            <div className="text-sm">
                              임계값: {customer.standards[type.key as keyof typeof customer.standards].threshold}
                              {type.unit}
                            </div>
                            <div className="text-xs text-white/60">
                              민감도: {customer.standards[type.key as keyof typeof customer.standards].sensitivity}%
                            </div>
                            <Badge
                              variant={
                                customer.standards[type.key as keyof typeof customer.standards].alertEnabled
                                  ? "default"
                                  : "secondary"
                              }
                              className="text-xs"
                            >
                              {customer.standards[type.key as keyof typeof customer.standards].alertEnabled
                                ? "알림 ON"
                                : "알림 OFF"}
                            </Badge>
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
