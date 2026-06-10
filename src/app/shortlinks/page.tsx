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
  AlertCircle,
  Play
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { useRouter, useSearchParams } from "next/navigation"
import { motion } from "framer-motion"
import { AdBlockDetector } from "@/components/shared/AdBlockDetector"
import { AntiAdBlockModal } from "@/components/shared/AntiAdBlockModal"
import { getDeviceFingerprint } from "@/lib/fingerprint"
import Script from "next/script"


function ShortlinksContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { id: userId, balance, setBalance, xp } = useStore()
  const supabase = createClient()

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  // STATS STATES
  const [completedToday, setCompletedToday] = useState<number>(0)
  const [completedShrinkme, setCompletedShrinkme] = useState<number>(0)
  const [completedExeio, setCompletedExeio] = useState<number>(0)
  const [completedFclc, setCompletedFclc] = useState<number>(0)
  const [completedCuty, setCompletedCuty] = useState<number>(0)
  const [cooldownExeio, setCooldownExeio] = useState<number>(0)
  const [cooldownFclc, setCooldownFclc] = useState<number>(0)
  const cooldownRemaining = Math.max(cooldownExeio, cooldownFclc)
  const [totalEarned, setTotalEarned] = useState<number>(0)
  const [loadingStats, setLoadingStats] = useState<boolean>(true)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [adBlockActive, setAdBlockActive] = useState<boolean>(false)

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
        setCompletedShrinkme(data.completed_shrinkme || 0)
        setCompletedExeio(data.completed_exeio || 0)
        setCompletedFclc(data.completed_fclc || 0)
        setCompletedCuty(data.completed_cuty || 0)
        setCooldownExeio(data.cooldown_exeio || 0)
        setCooldownFclc(data.cooldown_fclc || 0)
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

  // Countdown timer for cooldowns
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownExeio(prev => (prev > 0 ? prev - 1 : 0))
      setCooldownFclc(prev => (prev > 0 ? prev - 1 : 0))
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getAdjustedPoints = (basePoints: number) => {
    if (xp < 0) return Math.floor(basePoints * 0.5)
    if (xp >= 1000000) return basePoints + Math.ceil(basePoints * 0.15) // Diamond (+15%)
    if (xp >= 100000) return basePoints + Math.ceil(basePoints * 0.10)  // Platinum (+10%)
    if (xp >= 10000) return basePoints + Math.ceil(basePoints * 0.06)   // Gold (+6%)
    if (xp >= 1000) return basePoints + Math.ceil(basePoints * 0.03)    // Silver (+3%)
    return basePoints
  }

  const providers = [
    {
      id: "shrinkme",
      name: "ShrinkMe.io",
      tag: "High Reward",
      description: "ShrinkMe is an industry-leading high payout shortlink provider. Complete the captcha challenge to earn your points.",
      cooldown: "30 Mins",
      points: getAdjustedPoints(250),
      gradient: "from-purple-500 to-fuchsia-600",
      limit: 1,
      completed: completedShrinkme,
      cooldownRemaining: 0,
      tagColor: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
      tutorialUrl: "https://www.youtube.com/watch?v=dQLbvJaJyxw"
    },
    {
      id: "exeio",
      name: "Exe.io",
      tag: "Easy Claim",
      description: "Exe.io is a popular high-paying shortlink network. Complete the short captcha step to claim your reward points.",
      cooldown: "30 Mins",
      points: getAdjustedPoints(100),
      gradient: "from-blue-500 to-cyan-600",
      limit: 2,
      completed: completedExeio,
      cooldownRemaining: cooldownExeio,
      tagColor: "bg-purple-500/10 text-purple-400 border border-purple-500/20",
      tutorialUrl: "https://youtu.be/2X0BG5q7ILE"
    },
    {
      id: "fclc",
      name: "FC.LC",
      tag: "Fast & Clean",
      description: "FC.LC is a fast and simple shortlink service with a high payout rate. Complete the quick steps to receive your reward.",
      cooldown: "30 Mins",
      points: getAdjustedPoints(100),
      gradient: "from-emerald-500 to-teal-600",
      limit: 2,
      completed: completedFclc,
      cooldownRemaining: cooldownFclc,
      tagColor: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
      tutorialUrl: "https://youtu.be/XeuR1v7oCgQ?si=Pd-dD6QVNySmmL7p"
    },
    {
      id: "cuty",
      name: "Cuty.io",
      tag: "Hot Reward",
      description: "Cuty.io is a fast and secure shortlink service. Complete the verification steps to claim your reward points.",
      cooldown: "30 Mins",
      points: getAdjustedPoints(200),
      gradient: "from-orange-500 to-amber-600",
      limit: 1,
      completed: completedCuty,
      cooldownRemaining: 0,
      tagColor: "bg-orange-500/10 text-orange-400 border border-orange-500/20"
    }
  ]

  const handleVisit = async (provider: string) => {
    if (adBlockActive) {
      toast.error("Please disable your ad blocker to visit shortlinks.")
      return
    }

    if (!userId) {
      toast.error("Please login to visit shortlinks")
      router.push("/auth/login")
      return
    }

    const providerLimit = provider === "shrinkme" ? 1 : (provider === "exeio" ? 2 : (provider === "fclc" ? 2 : 1))
    const providerCompleted = provider === "shrinkme" ? completedShrinkme : (provider === "exeio" ? completedExeio : (provider === "fclc" ? completedFclc : completedCuty))
    const providerCooldown = provider === "exeio" ? cooldownExeio : (provider === "fclc" ? cooldownFclc : 0)

    if (providerCompleted >= providerLimit) {
      toast.warning(`Daily limit reached for this shortlink! Reset at 07:00 AM GMT+7.`)
      return
    }

    if (providerCooldown > 0) {
      toast.warning(`Please wait for the cooldown to end: ${formatTime(providerCooldown)}`)
      return
    }

    setIsGenerating(true)
    const promise = fetch("/api/shortlink", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        provider,
        fingerprint: getDeviceFingerprint()
      })
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

  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* ADBLOCK DETECTOR */}
      <AdBlockDetector onDetect={setAdBlockActive} />
      {adBlockActive && <AntiAdBlockModal />}

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
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Completed Today</span>
              <span className="text-2xl font-black font-mono text-cyan-400">
                {loadingStats ? "..." : `${completedToday} Claims`}
              </span>
              <span className="text-[9px] text-white/35 font-bold block mt-0.5">
                Resets daily at 07:00 AM WIB (00:00 UTC)
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
        {/* Mud Rank Warning Banner */}
        {xp < 0 && (
          <Card className="glass border-amber-500/20 rounded-[2.5rem] shadow-xl overflow-hidden relative bg-amber-500/10 p-6 flex gap-4 items-start text-left">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 mt-0.5">
              <AlertCircle className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-400 uppercase tracking-wider">Rank Mud Penalty Active (-50% Reward)</h4>
              <p className="text-xs text-white/70 font-bold mt-1.5 leading-relaxed">
                You haven't claimed faucet or shortlinks in the last 24 hours. Your rewards are reduced by 50% until your XP is restored above 0. Complete claims to regain XP!
              </p>
            </div>
          </Card>
        )}

        <Card className="glass border-white/10 rounded-[3rem] shadow-2xl overflow-hidden">
          <CardHeader className="p-8 pb-4">
            <CardTitle className="text-2xl font-black text-white uppercase italic tracking-tight">Available Shortlinks</CardTitle>
            <CardDescription className="text-white/50 font-medium">
              Click Visit & Claim, pass the shortlink challenge, and get redirected back to automatically claim your rewards. 
              Daily limit resets at <strong className="text-cyan-400">07:00 AM WIB (00:00 UTC)</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6 animate-none">
            {providers.map((p, idx) => (
              <div key={p.id} className="space-y-6">
                <div className="p-6 rounded-[2.5rem] bg-white/[0.02] border border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 hover:bg-white/[0.04] transition-all group">
                  <div className="flex items-start gap-4 flex-1">
                    <div className={`p-3.5 rounded-2xl bg-gradient-to-br ${p.gradient} shadow-lg shadow-purple-500/10 text-white flex-shrink-0`}>
                      <Link2 className="w-6 h-6" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-white tracking-tight uppercase group-hover:text-primary transition-colors">{p.name}</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-lg font-bold uppercase tracking-wider ${p.tagColor}`}>
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-xs text-white/50 font-medium max-w-md">
                        {p.description}
                      </p>
                      <div className="flex items-center gap-4 text-[10px] text-white/40 font-bold uppercase tracking-wider pt-2">
                        <span className="flex items-center gap-1">
                          <Timer className="w-3.5 h-3.5 text-purple-400" /> Cooldown: {p.cooldown}
                        </span>
                        <span>•</span>
                        <span>Daily: {p.limit - p.completed} left</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center md:items-end gap-3 flex-shrink-0 w-full md:w-auto">
                    <div className="text-center md:text-right">
                      <span className="text-xs text-white/40 font-bold uppercase block tracking-wider">Reward</span>
                      <span className="text-2xl font-black font-mono text-fuchsia-400">
                        +{p.points} Points
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                      {p.tutorialUrl && (
                        <a
                          href={p.tutorialUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full sm:w-auto"
                        >
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full sm:w-auto rounded-2xl h-11 px-4 border-fuchsia-500/30 hover:border-fuchsia-500/60 bg-fuchsia-500/5 hover:bg-fuchsia-500/10 text-fuchsia-400 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Play className="w-3.5 h-3.5 fill-fuchsia-400/20" /> Tutorial
                          </Button>
                        </a>
                      )}
                      <Button
                        onClick={() => handleVisit(p.id)}
                        disabled={isGenerating || p.completed >= p.limit || p.cooldownRemaining > 0}
                        className="w-full md:w-auto rounded-2xl h-11 px-6 bg-primary hover:bg-primary/80 font-black uppercase text-xs tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-primary/20 flex-1"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Generating...
                          </>
                        ) : p.completed >= p.limit ? (
                          "Limit Reached"
                        ) : p.cooldownRemaining > 0 ? (
                          `Cooldown (${formatTime(p.cooldownRemaining)})`
                        ) : (
                          <>
                            Visit & Claim
                            <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

              </div>
            ))}

            {/* INFO BOX */}
            <div className="p-4 rounded-2xl bg-white/[0.01] border border-white/5 text-xs text-white/40 font-medium flex gap-3">
              <Info className="w-5 h-5 text-purple-400 flex-shrink-0" />
              <p>
                To prevent fraud, each link is generated uniquely and can only be claimed once per visit. Using VPNs, proxies, or automated bots when completing shortlinks is strictly prohibited; if detected, your account may be permanently suspended.
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
