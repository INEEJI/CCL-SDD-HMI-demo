"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2, Factory } from "lucide-react"

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.push("/dashboard")
      } else {
        router.push("/login")
      }
    }
  }, [user, isLoading, router])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="hmi-panel p-8">
          <CardContent className="flex flex-col items-center gap-4">
            <Factory className="w-12 h-12 text-hmi-blue" />
            <div className="flex items-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-hmi-blue" />
              <span className="text-lg font-medium">시스템 초기화 중...</span>
            </div>
            <div className="text-sm text-muted-foreground">CCL SDD 표면 결함 검사 시스템</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return null
}
