"use client"

import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"
import { useAuth } from "@/components/providers/AuthProvider"

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen } = useStore()
  const { user, loading } = useAuth()

  // If not logged in, just show children (LandingPage) without Sidebar/Navbar
  if (!loading && !user) {
    return <div className="min-h-screen bg-[#020617]">{children}</div>
  }

  return (
    <div className="flex min-h-screen bg-[#020617]">
      <Sidebar />
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        isSidebarOpen ? "md:ml-72" : "md:ml-20"
      )}>
        <Navbar />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
