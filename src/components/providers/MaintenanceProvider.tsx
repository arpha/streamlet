"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { MaintenanceView } from "@/components/layout/MaintenanceView"
import { Loader2 } from "lucide-react"

interface MaintenanceConfig {
  enabled: boolean
  message: string
}

const MaintenanceContext = createContext<{
  maintenance: MaintenanceConfig
  setMaintenance: (config: MaintenanceConfig) => void
  loadingSettings: boolean
} | null>(null)

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const pathname = usePathname()
  const { loading: loadingAuth } = useAuth()
  const { isAdmin } = useStore()
  
  const [maintenance, setMaintenance] = useState<MaintenanceConfig>({
    enabled: false,
    message: ""
  })
  const [loadingSettings, setLoadingSettings] = useState(true)

  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data, error } = await supabase
          .from("system_settings")
          .select("value")
          .eq("key", "maintenance_mode")
          .single()

        if (data && data.value) {
          setMaintenance(data.value as MaintenanceConfig)
        }
      } catch (err) {
        console.error("Error fetching system settings:", err)
      } finally {
        setLoadingSettings(false)
      }
    }

    fetchSettings()

    // Real-time listener for maintenance_mode changes
    const channel = supabase
      .channel("system_settings_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_settings" },
        (payload) => {
          if (payload.new && (payload.new as any).key === "maintenance_mode") {
            setMaintenance((payload.new as any).value as MaintenanceConfig)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase])

  // Show loading indicator if loading settings
  if (loadingSettings) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // Determine if we should block access
  const isApiRoute = pathname?.startsWith("/api/")
  const isAdminRoute = pathname?.startsWith("/admin/")
  const isAuthRoute = pathname?.startsWith("/auth/")

  const shouldBlock = 
    maintenance.enabled && 
    !isAdmin && 
    !isApiRoute && 
    !isAdminRoute && 
    !isAuthRoute

  if (shouldBlock) {
    return <MaintenanceView message={maintenance.message} />
  }

  return (
    <MaintenanceContext.Provider value={{ maintenance, setMaintenance, loadingSettings }}>
      {children}
    </MaintenanceContext.Provider>
  )
}

export const useMaintenance = () => {
  const context = useContext(MaintenanceContext)
  if (!context) {
    throw new Error("useMaintenance must be used within a MaintenanceProvider")
  }
  return context
}
