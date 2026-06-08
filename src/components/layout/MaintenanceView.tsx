"use client"

import { Wrench, ShieldAlert, Sparkles, LogOut } from "lucide-react"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

interface MaintenanceViewProps {
  message?: string
}

export function MaintenanceView({ message }: MaintenanceViewProps) {
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-[#020617] relative flex items-center justify-center p-6 overflow-hidden">
      {/* Premium glowing background gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-fuchsia-600/10 rounded-full blur-[120px] animate-pulse pointer-events-none" />

      {/* Decorative background grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full relative z-10"
      >
        <div className="glass border-white/10 rounded-[32px] p-8 md:p-10 text-center shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Top colored accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-fuchsia-500 to-primary" />

          {/* Animated Header Icon */}
          <div className="relative w-24 h-24 mx-auto mb-8 flex items-center justify-center">
            <motion.div 
              animate={{ 
                scale: [1, 1.05, 1],
                rotate: [0, 5, -5, 0]
              }}
              transition={{ 
                duration: 5, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-fuchsia-600 flex items-center justify-center shadow-lg shadow-primary/20 border border-white/10"
            >
              <Wrench className="w-10 h-10 text-white animate-pulse" />
            </motion.div>
            
            {/* Pulsing outer ring */}
            <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping pointer-events-none" style={{ animationDuration: '3s' }} />
          </div>

          {/* Main Title */}
          <h1 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tight mb-4 flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Sistem Maintenance
          </h1>

          {/* Custom message */}
          <p className="text-white/60 font-medium leading-relaxed mb-8">
            {message || "Kami sedang melakukan pemeliharaan sistem secara berkala untuk meningkatkan kenyamanan Anda bermain dan klaim hadiah. Silakan kembali lagi beberapa saat lagi."}
          </p>

          <div className="border-t border-white/5 pt-6 space-y-4">
            <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider bg-amber-500/10 border border-amber-500/20 py-2 px-4 rounded-xl">
              <ShieldAlert className="w-4 h-4" />
              Kembali segera setelah selesai
            </div>

            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className="w-full rounded-2xl glass border-white/10 hover:bg-rose-500/10 hover:text-rose-400 text-white/50 h-11 flex items-center justify-center gap-2 font-bold text-xs uppercase tracking-widest transition-all"
            >
              <LogOut className="w-4 h-4" />
              Keluar Akun (Logout)
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
