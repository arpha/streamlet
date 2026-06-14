"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { ShieldAlert, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { motion } from "framer-motion"

interface SuspendedViewProps {
  reason?: string | null
}

export function SuspendedView({ reason }: SuspendedViewProps) {
  const supabase = createClient()
  const router = useRouter()
  const resetStore = useStore((state) => state.reset)

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut()
      resetStore()
      toast.success("Successfully logged out.")
      router.push("/auth/login")
    } catch (err) {
      console.error("Sign out error:", err)
      toast.error("Failed to sign out. Please try again.")
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center p-4 relative overflow-hidden">
      {/* Decorative glow elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white/[0.02] border border-rose-500/20 rounded-[3rem] p-8 md:p-10 shadow-2xl shadow-rose-950/20 backdrop-blur-md relative z-10 text-center space-y-6"
      >
        <div className="flex justify-center">
          <div className="p-5 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 shadow-lg shadow-rose-500/5 animate-pulse">
            <ShieldAlert className="w-12 h-12" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl md:text-3xl font-black text-rose-500 uppercase italic tracking-tight">
            Akun Ditangguhkan
          </h2>
          <p className="text-xs text-white/50 font-bold uppercase tracking-wider">
            Akses Dibatasi
          </p>
        </div>

        <p className="text-sm text-zinc-300 font-medium leading-relaxed">
          Akun Anda telah ditangguhkan karena terdeteksi melanggar ketentuan layanan kami (seperti penggunaan VPN, bot, multi-akun, atau bentuk kecurangan lainnya).
        </p>

        {reason ? (
          <div className="p-4 rounded-2xl bg-rose-950/20 border border-rose-500/10 text-left space-y-1">
            <span className="text-[10px] text-rose-400 font-bold uppercase tracking-wider">Alasan Penangguhan:</span>
            <p className="text-xs text-rose-300/80 font-bold leading-relaxed">{reason}</p>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-zinc-950/40 border border-white/5 text-left space-y-1">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Alasan Penangguhan:</span>
            <p className="text-xs text-zinc-400 font-bold italic leading-relaxed">Melanggar syarat dan ketentuan Streamlet.</p>
          </div>
        )}

        <div className="pt-2">
          <p className="text-[10px] text-white/40 font-bold leading-relaxed">
            Jika Anda merasa ini adalah kesalahan, silakan hubungi dukungan pelanggan kami melalui grup Telegram atau email resmi kami.
          </p>
        </div>

        <div className="border-t border-white/5 pt-6">
          <Button
            onClick={handleSignOut}
            className="w-full rounded-2xl h-12 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-rose-500/20 transition-all border-0 cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Keluar Akun
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
