"use client"

import { useState, useEffect, Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Link2, 
  Timer, 
  Coins, 
  Loader2, 
  ArrowRight,
  ExternalLink,
  Info,
  CheckCircle2,
  AlertCircle
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"

function ShortlinksContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id: userId, balance, setBalance, xp } = useStore()
  const supabase = createClient()

  // STATS STATES
  const [completedToday, setCompletedToday] = useState<number>(0)
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0) // in seconds
  const [totalEarned, setTotalEarned] = useState<number>(0)
  const [loadingStats, setLoadingStats] = useState<boolean>(true)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  // Parse callback status from query parameters
  useEffect(() => {
    if (!userId) return

    const status = searchParams.get("status")
    const reward = searchParams.get("reward")
    const message = searchParams.get("message")

    if (status === "success") {
      const rewardAmount = reward ? parseInt(reward) : 500
      toast.success(message || `Successfully completed shortlink and earned ${rewardAmount} Points!`, {
        icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      })
      // Clear URL parameters
      const url = new URL(window.location.href)
      url.searchParams.delete("status")
      url.searchParams.delete("reward")
      url.searchParams.delete("message")
      window.history.replaceState({}, "", url.pathname + url.search)
    } else if (status === "error") {
      toast.error(message || "Failed to complete shortlink.", {
        icon: <AlertCircle className="w-5 h-5 text-rose-400" />
      })
      // Clear URL parameters
      const url = new URL(window.location.href)
      url.searchParams.delete("status")
      url.searchParams.delete("reward")
      url.searchParams.delete("message")
      window.history.replaceState({}, "", url.pathname + url.search)
    }
  }, [searchParams, userId])

  // Fetch shortlink stats
  const fetchStats = async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase.rpc("get_user_shortlink_stats", {
        p_user_id: userId
      })

      if (error) {
        console.error("Error fetching shortlink stats:", error)
        return
      }

      if (data) {
        setCompletedToday(data.completed_today)
        setCooldownRemaining(data.cooldown_remaining)
        setTotalEarned(data.total_earned)
      }
    } catch (err) {
      console.error("Unexpected error fetching stats:", err)
    } finally {
      setLoadingStats(false)
    }
  }

  // Initial stats fetch & balance sync
  useEffect(() => {
    if (userId) {
      fetchStats()
    } else {
      setLoadingStats(false)
    }
  }, [userId, balance])

  // Countdown timer for cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) return

    const timer = setInterval(() => {
      setCooldownRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldownRemaining])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleVisit = async () => {
    if (!userId) {
      toast.error("Please login to visit shortlinks")
      router.push("/auth/login")
      return
    }

    if (completedToday >= 5) {
      toast.warning("Daily limit reached! Please wait 24 hours.")
      return
    }

    if (cooldownRemaining > 0) {
      toast.warning(`Please wait for the cooldown to end: ${formatTime(cooldownRemaining)}`)
      return
    }

    setIsGenerating(true)
    const promise = fetch("/api/shortlink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    })

    toast.promise(promise, {
      loading: "Generating secure shortlink...",
      success: async (response) => {
        const data = await response.json()
        if (!response.ok || data.error) {
          throw new Error(data.error || "Failed to generate link")
        }
        // Redirect user to the shortened URL
        window.location.href = data.shortenedUrl
        return "Redirecting to Shortlink..."
      },
      error: (err) => {
        setIsGenerating(false)
        return err.message || "Failed to generate shortlink"
      }
    })
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* HEADER */}
      <div className="text-center md:text-left relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest mb-4">
          <Link2 className="w-3.5 h-3.5" />
          Shortlinks Wall
        </div>
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 italic uppercase">SHORTLINKS</h2>
        <p className="text-white/60 font-medium italic">Complete shortlink challenges to claim high-reward points!</p>
      </div>

      {/* STATS CARDS */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Daily limit card */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Daily Claims Limit</span>
              <span className="text-2xl font-black font-mono text-cyan-400">
                {loadingStats ? "..." : `${completedToday} / 5`}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Link2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Cooldown Status card */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Cooldown Status</span>
              <span className={`text-2xl font-black font-mono ${cooldownRemaining > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                {loadingStats ? "..." : (cooldownRemaining > 0 ? formatTime(cooldownRemaining) : "Ready")}
              </span>
            </div>
            <div className={`p-3.5 rounded-2xl border ${cooldownRemaining > 0 ? "bg-rose-500/10 border-rose-500/20 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"}`}>
              <Timer className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Total Earned card */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Total Shortlink Earnings</span>
              <span className="text-2xl font-black font-mono text-purple-400">
                {loadingStats ? "..." : `${totalEarned} Points`}
              </span>
            </div>
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
              <Coins className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SHORTLINKS PROVIDERS SECTION */}
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="glass border-white/10 rounded-[3rem] shadow-2xl overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-2xl font-black text-white uppercase italic tracking-tight">Available Shortlinks</CardTitle>
            <CardDescription className="text-white/50 font-medium">Click Visit & Claim, pass the shortlink challenge, and get redirected back to automatically claim your rewards.</CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            {/* SHRINKME PROVIDER CARD */}
            <div className="p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-white/[0.04] transition-all group">
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-500 to-fuchsia-600 shadow-lg shadow-purple-500/10 text-white flex-shrink-0">
                  <Link2 className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white tracking-tight uppercase group-hover:text-primary transition-colors">ShrinkMe.io</span>
                    <span className="text-[9px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider">
                      High Reward
                    </span>
                  </div>
                  <p className="text-xs text-white/50 font-medium max-w-md">
                    ShrinkMe is an industry-leading high payout shortlink provider. Complete the captcha challenge to earn your points.
                  </p>
                  <div className="flex items-center gap-4 text-[10px] text-white/40 font-bold uppercase tracking-wider pt-2">
                    <span className="flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5 text-purple-400" /> Cooldown: 30 Mins
                    </span>
                    <span>•</span>
                    <span>Daily: {5 - completedToday} left</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center md:items-end gap-3 flex-shrink-0 w-full md:w-auto">
                <div className="text-center md:text-right">
                  <span className="text-xs text-white/40 font-bold uppercase block tracking-wider">Reward</span>
                  <span className="text-2xl font-black font-mono text-fuchsia-400">
                    +500 Points
                  </span>
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                    +10 XP
                  </span>
                </div>

                <Button
                  onClick={handleVisit}
                  disabled={isGenerating || completedToday >= 5 || cooldownRemaining > 0}
                  className="w-full md:w-auto rounded-2xl h-11 px-6 bg-primary hover:bg-primary/80 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : completedToday >= 5 ? (
                    "Limit Reached"
                  ) : cooldownRemaining > 0 ? (
                    `Cooldown (${formatTime(cooldownRemaining)})`
                  ) : (
                    <>
                      Visit & Claim
                      <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* AD BANNER MIDDLE */}
            <div className="w-full py-2">
              <div id="frame" style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }}>
                <iframe 
                  data-aa='2441211' 
                  src='//acceptable.a-ads.com/2441211/?size=Adaptive'
                  style={{ border: 0, padding: 0, width: '70%', height: '90px', overflow: 'hidden', display: 'block', margin: 'auto' }}
                />
              </div>
            </div>

            {/* INFO BOX */}
            <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 text-xs text-white/40 font-medium flex gap-3">
              <Info className="w-5 h-5 text-purple-400 flex-shrink-0" />
              <p>
                Untuk mencegah kecurangan, setiap link dibuat unik dan hanya dapat diklaim satu kali per kunjungan. Dilarang menggunakan VPN, proxy, atau bot otomatis saat menyelesaikan shortlink, jika terdeteksi akun Anda dapat ditangguhkan secara permanen.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function ShortlinksPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    }>
      <ShortlinksContent />
    </Suspense>
  )
}
