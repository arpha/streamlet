"use client"

import { useState, useEffect, Suspense } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Coins, Clock, Users, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, Loader2, MousePointer2, Shield, Crown, Award, Gem, Link2, Info, X, Gamepad2, CheckCircle2, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useStore } from "@/store/useStore"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/providers/AuthProvider"
import { LandingPage } from "@/components/landing/LandingPage"
import { createClient } from "@/lib/supabase"
import { formatDistanceToNow } from 'date-fns'
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
}

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
}

// Level System Definition
const LEVELS = [
  { name: 'Mud',      minXp: -500,    maxXp: 0,       color: 'from-amber-950 to-amber-850',   textColor: 'text-amber-600',   borderColor: 'border-amber-900/30',  bgColor: 'bg-amber-900',   icon: Shield },
  { name: 'Bronze',   minXp: 0,       maxXp: 1000,    color: 'from-amber-700 to-amber-500',   textColor: 'text-amber-400',   borderColor: 'border-amber-500/30',  bgColor: 'bg-amber-500',   icon: Shield },
  { name: 'Silver',   minXp: 1000,    maxXp: 10000,   color: 'from-slate-400 to-slate-300',    textColor: 'text-slate-300',   borderColor: 'border-slate-400/30',  bgColor: 'bg-slate-400',   icon: Award },
  { name: 'Platinum', minXp: 10000,   maxXp: 100000,  color: 'from-indigo-300 to-slate-200',   textColor: 'text-indigo-200',  borderColor: 'border-indigo-300/30', bgColor: 'bg-indigo-300',  icon: Crown },
  { name: 'Diamond',  minXp: 100000,  maxXp: 1000000, color: 'from-cyan-400 to-blue-500',      textColor: 'text-cyan-300',    borderColor: 'border-cyan-400/30',   bgColor: 'bg-cyan-400',    icon: Gem },
]

function getLevelInfo(xp: number) {
  const cappedXp = Math.max(xp, -500)
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (cappedXp >= LEVELS[i].minXp) {
      const level = LEVELS[i]
      const progress = Math.min(((cappedXp - level.minXp) / (level.maxXp - level.minXp)) * 100, 100)
      const nextLevel = i < LEVELS.length - 1 ? LEVELS[i + 1] : null
      return { ...level, progress, xp: cappedXp, nextLevel }
    }
  }
  return { ...LEVELS[0], progress: 0, xp: cappedXp, nextLevel: LEVELS[1] }
}

