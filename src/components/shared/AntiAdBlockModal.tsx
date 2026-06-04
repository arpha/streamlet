"use client"

import { ShieldAlert, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AntiAdBlockModal() {
  const handleReload = () => {
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-[#020617]/85 backdrop-blur-md p-6 animate-in fade-in duration-300">
      <div className="w-full max-w-md p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/10 flex flex-col items-center text-center relative overflow-hidden shadow-2xl">
        {/* Glow Effects */}
        <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[80px]" />
        <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-fuchsia-600/10 rounded-full blur-[80px]" />

        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-6 text-rose-400 animate-pulse">
          <ShieldAlert className="w-8 h-8" />
        </div>

        <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-3 italic">
          AdBlocker Detected
        </h3>

        <p className="text-white/60 text-sm font-medium mb-8 leading-relaxed">
          Our platform is completely free to use and we rely entirely on advertisement revenue to pay out rewards. 
          Please disable your ad blocker for <span className="text-purple-400 font-bold">Streamlet</span> and refresh the page to continue.
        </p>

        <Button 
          onClick={handleReload}
          className="w-full h-12 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black shadow-lg shadow-purple-500/20 group flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
          REFRESH PAGE
        </Button>
      </div>
    </div>
  )
}
