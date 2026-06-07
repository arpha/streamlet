"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Gamepad2, 
  Coins, 
  HelpCircle, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  MousePointer2
} from "lucide-react"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"

export default function OfferwallsPage() {
  const router = useRouter()
  const { id: userId, balance } = useStore()
  const [appId, setAppId] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    // Load the public Monlix App ID from env
    const monlixAppId = process.env.NEXT_PUBLIC_MONLIX_APP_ID || ""
    setAppId(monlixAppId)
    setLoading(false)
  }, [])

  const handleLoginRedirect = () => {
    router.push("/auth/login")
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* HEADER */}
      <div className="text-center md:text-left relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest mb-4">
          <Gamepad2 className="w-3.5 h-3.5" />
          Offerwalls Wall
        </div>
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 italic uppercase">OFFERWALLS</h2>
        <p className="text-white/60 font-medium italic">Complete surveys, install apps, and complete online tasks to earn massive points!</p>
      </div>

      {/* EXPLANATION CARDS */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: Easy Payouts */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Offerwall Provider</span>
              <span className="text-2xl font-black font-mono text-amber-400">Monlix Offers</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Gamepad2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Exchange rate */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Conversion Rate</span>
              <span className="text-2xl font-black font-mono text-cyan-400">200,000 Pts / $1</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Coins className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Referral Commission */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Referral Bonus</span>
              <span className="text-2xl font-black font-mono text-emerald-400">10% Commission</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <MousePointer2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* USER CHECK */}
      {!userId ? (
        <Card className="glass border-white/10 rounded-[2rem] p-8 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Info className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Authentication Required</h3>
            <p className="text-white/60 text-sm">
              Please sign in to your account to access offerwalls. Your user ID is required to credit points to your balance upon offer completion.
            </p>
            <Button 
              onClick={handleLoginRedirect}
              className="bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-bold rounded-2xl px-8 py-6 h-auto shadow-lg shadow-purple-500/20 uppercase tracking-wider"
            >
              Sign In Now
            </Button>
          </div>
        </Card>
      ) : !appId ? (
        // Guide to setup when appid is missing
        <Card className="glass border-white/10 rounded-[2rem] p-8 space-y-6">
          <div className="space-y-4 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Offerwall Configuration Needed</h3>
            <p className="text-white/60 text-sm">
              Monlix Offerwall app ID has not been configured in the environment variables yet.
            </p>
            
            <div className="text-left bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-xs text-white/80 space-y-2">
              <p className="text-purple-400 font-bold"># Cara mengaktifkan Monlix Offerwall:</p>
              <p>1. Dapatkan **App ID** dan **Secret Key** dari dashboard Monlix Publisher Anda.</p>
              <p>2. Tambahkan variabel berikut ke berkas <code className="text-cyan-400">.env.local</code> Anda:</p>
              <pre className="bg-black/60 p-3 rounded-lg mt-2 text-emerald-400">
{`NEXT_PUBLIC_MONLIX_APP_ID=your_monlix_app_id
MONLIX_SECRET_KEY=your_monlix_secret_key`}
              </pre>
              <p className="mt-2 text-white/40">3. Restart server dev Anda untuk menerapkan perubahan env.</p>
            </div>
          </div>
        </Card>
      ) : (
        // IFRAME INTEGRATION
        <div className="space-y-4">
          <div className="flex justify-between items-center px-4">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Monlix Offerwall Loaded
            </span>
            <span className="text-xs text-white/40 font-mono">User: {userId.substring(0, 8)}...</span>
          </div>
          
          <div className="glass border border-white/10 rounded-[2rem] overflow-hidden bg-black/20 shadow-2xl relative">
            <iframe 
              src={`https://offers.monlix.com/?appid=${appId}&userid=${userId}`}
              style={{ width: "100%", height: "800px", border: "none" }}
              title="Monlix Offerwall"
              className="w-full"
            />
          </div>
        </div>
      )}

      {/* FOOTER RULES */}
      <Card className="glass border-white/10 rounded-[2rem] overflow-hidden relative group">
        <div className="p-6 md:p-8 space-y-4">
          <h4 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            Aturan & Panduan Offerwalls
          </h4>
          <ul className="grid gap-3 text-xs md:text-sm text-white/60 font-medium">
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Gunakan data asli dan jujur saat mengisi survei. Jawaban asal-asalan akan mengakibatkan penolakan hadiah dari pihak Monlix.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Dilarang menggunakan VPN, Proxy, atau alat pemalsu lokasi lainnya. Pelanggaran akan berakibat pada pembekuan akun permanen.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Hadiah poin membutuhkan waktu pemrosesan dari beberapa menit hingga 24 jam tergantung jenis tugas (misalnya, instalasi game memerlukan verifikasi pencapaian level).</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Jika Anda mengalami masalah mengenai poin yang belum masuk setelah menyelesaikan tugas, silakan klik tombol bantuan/support langsung di dalam widget Monlix.</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
