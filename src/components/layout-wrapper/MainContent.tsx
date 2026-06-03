"use client"

import { useStore } from "@/store/useStore"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/Sidebar"
import { Navbar } from "@/components/layout/Navbar"
import { useAuth } from "@/components/providers/AuthProvider"

export function MainContent({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, toggleSidebar } = useStore()
  const { user, loading } = useAuth()

  // If not logged in, just show children (LandingPage) without Sidebar/Navbar
  if (!loading && !user) {
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
        
        {/* Top Ad Banner */}
        <div className="px-6 pt-6 w-full max-w-[1200px] mx-auto">
          <div className="w-full py-2 bg-white/[0.01] border border-white/[0.03] rounded-2xl overflow-hidden backdrop-blur-md flex flex-col items-center">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">Sponsored Advertisement</span>
            <div className="w-full flex justify-center items-center min-h-[90px]">
              <iframe 
                data-aa="2440986" 
                src="https://acceptable.a-ads.com/2440986/?size=Adaptive"
                style={{ border: 0, padding: 0, width: '100%', height: '90px', overflow: 'hidden', display: 'block', margin: 'auto' }}
              />
            </div>
          </div>
        </div>

        {/* Content Area with Side Ads */}
        <div className="flex-1 flex flex-col xl:flex-row relative max-w-[1400px] mx-auto w-full">
          
          {/* Left Ad Column (xl and up) */}
          <div className="hidden xl:flex w-[160px] flex-shrink-0 p-4 border-r border-white/[0.03] justify-center items-start">
            <div className="sticky top-24 w-full py-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl overflow-hidden backdrop-blur-md flex flex-col items-center">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">Ad</span>
              <iframe 
                data-aa="2440986" 
                src="https://acceptable.a-ads.com/2440986/?size=Adaptive"
                style={{ border: 0, padding: 0, width: '120px', height: '600px', overflow: 'hidden', display: 'block', margin: 'auto' }}
              />
            </div>
          </div>

          {/* Main Page Content */}
          <main className="flex-grow p-6 overflow-auto">
            {children}
          </main>

          {/* Right Ad Column (xl and up) */}
          <div className="hidden xl:flex w-[160px] flex-shrink-0 p-4 border-l border-white/[0.03] justify-center items-start">
            <div className="sticky top-24 w-full py-4 bg-white/[0.01] border border-white/[0.03] rounded-2xl overflow-hidden backdrop-blur-md flex flex-col items-center">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20 mb-2">Ad</span>
              <iframe 
                data-aa="2440986" 
                src="https://acceptable.a-ads.com/2440986/?size=Adaptive"
                style={{ border: 0, padding: 0, width: '120px', height: '600px', overflow: 'hidden', display: 'block', margin: 'auto' }}
              />
            </div>
          </div>

        </div>

        {/* Bottom Ad Banner */}
        <div className="px-6 pb-6 w-full max-w-[1200px] mx-auto">
          <div className="w-full py-2 bg-white/[0.01] border border-white/[0.03] rounded-2xl overflow-hidden backdrop-blur-md flex flex-col items-center">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white/20 mb-1">Sponsored Advertisement</span>
            <div className="w-full flex justify-center items-center min-h-[90px]">
              <iframe 
                data-aa="2440986" 
                src="https://acceptable.a-ads.com/2440986/?size=Adaptive"
                style={{ border: 0, padding: 0, width: '100%', height: '90px', overflow: 'hidden', display: 'block', margin: 'auto' }}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
