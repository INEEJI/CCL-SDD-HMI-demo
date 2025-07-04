"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Monitor,
  History,
  Building2,
  Brain,
  Database,
  Stethoscope,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  AlertTriangle,
} from "lucide-react"

const navigation = [
  {
    name: "실시간 모니터링",
    href: "/dashboard",
    icon: Monitor,
    badge: "LIVE",
  },
  {
    name: "결함 이력",
    href: "/history",
    icon: History,
    count: 156,
  },
  {
    name: "고객사 기준",
    href: "/customer-rules",
    icon: Building2,
  },
  {
    name: "AI 모델 관리",
    href: "/model-management",
    icon: Brain,
    badge: "v2.1",
  },
  {
    name: "데이터 관리",
    href: "/data-management",
    icon: Database,
  },
  {
    name: "시스템 진단",
    href: "/diagnostics",
    icon: Stethoscope,
    status: "정상",
  },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()

  return (
    <div
      className={cn(
        "glass-panel border-r border-white/20 transition-all duration-300 flex flex-col",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* 로고 및 토글 */}
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div>
              <h2 className="text-lg font-bold text-white">CCL SDD</h2>
              <p className="text-xs text-white/60">표면 결함 검사</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className="text-white hover:bg-white/10"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* 시스템 상태 */}
      {!collapsed && (
        <div className="p-4 border-b border-white/20">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-green-400" />
              <span className="text-sm text-white">시스템 정상</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              <span className="text-sm text-white">결함 3건</span>
            </div>
          </div>
        </div>
      )}

      {/* 네비게이션 */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-all group",
                    isActive ? "bg-white/20 text-white" : "text-white/80 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {item.badge}
                        </Badge>
                      )}
                      {item.count && (
                        <Badge variant="outline" className="text-xs">
                          {item.count}
                        </Badge>
                      )}
                      {item.status && (
                        <div
                          className={cn("w-2 h-2 rounded-full", item.status === "정상" ? "bg-green-400" : "bg-red-400")}
                        />
                      )}
                    </>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* 하단 설정 */}
      <div className="p-4 border-t border-white/20">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-all"
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>시스템 설정</span>}
        </Link>
      </div>
    </div>
  )
}
