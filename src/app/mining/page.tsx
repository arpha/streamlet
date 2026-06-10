"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Hammer, 
  Battery, 
  BatteryCharging, 
  Trash2, 
  Coins, 
  Loader2, 
  Lock, 
  AlertCircle, 
  CheckCircle2, 
  Cpu, 
  Clock, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  Info
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useAuth } from "@/components/providers/AuthProvider"

interface Miner {
  id: string
  user_id: string
  miner_type: 'coal' | 'iron' | 'gold'
  cost: number
  created_at: string
  expires_at: string
  last_claimed_at: string
  charged_until: string
}

export default function MiningPage() {
  const { id: userId, balance, setBalance, xp } = useStore()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  // Tab State
  const [activeTab, setActiveTab] = useState<'room' | 'shop'>('room')
  
  // Data States
  const [miners, setMiners] = useState<Miner[]>([])
  const [loadingMiners, setLoadingMiners] = useState(true)
  const [tick, setTick] = useState(0)

  // Action States
  const [buyingType, setBuyingType] = useState<string | null>(null)
  const [claimingId, setClaimingId] = useState<string | null>(null)
  const [rechargingId, setRechargingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  // Fetch miners list
  const fetchMiners = async () => {
    if (!userId) return
    try {
      // 1. Run check helper first to process demotions
      await supabase.rpc("check_and_update_inactive_miners", { p_user_id: userId })

      // 2. Fetch updated miners list
      const { data, error } = await supabase
        .from("user_miners")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setMiners(data || [])
    } catch (err) {
      console.error("Failed to load miners:", err)
    } finally {
      setLoadingMiners(false)
    }
  }

  useEffect(() => {
    if (userId) {
      fetchMiners()
    }
  }, [userId])

  // Real-time tick effect (runs every second to update points and progress bars)
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(prev => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Helper: Get multiplier based on XP
  const getMultiplier = (userXp: number): number => {
    if (userXp < 1000) return 1.00
    if (userXp < 10000) return 1.03 // Silver
    if (userXp < 100000) return 1.06 // Gold
    if (userXp < 1000000) return 1.10 // Platinum
    return 1.15 // Diamond
  }

  const getRankName = (userXp: number): string => {
    if (userXp < 0) return "Mud"
    if (userXp < 1000) return "Bronze"
    if (userXp < 10000) return "Silver"
    if (userXp < 100000) return "Gold"
    if (userXp < 1000000) return "Platinum"
    return "Diamond"
  }

  const getRankColor = (userXp: number): string => {
    if (userXp < 1000) return "text-zinc-400"
    if (userXp < 10000) return "text-slate-300"
    if (userXp < 100000) return "text-amber-400"
    if (userXp < 1000000) return "text-cyan-400"
    return "text-fuchsia-400"
  }

  // SHOP CONFIG
  const SHOP_ITEMS = [
    {
      type: "coal" as const,
      name: "Coal Miner",
      cost: 5000,
      description: "Low-cost coal miner. Ideal for beginners wanting to try passive investments.",
      colorClass: "from-zinc-700 to-zinc-900 border-zinc-600/30 text-zinc-300",
      glowClass: "shadow-zinc-500/5",
      iconColor: "text-zinc-400"
    },
    {
      type: "iron" as const,
      name: "Iron Miner",
      cost: 50000,
      description: "Mid-tier iron miner. Earns stable passive points with optimal performance.",
      colorClass: "from-slate-600 to-slate-800 border-slate-500/30 text-slate-200",
      glowClass: "shadow-slate-400/5",
      iconColor: "text-slate-300"
    },
    {
      type: "gold" as const,
      name: "Gold Miner",
      cost: 500000,
      description: "Elite high-speed gold miner. Delivers maximum passive point returns for experienced players.",
      colorClass: "from-amber-600/40 to-amber-900/40 border-amber-500/30 text-amber-100",
      glowClass: "shadow-amber-500/10",
      iconColor: "text-amber-400"
    }
  ]

  // Handlers
  const handleBuyMiner = async (type: string) => {
    if (xp < 1000) {
      import("sonner").then(m => m.toast.error("Only Silver rank or higher can purchase miners!"))
      return
    }

    setBuyingType(type)
    const { toast } = await import("sonner")

    try {
      const { data, error } = await supabase.rpc("purchase_miner", { p_miner_type: type })
      if (error) throw error

      const res = data as { success: boolean; message: string; new_balance?: number }
      if (!res.success) {
        toast.error(res.message)
      } else {
        toast.success(res.message, { icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> })
        if (res.new_balance !== undefined) setBalance(res.new_balance)
        fetchMiners()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to purchase miner.")
    } finally {
      setBuyingType(null)
    }
  }

  const handleClaim = async (id: string) => {
    setClaimingId(id)
    const { toast } = await import("sonner")

    try {
      const { data, error } = await supabase.rpc("claim_miner_rewards", { p_miner_id: id })
      if (error) throw error

      const res = data as { success: boolean; message: string; new_balance?: number }
      if (!res.success) {
        toast.error(res.message)
      } else {
        toast.success(res.message, { icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" /> })
        if (res.new_balance !== undefined) setBalance(res.new_balance)
        fetchMiners()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to claim mined rewards.")
    } finally {
      setClaimingId(null)
    }
  }

  const handleRecharge = async (id: string) => {
    setRechargingId(id)
    const { toast } = await import("sonner")

    try {
      const { data, error } = await supabase.rpc("recharge_miner", { p_miner_id: id })
      if (error) throw error

      const res = data as { success: boolean; message: string }
      if (!res.success) {
        toast.error(res.message)
      } else {
        toast.success(res.message, { icon: <BatteryCharging className="w-5 h-5 text-emerald-400 animate-bounce" /> })
        fetchMiners()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to recharge battery.")
    } finally {
      setRechargingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const { toast } = await import("sonner")

    try {
      const { data, error } = await supabase.rpc("delete_expired_miner", { p_miner_id: id })
      if (error) throw error

      const res = data as { success: boolean; message: string }
      if (!res.success) {
        toast.error(res.message)
      } else {
        toast.success(res.message, { icon: <Trash2 className="w-5 h-5 text-rose-400" /> })
        fetchMiners()
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to discard miner.")
    } finally {
      setDeletingId(null)
    }
  }

  const userMultiplier = getMultiplier(xp)
  const userRankName = getRankName(xp)
  const isRankLow = xp < 1000

  if (authLoading || !user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">Verifying session...</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 text-white min-h-screen">
      {/* HEADER WITH META */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest">
            <Hammer className="w-3.5 h-3.5" />
            VIRTUAL MINER GAME
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase">MINING ROOM</h2>
          <p className="text-white/60 font-medium italic">
            Purchase virtual miners, keep their batteries charged, and earn passive points every hour!
          </p>
        </div>

        {/* Current Multiplier Status Card */}
        <Card className="glass border-white/10 rounded-2xl p-4 flex items-center gap-4 bg-purple-950/10 min-w-[200px]">
          <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Cpu className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-black text-white/40 uppercase tracking-wider block">Rank Multiplier</span>
            <span className={`text-base font-black uppercase ${getRankColor(xp)}`}>
              {userRankName} ({isRankLow ? "0%" : `+${Math.round((userMultiplier - 1) * 100)}%`})
            </span>
          </div>
        </Card>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex justify-center">
        <div className="inline-flex p-1.5 bg-white/[0.02] border border-white/5 rounded-2xl gap-2">
          <button
            onClick={() => setActiveTab('room')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              activeTab === 'room'
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Hammer className="w-4 h-4" />
            Mining Room ({miners.length})
          </button>
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              activeTab === 'shop'
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Coins className="w-4 h-4" />
            Miner Shop
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <AnimatePresence mode="wait">
        {activeTab === 'room' ? (
          <motion.div
            key="room-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {loadingMiners ? (
              <div className="flex flex-col items-center justify-center p-20 text-white/40 gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                <span className="text-xs uppercase tracking-widest font-black">Loading your active rack...</span>
              </div>
            ) : miners.length === 0 ? (
              <div className="glass border-white/10 rounded-[2.5rem] p-20 text-center flex flex-col items-center justify-center">
                <Hammer className="w-16 h-16 text-white/10 mb-4 animate-bounce" />
                <h4 className="text-lg font-black uppercase text-white/60">Your Mining Rack is Empty</h4>
                <p className="text-white/40 text-sm mt-1 max-w-sm mb-6">
                  You don't have any active miners. Visit the Miner Shop to buy your first miner!
                </p>
                <Button 
                  onClick={() => setActiveTab('shop')}
                  className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-purple-600/20 px-6 py-3 h-auto"
                >
                  Buy First Miner <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {miners.map(miner => {
                  const now = new Date()
                  const expires = new Date(miner.expires_at)
                  const chargedUntil = new Date(miner.charged_until)
                  const lastClaimed = new Date(miner.last_claimed_at)

                  // Status determination
                  let status: 'mining' | 'charge_needed' | 'expired' | 'paused_rank' = 'mining'
                  if (isRankLow) {
                    status = 'paused_rank'
                  } else if (now.getTime() >= expires.getTime()) {
                    status = 'expired'
                  } else if (now.getTime() >= chargedUntil.getTime()) {
                    status = 'charge_needed'
                  }

                  // Battery calculation
                  const totalBatteryDuration = 24 * 60 * 60 * 1000 // 24 hours in ms
                  const batteryLeftMs = Math.max(0, chargedUntil.getTime() - now.getTime())
                  const batteryPercentage = Math.min(100, (batteryLeftMs / totalBatteryDuration) * 100)

                  // Days remaining
                  const daysLeftMs = Math.max(0, expires.getTime() - now.getTime())
                  const daysLeft = Math.ceil(daysLeftMs / (24 * 60 * 60 * 1000))

                  // Dynamic points calculation
                  let pendingPoints = 0
                  if (status !== 'expired' && status !== 'paused_rank') {
                    const endTime = new Date(Math.min(now.getTime(), expires.getTime(), chargedUntil.getTime()))
                    if (endTime.getTime() > lastClaimed.getTime()) {
                      const activeSeconds = (endTime.getTime() - lastClaimed.getTime()) / 1000
                      const totalReturn = miner.cost * userMultiplier
                      const hourlyRate = totalReturn / 720.0
                      pendingPoints = (activeSeconds / 3600.0) * hourlyRate
                    }
                  }

                  // UI theme mapping
                  let cardGlow = "shadow-emerald-500/5 border-emerald-500/20"
                  let statusBadge = <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Mining 🟢</span>
                  
                  if (status === 'paused_rank') {
                    cardGlow = "shadow-rose-500/5 border-rose-500/20 bg-rose-950/5"
                    statusBadge = <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">Paused (Rank Low) 🔴</span>
                  } else if (status === 'expired') {
                    cardGlow = "shadow-zinc-500/5 border-zinc-500/20 bg-zinc-950/20"
                    statusBadge = <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">Expired 💀</span>
                  } else if (status === 'charge_needed') {
                    cardGlow = "shadow-amber-500/5 border-amber-500/20 bg-amber-950/5"
                    statusBadge = <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">Low Battery 🔴</span>
                  }

                  const isExpired = status === 'expired'
                  const isActionDisabled = claimingId === miner.id || rechargingId === miner.id || deletingId === miner.id

                  return (
                    <Card key={miner.id} className={`glass rounded-[2rem] shadow-xl overflow-hidden relative group transition-all duration-300 hover:-translate-y-1 ${cardGlow}`}>
                      <CardHeader className="p-6 border-b border-white/5 bg-white/[0.01] flex flex-row items-center justify-between">
                        <div>
                          <CardTitle className="text-base font-black uppercase tracking-wider flex items-center gap-1.5">
                            <Cpu className="w-4 h-4 text-purple-400" />
                            {miner.miner_type === 'coal' ? 'Coal Miner' : miner.miner_type === 'iron' ? 'Iron Miner' : 'Gold Miner'}
                          </CardTitle>
                          <span className="text-[10px] text-white/40 font-mono mt-0.5 block uppercase">Cost: {miner.cost.toLocaleString()} Points</span>
                        </div>
                        {statusBadge}
                      </CardHeader>

                      <CardContent className="p-6 space-y-6">
                        {/* Progress and status details */}
                        <div className="space-y-4">
                          {/* Battery indicator */}
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-white/40 font-bold uppercase tracking-wider flex items-center gap-1">
                                <Battery className="w-3.5 h-3.5" />
                                Battery (24 Hours)
                              </span>
                              <span className="font-bold font-mono text-white/80">
                                {status === 'expired' ? '0%' : `${Math.round(batteryPercentage)}%`}
                              </span>
                            </div>
                            <div className="w-full h-2 bg-white/[0.03] border border-white/5 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-1000 ${
                                  status === 'mining' ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-rose-500'
                                }`}
                                style={{ width: `${status === 'expired' ? 0 : batteryPercentage}%` }}
                              />
                            </div>
                          </div>

                          {/* Expiration and multiplier metadata */}
                          <div className="grid grid-cols-2 gap-4 text-xs">
                            <div className="bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
                              <span className="text-[9px] text-white/35 font-bold uppercase tracking-wider block">Contract Duration</span>
                              <span className="font-black text-white/80 font-mono mt-0.5 block">
                                {isExpired ? 'Expired' : `${daysLeft} Days Left`}
                              </span>
                            </div>
                            <div className="bg-white/[0.01] border border-white/5 p-3 rounded-2xl">
                              <span className="text-[9px] text-white/35 font-bold uppercase tracking-wider block">Multiplier</span>
                              <span className="font-black text-white/80 font-mono mt-0.5 block">
                                {status === 'paused_rank' ? '0.00x (Lock)' : `${userMultiplier.toFixed(2)}x`}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Live pending payout display */}
                        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center py-5 relative overflow-hidden bg-gradient-to-b from-purple-950/5 to-transparent">
                          <span className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-1.5">Accumulated Mined Rewards</span>
                          <span className="text-2xl font-black font-mono text-emerald-400 tracking-tight neon-text animate-pulse">
                            {pendingPoints.toFixed(4)}
                          </span>
                          <span className="text-[9px] text-white/40 uppercase font-black tracking-widest mt-1">Points</span>
                        </div>

                        {/* Action buttons based on status */}
                        <div className="flex gap-2">
                          {isExpired ? (
                            <Button
                              onClick={() => handleDelete(miner.id)}
                              disabled={isActionDisabled}
                              variant="destructive"
                              className="w-full rounded-2xl py-5 h-auto text-xs font-black uppercase tracking-widest gap-2 bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-500/10 border-0"
                            >
                              {deletingId === miner.id ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Discarding...
                                </>
                              ) : (
                                <>
                                  <Trash2 className="w-4 h-4" />
                                  Discard Miner (Trash)
                                </>
                              )}
                            </Button>
                          ) : (
                            <>
                              <Button
                                onClick={() => handleClaim(miner.id)}
                                disabled={isActionDisabled || pendingPoints <= 0 || status === 'paused_rank'}
                                variant="outline"
                                className="w-1/2 rounded-2xl py-5 h-auto text-xs font-black uppercase tracking-widest border-white/10 hover:bg-white/10"
                              >
                                {claimingId === miner.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                ) : (
                                  'Claim Points'
                                )}
                              </Button>
                              <Button
                                onClick={() => handleRecharge(miner.id)}
                                disabled={isActionDisabled || status === 'paused_rank'}
                                className="w-1/2 rounded-2xl py-5 h-auto text-xs font-black uppercase tracking-widest bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-600/20 border-0 gap-1.5"
                              >
                                {rechargingId === miner.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <BatteryCharging className="w-4 h-4" />
                                    Recharge
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="shop-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Warning block if rank is too low */}
            {isRankLow && (
              <div className="glass border-rose-500/30 rounded-3xl p-6 flex flex-col md:flex-row items-center gap-4 bg-rose-500/5 shadow-2xl relative overflow-hidden">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 flex-shrink-0">
                  <Lock className="w-6 h-6 animate-bounce" />
                </div>
                <div>
                  <h4 className="text-base font-black text-rose-400 uppercase tracking-wide">Miner Shop Locked</h4>
                  <p className="text-white/60 text-sm mt-0.5">
                    Only players with **Silver Rank** (XP &gt;= 1,000) or higher are allowed to purchase miners. Earn XP from Faucets and Shortlinks to rank up.
                  </p>
                </div>
              </div>
            )}

            {/* SHOP ITEMS GRID */}
            <div className="grid gap-8 md:grid-cols-3">
              {SHOP_ITEMS.map((item) => {
                const estTotalReturn = item.cost * userMultiplier
                const estHourlyRate = estTotalReturn / 720.0
                const isAffordable = balance >= item.cost
                const isButtonDisabled = isRankLow || !isAffordable || buyingType !== null

                return (
                  <Card 
                    key={item.type} 
                    className={`glass border-white/10 rounded-[2.5rem] overflow-hidden relative flex flex-col justify-between shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-gradient-to-b ${item.colorClass} ${item.glowClass}`}
                  >
                    <CardHeader className="p-8 border-b border-white/5 bg-white/[0.01]">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-2xl font-black uppercase italic tracking-wider">
                            {item.name}
                          </CardTitle>
                          <CardDescription className="text-white/40 mt-1 uppercase text-[10px] font-black tracking-widest font-mono">
                            30-Day Contract (720h)
                          </CardDescription>
                        </div>
                        <div className={`p-3 rounded-2xl bg-white/5 border border-white/10 ${item.iconColor}`}>
                          <Hammer className="w-6 h-6" />
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="p-8 space-y-6 flex-grow flex flex-col justify-between">
                      <p className="text-white/60 text-xs font-semibold leading-relaxed">
                        {item.description}
                      </p>

                      {/* Yield Info Box */}
                      <div className="space-y-3 p-4 rounded-3xl bg-white/5 border border-white/10">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-white/40 font-bold uppercase tracking-wider">Cost</span>
                          <span className="font-black text-white font-mono">{item.cost.toLocaleString()} Points</span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                          <span className="text-white/40 font-bold uppercase tracking-wider">Rank Profit Bonus</span>
                          <span className={`font-black font-mono ${getRankColor(xp)}`}>
                            {isRankLow ? "0%" : `+${Math.round((userMultiplier - 1) * 100)}%`}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                          <span className="text-white/40 font-bold uppercase tracking-wider">Est. Total Yield</span>
                          <span className="font-black text-emerald-400 font-mono">
                            {isRankLow ? item.cost.toLocaleString() : estTotalReturn.toLocaleString()} Points
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                          <span className="text-white/40 font-bold uppercase tracking-wider">Est. Hourly Yield</span>
                          <span className="font-black text-purple-400 font-mono">
                            {estHourlyRate.toFixed(2)} Points/hour
                          </span>
                        </div>
                      </div>

                      <Button
                        onClick={() => handleBuyMiner(item.type)}
                        disabled={isButtonDisabled}
                        className={`w-full rounded-2xl py-5 h-auto text-xs font-black uppercase tracking-widest border-0 transition-all ${
                          !isAffordable && !isRankLow
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/10"
                            : "bg-white hover:bg-white/90 text-slate-950 shadow-lg shadow-white/10"
                        }`}
                      >
                        {buyingType === item.type ? (
                          <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        ) : isRankLow ? (
                          'Rank Too Low'
                        ) : !isAffordable ? (
                          'Insufficient Points'
                        ) : (
                          'Buy Miner Now'
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GAME GUIDE & GENERAL INFO CARD */}
      <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden mt-10">
        <CardHeader className="p-6 md:p-8 border-b border-white/5 bg-white/[0.01]">
          <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
            <Info className="w-5 h-5 text-purple-400" />
            VIRTUAL MINER GAME GUIDE
          </CardTitle>
          <CardDescription className="text-white/40 font-medium italic">
            How to play and terms of operation for the virtual crypto mining system.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 md:p-8 grid md:grid-cols-3 gap-6 text-xs text-white/60">
          <div className="space-y-2">
            <h5 className="font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-mono">1</span>
              30-Day Contract
            </h5>
            <p className="leading-relaxed pl-6">
              Each miner operates for exactly 30 days. Once expired, it must be discarded to empty the rack. Remaining unclaimed rewards are automatically claimed upon discarding.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-mono">2</span>
              Daily Recharge Required
            </h5>
            <p className="leading-relaxed pl-6">
              Miner batteries last for 24 hours. You must recharge them daily in the Mining Room. If the battery dies, mining pauses and no rewards are generated during the offline period.
            </p>
          </div>
          <div className="space-y-2">
            <h5 className="font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-mono">3</span>
              Rank Demotion Pause
            </h5>
            <p className="leading-relaxed pl-6">
              If your XP falls below 1,000 (demoting to Mud/Bronze), your miners will be paused. Mined progress during this low-rank status will be reset. Keep active on faucets to secure your rank!
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