function HomeContent() {
  const { balance, username, id: userId, xp, lastDecayCheckedAt } = useStore()
  const { user, loading } = useAuth()
  const supabase = createClient()
  const searchParams = useSearchParams()
  
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [leaderboardRanks, setLeaderboardRanks] = useState<{
    shortlink_rank: number | null;
    faucet_rank: number | null;
    referral_rank: number | null;
    shortlink_points: number;
    faucet_points: number;
    referral_count: number;
  } | null>(null)

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
  
  const [statsData, setStatsData] = useState({
    totalClaims: 0,
    referrals: 0,
    activeToday: 0,
    totalEarned: 0
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [blogCards, setBlogCards] = useState<any[]>([])
  const [weeklyEarnings, setWeeklyEarnings] = useState<any[]>([
    { name: 'Mon', points: 0, heightPercent: 5 },
    { name: 'Tue', points: 0, heightPercent: 5 },
    { name: 'Wed', points: 0, heightPercent: 5 },
    { name: 'Thu', points: 0, heightPercent: 5 },
    { name: 'Fri', points: 0, heightPercent: 5 },
    { name: 'Sat', points: 0, heightPercent: 5 },
    { name: 'Sun', points: 0, heightPercent: 5 },
  ])

  const [decayTimeLeft, setDecayTimeLeft] = useState<number>(0)

  useEffect(() => {
    if (!lastDecayCheckedAt) {
      setDecayTimeLeft(86400)
      return
    }

    const intervalId = setInterval(() => {
      const lastCheckTime = new Date(lastDecayCheckedAt).getTime()
      const deadline = lastCheckTime + 24 * 60 * 60 * 1000
      const now = Date.now()
      const diff = Math.max(0, Math.floor((deadline - now) / 1000))
      setDecayTimeLeft(diff)
    }, 1000)

    // Run once immediately
    const lastCheckTime = new Date(lastDecayCheckedAt).getTime()
    const deadline = lastCheckTime + 24 * 60 * 60 * 1000
    const now = Date.now()
    const diff = Math.max(0, Math.floor((deadline - now) / 1000))
    setDecayTimeLeft(diff)

    return () => clearInterval(intervalId)
  }, [lastDecayCheckedAt])

  const formatDecayTime = (seconds: number) => {
    if (seconds <= 0) return "Overdue (Decay Active)"
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours}h ${minutes}m ${secs}s`
  }

  // Fetch real-time stats and activity from database
  useEffect(() => {
    async function fetchDashboardData() {
      if (!userId) return

      try {
        // 1. Fetch Faucet claims
        const { count: faucetCount } = await supabase
          .from('faucet_claims')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)

        const { data: faucetData } = await supabase
          .from('faucet_claims')
          .select('amount')
          .eq('user_id', userId)
        
        const faucetTotal = faucetData?.reduce((acc, curr) => acc + Number(curr.amount), 0) || 0

        // 2. Fetch Shortlink claims
        const { count: shortlinkCount } = await supabase
          .from('shortlink_claims')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completed')

        const { data: shortlinkData } = await supabase
          .from('shortlink_claims')
          .select('points_reward')
          .eq('user_id', userId)
          .eq('status', 'completed')
        
        const shortlinkTotal = shortlinkData?.reduce((acc, curr) => acc + Number(curr.points_reward), 0) || 0

        // 2b. Fetch Offerwall claims
        const { count: offerwallCount } = await supabase
          .from('offerwall_claims')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('status', 'completed')

        const { data: offerwallData } = await supabase
          .from('offerwall_claims')
          .select('points_reward')
          .eq('user_id', userId)
          .eq('status', 'completed')
        
        const offerwallTotal = offerwallData?.reduce((acc, curr) => acc + Number(curr.points_reward), 0) || 0

        // 3. Fetch Referral statistics
        const { data: refStats } = await supabase.rpc('get_referral_stats', {
          p_user_id: userId,
        })

        const referralCount = refStats?.total_referrals || 0
        const referralCommissions = refStats?.total_commissions || 0

        // 4. Fetch recent faucet claims
        const { data: recentClaims } = await supabase
          .from('faucet_claims')
          .select('*')
          .eq('user_id', userId)
          .order('claimed_at', { ascending: false })
          .limit(5)

        // 5. Fetch recent shortlink claims
        const { data: recentShortlinks } = await supabase
          .from('shortlink_claims')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('completed_at', { ascending: false })
          .limit(5)

        // 5b. Fetch recent offerwall claims
        const { data: recentOfferwalls } = await supabase
          .from('offerwall_claims')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'completed')
          .order('created_at', { ascending: false })
          .limit(5)

        setStatsData({
          totalClaims: (faucetCount || 0) + (shortlinkCount || 0) + (offerwallCount || 0),
          referrals: referralCount,
          activeToday: refStats?.active_today || 0,
          totalEarned: faucetTotal + shortlinkTotal + offerwallTotal + referralCommissions
        })

        const activities: any[] = []

        if (recentClaims) {
          recentClaims.forEach(claim => {
            activities.push({
              type: 'Faucet Claim',
              amount: `+${Number(claim.amount)} Points`,
              time: formatDistanceToNow(new Date(claim.claimed_at), { addSuffix: true }),
              date: new Date(claim.claimed_at),
              icon: Coins,
              color: 'text-purple-400'
            })
          })
        }

        if (recentShortlinks) {
          recentShortlinks.forEach(sl => {
            activities.push({
              type: `Shortlink (${sl.provider === 'shrinkme' ? 'ShrinkMe' : sl.provider})`,
              amount: `+${Number(sl.points_reward)} Points`,
              time: formatDistanceToNow(new Date(sl.completed_at), { addSuffix: true }),
              date: new Date(sl.completed_at),
              icon: Link2,
              color: 'text-cyan-400'
            })
          })
        }

        if (recentOfferwalls) {
          recentOfferwalls.forEach(ow => {
            activities.push({
              type: `Offerwall (${ow.provider === 'bitcotasks' ? 'BitcoTasks' : ow.provider})`,
              amount: `+${Number(ow.points_reward)} Points`,
              time: formatDistanceToNow(new Date(ow.created_at), { addSuffix: true }),
              date: new Date(ow.created_at),
              icon: Gamepad2,
              color: 'text-amber-400'
            })
          })
        }

        // Sort combined activities by date descending, limit to 5
        activities.sort((a, b) => b.date.getTime() - a.date.getTime())
        setRecentActivity(activities.slice(0, 5))

        // 6. Fetch Blog Cards
        const { data: cardsData } = await supabase
          .from('blog_posts')
          .select('id, title, slug, excerpt, cover_image, created_at')
          .eq('published', true)
          .eq('is_card', true)
          .order('created_at', { ascending: false })
          .limit(3)

        if (cardsData) {
          setBlogCards(cardsData)
        }

        // 7. Fetch weekly earnings from RPC (includes Faucet, Shortlinks & Referral Commissions)
        const { data: weeklyData, error: weeklyError } = await supabase.rpc('get_user_weekly_earnings', {
          p_user_id: userId
        })

        if (!weeklyError && weeklyData) {
          const maxPoints = Math.max(...weeklyData.map((d: any) => d.points), 100)
          const chartData = weeklyData.map((day: any) => ({
            name: day.day_name,
            points: day.points,
            heightPercent: Math.max(Math.min((day.points / maxPoints) * 100, 100), 5)
          }))
          setWeeklyEarnings(chartData)
        }

        // 8. Fetch user leaderboard ranks
        try {
          const { data: ranksData, error: ranksError } = await supabase.rpc("get_user_leaderboard_ranks", {
            p_user_id: userId
          })
          if (!ranksError && ranksData) {
            setLeaderboardRanks(ranksData)
          } else {
            console.warn("get_user_leaderboard_ranks RPC failed (sql migration might be missing):", ranksError)
          }
        } catch (e) {
          console.warn("Failed to fetch user leaderboard ranks:", e)
        }
      } catch (error) {
        console.error("Error fetching dashboard data:", error)
      } finally {
        setIsLoadingStats(false)
      }
    }

    if (userId) {
      fetchDashboardData()
    }
  }, [userId, supabase, balance])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <LandingPage />
  }

  const totalEarnedUsd = (statsData.totalEarned * 0.000005).toFixed(4)
  const levelInfo = getLevelInfo(xp)
  const LevelIcon = levelInfo.icon

  const stats = [
    { 
      name: 'Balance', 
      value: Math.floor(balance).toString(), 
      icon: Coins, 
      color: 'text-purple-400', 
      trend: '+12%', 
      up: true, 
      subtitle: 'Current Wallet' 
    },
    { 
      name: 'Total Claims', 
      value: statsData.totalClaims.toString(), 
      icon: Clock, 
      color: 'text-cyan-400', 
      trend: `${statsData.totalClaims > 0 ? '+100%' : '0%'}`, 
      up: true, 
      subtitle: 'Manual Faucet' 
    },
    { 
      name: 'Referrals', 
      value: statsData.referrals.toString(), 
      icon: Users, 
      color: 'text-fuchsia-400', 
      trend: statsData.activeToday.toString(), 
      up: statsData.activeToday > 0, 
      subtitle: 'Active Today' 
    },
    { 
      name: 'Total Earned', 
      value: statsData.totalEarned.toString(), 
      icon: TrendingUp, 
      color: 'text-emerald-400', 
      trend: `$${totalEarnedUsd}`, 
      up: true, 
      subtitle: 'USD Conversion' 
    },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-5 h-5 text-fuchsia-400 animate-pulse" />
            <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-[0.2em] drop-shadow-sm">Dashboard Overview</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tight leading-none mb-2 text-white drop-shadow-md">
            Welcome back, <span className="gradient-text uppercase">{username || 'Guest'}</span>
          </h2>
          <p className="text-white/70 text-lg font-bold">Ready to grow your crypto portfolio today?</p>
        </motion.div>

        {leaderboardRanks && (
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex flex-wrap items-center gap-3 bg-white/[0.02] border border-white/10 rounded-3xl p-4 md:p-5 backdrop-blur-md shadow-lg"
          >
            <div className="text-xs font-black text-white/40 uppercase tracking-widest mr-2 block w-full sm:w-auto">
              🏆 Your active ranks:
            </div>
            
            {/* Faucet Rank */}
            <Link href="/leaderboard" className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/30 transition-all group">
              <Coins className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-white/60">Faucet:</span>
              <span className="text-xs font-black text-purple-400">
                {leaderboardRanks.faucet_rank ? `#${leaderboardRanks.faucet_rank}` : 'Unranked'}
              </span>
            </Link>

            {/* Shortlink Rank */}
            <Link href="/leaderboard" className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 hover:border-cyan-500/30 transition-all group">
              <Link2 className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-white/60">Shortlink:</span>
              <span className="text-xs font-black text-cyan-400">
                {leaderboardRanks.shortlink_rank ? `#${leaderboardRanks.shortlink_rank}` : 'Unranked'}
              </span>
            </Link>

            {/* Referral Rank */}
            <Link href="/leaderboard" className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 hover:bg-fuchsia-500/20 hover:border-fuchsia-500/30 transition-all group">
              <Users className="w-3.5 h-3.5 text-fuchsia-400 group-hover:scale-110 transition-transform" />
              <span className="text-xs font-bold text-white/60">Referral:</span>
              <span className="text-xs font-black text-fuchsia-400">
                {leaderboardRanks.referral_rank ? `#${leaderboardRanks.referral_rank}` : 'Unranked'}
              </span>
            </Link>
          </motion.div>
        )}
      </div>

      {/* LEVEL & XP CARD */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className={`glass relative overflow-hidden border-white/10 ${levelInfo.borderColor} rounded-[2.5rem] shadow-2xl`}>
          <div className="absolute top-0 right-0 p-8 opacity-[0.04]">
            <LevelIcon className="w-48 h-48 text-white" />
          </div>
          <CardContent className="p-8 md:p-10 relative z-10">
            <div className="flex flex-col md:flex-row md:items-center gap-8">
              {/* Level Badge */}
              <div className="flex items-center gap-5">
                <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${levelInfo.color} flex items-center justify-center shadow-xl`}>
                  <LevelIcon className="w-10 h-10 text-white drop-shadow-lg" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Current Rank</p>
                    <button 
                      onClick={() => setIsGuideOpen(true)}
                      className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all border border-white/10"
                      title="Rank Guide"
                    >
                      <Info className="w-3 h-3" />
                    </button>
                  </div>
                  <h3 className={`text-3xl md:text-4xl font-black uppercase tracking-tighter ${levelInfo.textColor}`}>
                    {levelInfo.name}
                  </h3>
                </div>
              </div>

              {/* XP Bar */}
              <div className="flex-1 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-black text-white/80 font-mono">
                    {xp.toLocaleString()} <span className="text-white/30 text-xs">XP</span>
                  </span>
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                    {levelInfo.nextLevel ? `Next: ${levelInfo.nextLevel.name} (${levelInfo.maxXp.toLocaleString()} XP)` : 'MAX LEVEL'}
                  </span>
                </div>
                <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${levelInfo.progress}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${levelInfo.color} relative`}
                  >
                    <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
                  </motion.div>
                </div>
                <div className="flex justify-between text-[10px] font-black text-white/20 uppercase tracking-widest">
                  <span>{levelInfo.minXp.toLocaleString()} XP</span>
                  <span>{levelInfo.progress.toFixed(1)}%</span>
                  <span>{levelInfo.maxXp.toLocaleString()} XP</span>
                </div>
              </div>

              {/* All Levels Preview */}
              <div className="hidden lg:flex flex-col gap-2">
                {LEVELS.map((lvl) => {
                  const isCurrentOrPast = xp >= lvl.minXp
                  return (
                    <div key={lvl.name} className={`flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all ${lvl.name === levelInfo.name ? 'bg-white/10 border border-white/10' : ''}`}>
                      <lvl.icon className={`w-4 h-4 ${isCurrentOrPast ? lvl.textColor : 'text-white/10'}`} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isCurrentOrPast ? lvl.textColor : 'text-white/10'}`}>
                        {lvl.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom row: Activity Deadline Timer */}
            <div className="border-t border-white/5 pt-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight italic">Activity Deadline</h4>
                  <p className="text-[10px] text-white/40 font-black uppercase tracking-wider">Claim before decay</p>
                </div>
              </div>

              <div className="flex-1 max-w-md space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xl font-black font-mono tracking-tighter text-rose-400">
                    {decayTimeLeft > 0 ? formatDecayTime(decayTimeLeft) : "DECAY ACTIVE"}
                  </span>
                  <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">
                    {decayTimeLeft > 0 ? `${Math.floor((decayTimeLeft / 86400) * 100)}% time left` : "0% left"}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.max(0, (decayTimeLeft / 86400) * 100))}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`h-full rounded-full bg-gradient-to-r ${
                      decayTimeLeft > 43200 ? "from-emerald-500 to-teal-500" :
                      decayTimeLeft > 14400 ? "from-amber-500 to-orange-500" :
                      "from-rose-500 to-red-600"
                    }`}
                  />
                </div>
              </div>

              <div className="text-[10px] text-white/30 font-black uppercase tracking-wider md:text-right max-w-[200px] leading-relaxed">
                *Claim Faucet or Shortlink daily to refresh timer.
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>



      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.name} variants={item}>
            <Card className="glass group relative overflow-hidden h-full border-white/10 hover:border-primary/50 transition-all duration-500 rounded-3xl">
              <div className="absolute top-0 right-0 p-6 opacity-10 -translate-x-2 translate-y-2 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform duration-500">
                <stat.icon className="w-20 h-20" />
              </div>
              
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                <CardTitle className="text-xs font-bold tracking-widest uppercase text-white/60">{stat.name}</CardTitle>
                <div className={`p-2 rounded-xl bg-white/10 ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="text-3xl font-black font-mono tracking-tighter mb-1 text-white">{isLoadingStats && stat.name !== 'Balance' ? '...' : stat.value}</div>
                <div className="flex items-center gap-1">
                  {stat.up ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
                  <span className={`text-xs font-bold ${stat.up ? 'text-emerald-400' : 'text-rose-400'}`}>{stat.trend}</span>
                  <span className="text-[10px] text-white/50 ml-1 font-bold italic tracking-tighter capitalize">{stat.subtitle}</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* Ad Banner */}
      <div className="w-full flex flex-col items-center justify-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-white/20">Sponsored Advertisement</span>
        <div className="w-full max-w-4xl mx-auto px-6 relative z-10">
          <div id="frame" style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }}>
            <iframe 
              data-aa='2441223' 
              src='//acceptable.a-ads.com/2441223/?size=Adaptive'
              style={{ border: 0, padding: 0, width: '100%', height: '90px', overflow: 'hidden', display: 'block', margin: 'auto' }}
            />
          </div>
        </div>
      </div>

      {/* Charts & History */}
      <div className="grid gap-8 md:grid-cols-5">
        <Card className="glass md:col-span-3 rounded-[2.5rem] border-white/10 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 px-8 py-6">
            <CardTitle className="text-xl font-bold text-white uppercase italic">Earning Performance</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs font-bold hover:bg-white/10 text-white/60 rounded-xl">Weekly View</Button>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-between p-8">
            <div className="w-full h-44 flex justify-between gap-3 items-end px-4 relative">
              {weeklyEarnings.map((item, i) => (
                <div key={i} className="w-full h-full relative group/bar flex items-end">
                  {/* Hover Tooltip */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-black px-2 py-1 rounded-[0.5rem] opacity-0 group-hover/bar:opacity-100 transition-all duration-300 pointer-events-none shadow-lg shadow-purple-500/20 whitespace-nowrap z-30">
                    +{item.points} Pts
                  </div>

                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${item.heightPercent}%` }}
                    transition={{ delay: i * 0.1, duration: 1 }}
                    className="w-full bg-primary/40 hover:bg-primary/80 rounded-t-xl transition-all relative z-10"
                  />
                  <div className="absolute inset-0 bg-primary opacity-0 group-hover/bar:opacity-30 blur-2xl transition-opacity pointer-events-none" />
                </div>
              ))}
            </div>
            <div className="flex justify-between w-full mt-4 px-4">
              {weeklyEarnings.map((item, idx) => (
                <span key={idx} className="text-[10px] font-bold text-white/40 uppercase tracking-tighter w-full text-center">{item.name}</span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="glass md:col-span-2 rounded-[2.5rem] border-white/10 overflow-hidden flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 px-8 py-6">
            <CardTitle className="text-xl font-bold text-white uppercase italic">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs font-bold hover:bg-white/10 text-purple-400 rounded-xl underline uppercase">View All</Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-y-auto custom-scrollbar">
            <div className="divide-y divide-white/5">
              <AnimatePresence>
                {recentActivity.length > 0 ? (
                  recentActivity.map((activity, i) => (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      key={activity.type + i} 
                      className="flex items-center gap-4 px-8 py-5 hover:bg-white/[0.05] transition-colors cursor-pointer group"
                    >
                      <div className={`w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center ${activity.color} group-hover:scale-110 transition-transform`}>
                        <activity.icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white uppercase">{activity.type}</p>
                        <p className="text-xs text-white/40 font-medium italic">{activity.time}</p>
                      </div>
                      <div className={`text-sm font-black font-mono ${activity.color}`}>
                        {activity.amount}
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-white/20">
                     <Clock className="w-10 h-10 mb-2 opacity-10" />
                     <span className="text-xs font-bold uppercase tracking-widest">No recent activity</span>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* INFO / BLOG CARDS SECTION */}
      {blogCards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" />
            <h3 className="text-xs font-black uppercase text-white tracking-[0.2em]">Updates & Announcements</h3>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {blogCards.map((card, i) => (
              <Link
                key={card.id}
                href={`/blog/${card.slug}`}
                className="glass group cursor-pointer overflow-hidden border-white/10 hover:border-purple-500/40 rounded-[2rem] shadow-lg transition-all duration-300 flex flex-col h-full bg-white/[0.01]"
              >
                {card.cover_image && (
                  <div className="h-40 overflow-hidden relative">
                    <img 
                      src={card.cover_image} 
                      alt={card.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                )}
                <div className="p-6 flex flex-col flex-1 justify-between gap-4">
                  <div className="space-y-2">
                    <h4 className="text-base font-black text-white group-hover:text-purple-400 transition-colors line-clamp-2 uppercase tracking-wide leading-snug">
                      {card.title}
                    </h4>
                    {card.excerpt && (
                      <p className="text-xs text-white/50 font-medium line-clamp-3 leading-relaxed italic">
                        {card.excerpt}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">
                      {new Date(card.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span className="text-[10px] font-black text-purple-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 uppercase tracking-widest">
                      Read Details <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </motion.div>
      )}
      {/* RANK GUIDE MODAL */}
      <AnimatePresence>
        {isGuideOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGuideOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="glass border border-white/10 rounded-[3rem] w-full max-w-2xl overflow-hidden shadow-2xl relative z-10"
            >
              <div className="p-8 md:p-10 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-fuchsia-500/10 border border-fuchsia-500/20 text-fuchsia-400">
                      <Info className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight italic">Rank & Inactivity Guide</h3>
                      <p className="text-[10px] text-white/50 font-bold uppercase tracking-wider">How levels & decay work</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsGuideOpen(false)}
                    className="p-2 rounded-2xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-all border border-white/10"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Content Grid */}
                <div className="grid gap-4 sm:grid-cols-2 text-xs">
                  <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 space-y-2">
                    <h5 className="font-black text-fuchsia-400 uppercase tracking-wider flex items-center gap-1.5">
                      📈 Rank Benefits
                    </h5>
                    <p className="text-white/60 font-medium leading-relaxed">
                      Higher ranks receive bonus multiplier rewards on Faucet & Shortlink claims:
                      <br />• **Silver**: +5% bonus
                      <br />• **Platinum**: +10% bonus
                      <br />• **Diamond**: +15% bonus
                    </p>
                  </div>

                  <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 space-y-2">
                    <h5 className="font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                      ⏳ Inactivity Decay
                    </h5>
                    <p className="text-white/60 font-medium leading-relaxed">
                      If you do not claim within 24 hours, your XP decays daily based on your rank:
                      <br />• **Diamond**: -400 XP | **Platinum**: -200 XP
                      <br />• **Silver**: -100 XP | **Bronze**: -50 XP
                      <br />• **Mud**: -20 XP
                    </p>
                  </div>

                  <div className="p-5 rounded-3xl bg-white/[0.02] border border-white/5 sm:col-span-2 space-y-2">
                    <h5 className="font-black text-amber-500 uppercase tracking-wider flex items-center gap-1.5">
                      ⚠️ Rank Mud Penalty (-50%)
                    </h5>
                    <p className="text-white/60 font-medium leading-relaxed">
                      If your XP drops below 0 (down to **-500 XP**), you enter **Rank Mud**. While in Mud, all payouts are **slashed by 50%**. Complete any claim (Faucet or Shortlink) to immediately stop decay and start recovering your XP!
                    </p>
                  </div>
                </div>

                {/* Close Button */}
                <div className="pt-2 flex justify-end">
                  <button
                    onClick={() => setIsGuideOpen(false)}
                    className="w-full sm:w-auto px-6 h-12 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black uppercase text-xs tracking-wider transition-all border border-white/10"
                  >
                    Close Guide
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#020617]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
