"use client"

import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"
import { useAuth } from "@/components/providers/AuthProvider"
import { usePathname } from "next/navigation"

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, toggleSidebar } = useStore()
  const { user, loading } = useAuth()
  const pathname = usePathname()

  // If not logged in or viewing the PTC ad viewer, show full screen content without sidebar/navbar
  if ((!loading && !user) || pathname === "/ptc/view") {
    return <div className="min-h-screen bg-[#020617]">{children}</div>
  }

  return (
    <div className="flex min-h-screen bg-[#020617] relative">
      <Sidebar />
      
      {/* Backdrop overlay for mobile when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden transition-all duration-300"
          onClick={toggleSidebar}
        />
      )}

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
