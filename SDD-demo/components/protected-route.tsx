"use client"

import type React from "react"

import { useAuth } from "@/contexts/auth-context"
import { Loader2 } from "lucide-react"

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen aurora-bg flex items-center justify-center">
        <div className="glass-card p-8 rounded-lg">
          <div className="flex items-center gap-3 text-white">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>시스템 로딩 중...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // AuthContext에서 리다이렉트 처리
  }

  return <>{children}</>
}
