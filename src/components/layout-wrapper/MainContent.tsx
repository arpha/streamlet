"use client"

import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"
import { useAuth } from "@/components/providers/AuthProvider"
import { usePathname } from "next/navigation"
import Script from "next/script"

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, toggleSidebar } = useStore()
  const { user, loading } = useAuth()
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith("/admin")

  // If not logged in or viewing the PTC ad viewer, show full screen content without sidebar/navbar
  if ((!loading && !user) || pathname === "/ptc/view") {
    return (
      <>
        {!isAdmin && (
          <Script 
            src="https://pl29698490.effectivecpmnetwork.com/0f/50/ff/0f50ffe8fe96addd47e6d4305d80cb9c.js"
            strategy="afterInteractive"
          />
        )}
        <div className="min-h-screen bg-[#020617]">{children}</div>
      </>
    )
  }

  return (
    <>
      {!isAdmin && (
        <Script 
          src="https://pl29698490.effectivecpmnetwork.com/0f/50/ff/0f50ffe8fe96addd47e6d4305d80cb9c.js"
          strategy="afterInteractive"
        />
      )}
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
    </>
  )
}
