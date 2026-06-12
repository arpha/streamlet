"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Loader2, RefreshCw, Shield, ShieldCheck, Users, Coins, Flame, Link2, 
  Gamepad2, Wallet, Megaphone, MessageSquare, CalendarCheck, ListTodo, 
  BookOpen, ArrowRight, ShieldAlert, DollarSign, Activity, HardDrive, 
  Award, CheckCircle2, XCircle, Clock
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface ActivityLog {
  activity_type: string
  username: string
  email: string
  amount: string
  details: string
  ip_address: string | null
  device_fingerprint: string | null
  status: string
  created_at: string
}

interface Withdrawal {
  id: string
  amount: number
  coin: string
  address: string
  usd_value: number
  status: string
  created_at: string
  profiles?: {
    username: string
  } | null
}

export default function AdminDashboardPage() {
  const { id: userId, isAdmin } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loadingStats, setLoadingStats] = useState(true)
  
  // Dashboard Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    dau: 0,
    mau: 0,
    totalUserPoints: 0,
    totalFaucetClaims: 0,
    totalShortlinks: 0,
    
    // Miner stats
    activeMiners: 0,
    coalMiners: 0,
    ironMiners: 0,
    goldMiners: 0,
    minerPurchasesVolume: 0,
    minerClaimsVolume: 0,
    
    // Withdrawal stats
    completedWithdrawalsCount: 0,
    completedWithdrawalsUsd: 0,
    failedWithdrawalsCount: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsPoints: 0,
    
    // PTC stats
    activePtcCampaigns: 0,
  })

  const [recentActivities, setRecentActivities] = useState<ActivityLog[]>([])
  const [recentWithdrawals, setRecentWithdrawals] = useState<Withdrawal[]>([])
  const [loadingLogs, setLoadingLogs] = useState(true)

  // Auth Protection Gate
  useEffect(() => {
    if (userId === undefined) return
    
    if (!userId || !isAdmin) {
      const timer = setTimeout(() => {
        toast.error("Access Denied: Admin authorization required.")
        router.push("/")
      }, 1000)
      return () => clearTimeout(timer)
    }
    
    setCheckingAuth(false)
    fetchDashboardData()
  }, [userId, isAdmin, router])

  const fetchDashboardData = async () => {
    setLoadingStats(true)
    setLoadingLogs(true)
    
    try {
      const todayISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const monthAgoISO = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // Fetch Stats in parallel
      const [
        usersRes,
        dauRes,
        mauRes,
        faucetClaimsRes,
        shortlinkClaimsRes,
        minersRes,
        miningClaimsPurchasesRes,
        miningClaimsRewardsRes,
        withdrawalsCompletedRes,
        withdrawalsFailedRes,
        withdrawalsPendingRes,
        ptcRes,
        activitiesRes,
        withdrawalsListRes
      ] = await Promise.all([
        supabase.from("profiles").select("balance"),
        supabase.from("profiles").select("id", { count: "exact" }).gte("last_active_at", todayISO),
        supabase.from("profiles").select("id", { count: "exact" }).gte("last_active_at", monthAgoISO),
        supabase.from("faucet_claims").select("id", { count: "exact" }),
        supabase.from("shortlink_claims").select("id", { count: "exact" }).eq("status", "completed"),
        supabase.from("user_miners").select("miner_type, expires_at"),
        supabase.from("mining_claims").select("amount").eq("claim_type", "purchase"),
        supabase.from("mining_claims").select("amount").eq("claim_type", "claim"),
        supabase.from("withdrawals").select("amount, usd_value").eq("status", "completed"),
        supabase.from("withdrawals").select("id", { count: "exact" }).eq("status", "failed"),
        supabase.from("withdrawals").select("amount").eq("status", "pending"),
        supabase.from("ptc_campaigns").select("id", { count: "exact" }).eq("status", "active"),
        // Fetch 5 recent activities
        supabase.rpc("get_admin_player_activities", {
          p_user_id: userId,
          p_limit: 5,
          p_offset: 0
        }),
        // Fetch 5 recent withdrawals
        supabase.from("withdrawals").select(`
          id,
          amount,
          coin,
          address,
          usd_value,
          status,
          created_at
        `).order("created_at", { ascending: false }).limit(5)
      ])

      // Calculations
      const userList = usersRes.data || []
      const totalPoints = userList.reduce((sum, u) => sum + (u.balance || 0), 0)
      
      const minersList = minersRes.data || []
      const now = new Date()
      const activeCount = minersList.filter(m => new Date(m.expires_at) > now).length
      const coalCount = minersList.filter(m => m.miner_type === "coal" && new Date(m.expires_at) > now).length
      const ironCount = minersList.filter(m => m.miner_type === "iron" && new Date(m.expires_at) > now).length
      const goldCount = minersList.filter(m => m.miner_type === "gold" && new Date(m.expires_at) > now).length

      const purchasesSum = Math.abs(miningClaimsPurchasesRes.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0)
      const claimsSum = miningClaimsRewardsRes.data?.reduce((sum, c) => sum + (c.amount || 0), 0) || 0

      const completedCount = withdrawalsCompletedRes.data?.length || 0
      const completedUsd = withdrawalsCompletedRes.data?.reduce((sum, w) => sum + (Number(w.usd_value) || 0), 0) || 0
      const pendingCount = withdrawalsPendingRes.data?.length || 0
      const pendingPoints = withdrawalsPendingRes.data?.reduce((sum, w) => sum + (w.amount || 0), 0) || 0

      setStats({
        totalUsers: userList.length,
        dau: dauRes.count || 0,
        mau: mauRes.count || 0,
        totalUserPoints: totalPoints,
        totalFaucetClaims: faucetClaimsRes.count || 0,
        totalShortlinks: shortlinkClaimsRes.count || 0,
        
        activeMiners: activeCount,
        coalMiners: coalCount,
        ironMiners: ironCount,
        goldMiners: goldCount,
        minerPurchasesVolume: purchasesSum,
        minerClaimsVolume: claimsSum,
        
        completedWithdrawalsCount: completedCount,
        completedWithdrawalsUsd: completedUsd,
        failedWithdrawalsCount: withdrawalsFailedRes.count || 0,
        pendingWithdrawalsCount: pendingCount,
        pendingWithdrawalsPoints: pendingPoints,
        
        activePtcCampaigns: ptcRes.count || 0,
      })

      if (activitiesRes.data) {
        setRecentActivities(activitiesRes.data)
      }

      if (withdrawalsListRes.data) {
        setRecentWithdrawals(withdrawalsListRes.data as Withdrawal[])
      }

    } catch (err: any) {
      console.error("Dashboard data load error:", err)
      toast.error("Failed to load dashboard metrics.")
    } finally {
      setLoadingStats(false)
      setLoadingLogs(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-white/40 font-bold uppercase tracking-wider text-xs">Checking admin authorization...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
              Admin Console
            </h2>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">
              Platform status, engagement metrics, and administrative control center
            </p>
          </div>
        </div>

        <Button 
          onClick={fetchDashboardData} 
          disabled={loadingStats}
          variant="outline"
          className="glass border-white/10 text-white/70 hover:text-white rounded-xl gap-2 hover:bg-white/5 h-11"
        >
          <RefreshCw className={`w-4 h-4 ${loadingStats ? "animate-spin" : ""}`} />
          Refresh Stats
        </Button>
      </div>

      {/* Alert if there are pending withdrawals */}
      {stats.pendingWithdrawalsCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-[1.5rem] p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-sm text-amber-400">Terdapat Penarikan Pending!</p>
              <p className="text-[11px] text-white/60">Ada {stats.pendingWithdrawalsCount} penarikan ({stats.pendingWithdrawalsPoints.toLocaleString()} Pts) yang tertunda karena saldo faucet kosong.</p>
            </div>
          </div>
          <Link href="/admin/withdrawals">
            <Button size="sm" className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs uppercase tracking-widest px-4 py-2 h-9 rounded-xl border-0">
              Proses Sekarang <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      )}

      {/* ADMIN SHORTCUTS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { name: "Player Activities", icon: Activity, href: "/admin/activities", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
          { name: "Manage Tasks", icon: ListTodo, href: "/admin/tasks", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
          { name: "Manage Withdrawals", icon: Wallet, href: "/admin/withdrawals", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
          { name: "Leaderboard Winner", icon: Award, href: "/admin/leaderboard", color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20" },
          { name: "Blog Posts", icon: BookOpen, href: "/admin/blog", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
          { name: "User Messages", icon: MessageSquare, href: "/admin/messages", color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
        ].map((item) => (
          <Link href={item.href} key={item.name}>
            <Card className="glass border-white/5 hover:border-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5 cursor-pointer rounded-2xl overflow-hidden group">
              <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                <div className={`p-3 rounded-xl border ${item.color} group-hover:scale-110 transition-transform duration-300`}>
                  <item.icon className="w-5 h-5" />
                </div>
                <span className="font-bold text-xs uppercase tracking-wider text-zinc-300 group-hover:text-white transition-colors">{item.name}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: User Engagement (DAU/MAU) */}
        <Card className="glass border-white/5 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[5rem] -z-10 group-hover:bg-primary/10 transition-colors" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-primary">
              <Users className="w-5 h-5" />
              <CardTitle className="text-xs uppercase font-black tracking-widest text-zinc-400">User Engagement</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-4xl font-black tracking-tight">{stats.totalUsers.toLocaleString()}</span>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">Total Users Registered</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-lg text-emerald-400 text-[10px] font-black uppercase w-fit ml-auto">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live Now
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-white/5">
              <div>
                <span className="text-xl font-bold font-mono text-zinc-200">{stats.dau.toLocaleString()}</span>
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-wider mt-0.5">DAU (24h Active)</p>
              </div>
              <div>
                <span className="text-xl font-bold font-mono text-zinc-200">{stats.mau.toLocaleString()}</span>
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-wider mt-0.5">MAU (30d Active)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Virtual Miner Summary */}
        <Card className="glass border-white/5 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-[5rem] -z-10 group-hover:bg-amber-500/10 transition-colors" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-amber-400">
              <HardDrive className="w-5 h-5" />
              <CardTitle className="text-xs uppercase font-black tracking-widest text-zinc-400">Virtual Miner Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-4xl font-black tracking-tight">{stats.activeMiners.toLocaleString()}</span>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">Active Miners Leased</p>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-zinc-300">
                  {((stats.minerClaimsVolume / (stats.minerPurchasesVolume || 1)) * 100).toFixed(1)}% ROI
                </span>
                <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Average Return</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5 text-center">
              <div className="p-1.5 rounded-xl bg-zinc-950/40 border border-white/5">
                <span className="text-xs font-bold text-zinc-400 block">Coal</span>
                <span className="text-sm font-black text-amber-700">{stats.coalMiners}</span>
              </div>
              <div className="p-1.5 rounded-xl bg-zinc-950/40 border border-white/5">
                <span className="text-xs font-bold text-zinc-400 block">Iron</span>
                <span className="text-sm font-black text-zinc-300">{stats.ironMiners}</span>
              </div>
              <div className="p-1.5 rounded-xl bg-zinc-950/40 border border-white/5">
                <span className="text-xs font-bold text-zinc-400 block">Gold</span>
                <span className="text-sm font-black text-amber-500">{stats.goldMiners}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs pt-1">
              <div>
                <span className="text-rose-400 font-mono font-bold">-{stats.minerPurchasesVolume.toLocaleString()} Pts</span>
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Total Leased Out</p>
              </div>
              <div>
                <span className="text-emerald-400 font-mono font-bold">+{stats.minerClaimsVolume.toLocaleString()} Pts</span>
                <p className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">Total Claims</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Financials & Withdrawals */}
        <Card className="glass border-white/5 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-[5rem] -z-10 group-hover:bg-rose-500/10 transition-colors" />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 text-rose-400">
              <Wallet className="w-5 h-5" />
              <CardTitle className="text-xs uppercase font-black tracking-widest text-zinc-400">Platform Financials</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <span className="text-2xl font-black text-zinc-100 font-mono">{stats.totalUserPoints.toLocaleString()} Pts</span>
              <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">Total User Balances</p>
            </div>

            <div className="pt-2 border-t border-white/5 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Completed Payouts:</span>
                <span className="font-bold text-emerald-400 font-mono">
                  {stats.completedWithdrawalsCount} (${stats.completedWithdrawalsUsd.toFixed(2)})
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Failed Payouts:</span>
                <span className="font-bold text-rose-400 font-mono">{stats.failedWithdrawalsCount}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Pending Actions:</span>
                {stats.pendingWithdrawalsCount > 0 ? (
                  <span className="font-bold text-amber-400 font-mono animate-pulse">
                    {stats.pendingWithdrawalsCount} ({stats.pendingWithdrawalsPoints.toLocaleString()} Pts)
                  </span>
                ) : (
                  <span className="text-zinc-600 font-bold">None</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PLATFORM USAGE METRICS */}
      <div className="grid gap-6 md:grid-cols-4">
        {[
          { name: "Faucet Claims", count: stats.totalFaucetClaims, icon: Flame, color: "text-purple-400" },
          { name: "Shortlink Completes", count: stats.totalShortlinks, icon: Link2, color: "text-cyan-400" },
          { name: "Active PTC Ads", count: stats.activePtcCampaigns, icon: Megaphone, color: "text-amber-400" },
          { name: "Completed Surveys", count: 0, icon: Gamepad2, color: "text-emerald-400" }
        ].map((metric) => (
          <Card key={metric.name} className="glass border-white/5 rounded-2xl">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <span className="text-2xl font-black font-mono">{metric.count.toLocaleString()}</span>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">{metric.name}</p>
              </div>
              <div className={`p-3 rounded-xl bg-white/[0.02] border border-white/5 ${metric.color}`}>
                <metric.icon className="w-5 h-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* BOTTOM LOGS SECTION */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent Player Activities */}
        <Card className="glass border-white/5 rounded-[2rem] overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/[0.01] p-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-black uppercase tracking-wider">Recent Player Activities</CardTitle>
              <CardDescription className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">
                Live activity feeds from claims & withdrawals
              </CardDescription>
            </div>
            <Link href="/admin/activities">
              <Button size="sm" variant="ghost" className="text-xs font-bold text-primary hover:text-white uppercase tracking-wider gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLogs ? (
              <div className="p-10 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Loading feeds...</span>
              </div>
            ) : recentActivities.length === 0 ? (
              <div className="p-10 text-center text-zinc-600 font-bold uppercase tracking-wider text-xs">
                No activity logs recorded.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentActivities.map((log, index) => (
                  <div key={index} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm text-zinc-200">{log.username || "Anonymous"}</span>
                      <span className="text-[10px] text-zinc-500">{log.details}</span>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className="font-mono text-xs font-bold text-primary">{log.amount}</span>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent FaucetPay Withdrawals */}
        <Card className="glass border-white/5 rounded-[2rem] overflow-hidden">
          <CardHeader className="border-b border-white/5 bg-white/[0.01] p-6 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-black uppercase tracking-wider">Recent FaucetPay Transactions</CardTitle>
              <CardDescription className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">
                Withdrawals requested & sent to users
              </CardDescription>
            </div>
            <Link href="/admin/activities?type=withdrawal">
              <Button size="sm" variant="ghost" className="text-xs font-bold text-primary hover:text-white uppercase tracking-wider gap-1">
                View All <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {loadingLogs ? (
              <div className="p-10 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2" />
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Loading history...</span>
              </div>
            ) : recentWithdrawals.length === 0 ? (
              <div className="p-10 text-center text-zinc-600 font-bold uppercase tracking-wider text-xs">
                No withdrawal requests found.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {recentWithdrawals.map((w) => (
                  <div key={w.id} className="p-4 flex items-center justify-between hover:bg-white/[0.01] transition-colors">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold text-sm text-zinc-200">{w.address}</span>
                      <span className="text-[10px] text-zinc-500">
                        {w.amount.toLocaleString()} Pts (${w.usd_value.toFixed(4)}) • {w.coin}
                      </span>
                    </div>
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                        w.status === "completed" 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                          : w.status === "pending"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                      }`}>
                        {w.status}
                      </span>
                      <span className="text-[9px] text-zinc-500 uppercase font-semibold">
                        {formatDistanceToNow(new Date(w.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
