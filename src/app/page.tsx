"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Coins, Clock, Users, TrendingUp, ArrowUpRight, ArrowDownRight, Sparkles, Loader2, MousePointer2, Shield, Crown, Award, Gem, Link2 } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { useStore } from "@/store/useStore"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/components/providers/AuthProvider"
import { LandingPage } from "@/components/landing/LandingPage"
import { createClient } from "@/lib/supabase"
import { formatDistanceToNow } from 'date-fns'

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
  { name: 'Bronze',   minXp: 0,       maxXp: 1000,    color: 'from-amber-700 to-amber-500',   textColor: 'text-amber-400',   borderColor: 'border-amber-500/30',  bgColor: 'bg-amber-500',   icon: Shield },
  { name: 'Silver',   minXp: 1000,    maxXp: 10000,   color: 'from-slate-400 to-slate-300',    textColor: 'text-slate-300',   borderColor: 'border-slate-400/30',  bgColor: 'bg-slate-400',   icon: Award },
  { name: 'Platinum', minXp: 10000,   maxXp: 100000,  color: 'from-indigo-300 to-slate-200',   textColor: 'text-indigo-200',  borderColor: 'border-indigo-300/30', bgColor: 'bg-indigo-300',  icon: Crown },
  { name: 'Diamond',  minXp: 100000,  maxXp: 1000000, color: 'from-cyan-400 to-blue-500',      textColor: 'text-cyan-300',    borderColor: 'border-cyan-400/30',   bgColor: 'bg-cyan-400',    icon: Gem },
]

function getLevelInfo(xp: number) {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].minXp) {
      const level = LEVELS[i]
      const progress = Math.min(((xp - level.minXp) / (level.maxXp - level.minXp)) * 100, 100)
      const nextLevel = i < LEVELS.length - 1 ? LEVELS[i + 1] : null
      return { ...level, progress, xp, nextLevel }
    }
  }
  return { ...LEVELS[0], progress: 0, xp, nextLevel: LEVELS[1] }
}

export default function Home() {
  const { balance, username, id: userId, xp } = useStore()
  const { user, loading } = useAuth()
  const supabase = createClient()
  
  const [statsData, setStatsData] = useState({
    totalClaims: 0,
    referrals: 0,
    activeToday: 0,
    totalEarned: 0
  })
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [blogCards, setBlogCards] = useState<any[]>([])

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

        setStatsData({
          totalClaims: (faucetCount || 0) + (shortlinkCount || 0),
          referrals: referralCount,
          activeToday: refStats?.active_today || 0,
          totalEarned: faucetTotal + shortlinkTotal + referralCommissions
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
                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Current Rank</p>
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

      {/* Charts & History */}
      <div className="grid gap-8 md:grid-cols-5">
        <Card className="glass md:col-span-3 rounded-[2.5rem] border-white/10 overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/10 px-8 py-6">
            <CardTitle className="text-xl font-bold text-white uppercase italic">Earning Performance</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs font-bold hover:bg-white/10 text-white/60 rounded-xl">Weekly View</Button>
          </CardHeader>
          <CardContent className="h-[300px] flex flex-col items-center justify-center p-8">
            <div className="w-full flex justify-between gap-2 items-end px-4">
              {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
                <div key={i} className="w-full relative group/bar">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: i * 0.1, duration: 1 }}
                    className="w-full bg-primary/40 hover:bg-primary/80 rounded-t-xl transition-all h-full relative"
                  />
                  <div className="absolute inset-0 bg-primary opacity-0 group-hover/bar:opacity-30 blur-2xl transition-opacity" />
                </div>
              ))}
            </div>
            <div className="flex justify-between w-full mt-4 px-4">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <span key={d} className="text-[10px] font-bold text-white/40 uppercase tracking-tighter">{d}</span>
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

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass rounded-[2rem] p-8 border-white/10 group bg-gradient-to-br from-primary/20 to-transparent">
          <Sparkles className="w-10 h-10 text-purple-400 mb-4" />
          <h3 className="text-xl font-bold mb-2 text-white italic uppercase">Claim Free Points</h3>
          <p className="text-sm text-white/50 font-medium mb-6 italic">Your faucet is ready! Claim free points now.</p>
          <Button onClick={() => window.location.href = '/faucet'} className="w-full h-12 rounded-2xl font-bold bg-primary text-white neon-glow uppercase text-xs tracking-widest">Open Faucet</Button>
        </Card>
        
        <Card className="glass rounded-[2rem] p-8 border-white/10 group bg-gradient-to-br from-cyan-500/20 to-transparent">
          <MousePointer2 className="w-10 h-10 text-cyan-400 mb-4" />
          <h3 className="text-xl font-bold mb-2 text-white italic uppercase">PTC Ads Available</h3>
          <p className="text-sm text-white/50 font-medium mb-6 italic">Watch digital ads and earn passive points automatically.</p>
          <Button onClick={() => window.location.href = '/ptc'} variant="outline" className="w-full h-12 rounded-2xl font-bold glass border-white/20 hover:bg-white/10 text-white uppercase text-xs tracking-widest">Browse Ads</Button>
        </Card>

        <Card className="glass rounded-[2rem] p-8 border-white/10 group bg-gradient-to-br from-fuchsia-500/20 to-transparent">
          <Users className="w-10 h-10 text-fuchsia-400 mb-4" />
          <h3 className="text-xl font-bold mb-2 text-white italic uppercase">Invite & Earn</h3>
          <p className="text-sm text-white/50 font-medium mb-6 italic">Share your unique link and get 25% lifetime commission.</p>
          <Button onClick={() => window.location.href = '/referral'} variant="outline" className="w-full h-12 rounded-2xl font-bold glass border-white/20 hover:bg-white/10 text-white uppercase text-xs tracking-widest">Copy Link</Button>
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
    </div>
  )
}
