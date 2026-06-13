"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Plus, 
  Check, 
  X, 
  Award, 
  ArrowLeft, 
  ShieldAlert,
  Loader2,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Users,
  Coins,
  Gamepad2,
  Settings,
  Save,
  RefreshCw,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"

interface Cycle {
  id: number
  start_at: string
  end_at: string
}

interface Winner {
  id: number
  cycle_id: number
  leaderboard_type: 'faucet_shortlink' | 'referral' | 'offerwall'
  username: string
  score: number
  rank: number
  reward_points: number
  payout_status: 'pending_approval' | 'approved' | 'rejected'
}

interface LeaderboardSettings {
  faucet_shortlink_limit: number
  faucet_shortlink_rewards: number[]
  referral_limit: number
  referral_rewards: number[]
  offerwall_limit: number
  offerwall_rewards: number[]
}

export default function AdminLeaderboardPage() {
  const router = useRouter()
  const { isAdmin, id: userId } = useStore()
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(true)
  
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [winners, setWinners] = useState<Winner[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<number | null>(null)
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Navigation Tabs
  const [activeTab, setActiveTab] = useState<'payouts' | 'settings'>('payouts')

  // Dynamic Settings states
  const [faucetLimit, setFaucetLimit] = useState<number>(20)
  const [faucetRewards, setFaucetRewards] = useState<string>("")
  const [referralLimit, setReferralLimit] = useState<number>(10)
  const [referralRewards, setReferralRewards] = useState<string>("")
  const [offerwallLimit, setOfferwallLimit] = useState<number>(10)
  const [offerwallRewards, setOfferwallRewards] = useState<string>("")

  const [savingSettings, setSavingSettings] = useState<boolean>(false)
  const [resettingCycle, setResettingCycle] = useState<boolean>(false)
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false)

  const supabase = createClient()

  // Authorization check
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
    fetchLeaderboardData()
  }, [userId, isAdmin, router])

  async function fetchLeaderboardData() {
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_leaderboards")
      if (error) throw error

      if (data) {
        setCycles(data.past_cycles || [])
        setWinners(data.past_winners || [])
        
        // Populate settings from database
        if (data.settings) {
          setFaucetLimit(data.settings.faucet_shortlink_limit)
          setFaucetRewards(data.settings.faucet_shortlink_rewards.join(", "))
          setReferralLimit(data.settings.referral_limit)
          setReferralRewards(data.settings.referral_rewards.join(", "))
          setOfferwallLimit(data.settings.offerwall_limit)
          setOfferwallRewards(data.settings.offerwall_rewards.join(", "))
        }
        
        // Select latest cycle by default if available
        if (data.past_cycles && data.past_cycles.length > 0 && selectedCycleId === null) {
          setSelectedCycleId(data.past_cycles[0].id)
        }
      }
    } catch (err: any) {
      console.error("Failed to load leaderboard data:", err)
      toast.error(err.message || "Failed to load leaderboard data")
    } finally {
      setLoading(false)
    }
  }

  const handleApproveWinner = async (winnerId: number) => {
    setActionLoadingId(winnerId)
    try {
      const { data, error } = await supabase.rpc("approve_leaderboard_winner_payout", {
        p_winner_id: winnerId
      })

      if (error) throw error

      if (data && data.success) {
        toast.success(data.message || "Reward successfully approved and sent!")
        fetchLeaderboardData()
      } else {
        toast.error(data?.message || "Failed to approve reward")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process approval")
    } finally {
      setActionLoadingId(null)
    }
  };

  const handleApproveCycleAll = async () => {
    if (!selectedCycleId) return
    if (!confirm("Are you sure you want to approve and distribute rewards to ALL winners in this cycle?")) return

    setBulkLoading(true)
    try {
      const { data, error } = await supabase.rpc("approve_leaderboard_payouts_for_cycle", {
        p_cycle_id: selectedCycleId
      })

      if (error) throw error

      if (data && data.success) {
        toast.success(data.message || "All rewards successfully sent!")
        fetchLeaderboardData()
      } else {
        toast.error(data?.message || "Failed to approve cycle rewards")
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to process bulk approval")
    } finally {
      setBulkLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!userId) return
    setSavingSettings(true)

    // Helper to parse comma separated rewards string into int array
    const parseRewards = (str: string) => {
      return str
        .split(",")
        .map(x => parseInt(x.trim(), 10))
        .filter(x => !isNaN(x))
    }

    const fsRewardsArray = parseRewards(faucetRewards)
    const refRewardsArray = parseRewards(referralRewards)
    const offRewardsArray = parseRewards(offerwallRewards)

    try {
      const { data, error } = await supabase.rpc("update_leaderboard_settings", {
        p_admin_id: userId,
        p_faucet_shortlink_limit: faucetLimit,
        p_faucet_shortlink_rewards: fsRewardsArray,
        p_referral_limit: referralLimit,
        p_referral_rewards: refRewardsArray,
        p_offerwall_limit: offerwallLimit,
        p_offerwall_rewards: offRewardsArray
      })

      if (error) throw error

      if (data && data.success) {
        toast.success("Leaderboard settings saved successfully!")
        fetchLeaderboardData()
      } else {
        toast.error(data?.message || "Failed to save settings")
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to save settings")
    } finally {
      setSavingSettings(false)
    }
  }

  const handleResetCycle = async () => {
    if (!userId) return
    setResettingCycle(true)
    try {
      const { data, error } = await supabase.rpc("admin_reset_leaderboard_cycle", {
        p_admin_id: userId
      })

      if (error) throw error

      if (data && data.success) {
        toast.success("Leaderboard reset and archived successfully!")
        setShowResetConfirm(false)
        setActiveTab("payouts")
        setSelectedCycleId(null) // Reset selection to load the latest
        fetchLeaderboardData()
      } else {
        toast.error(data?.message || "Failed to reset leaderboard cycle")
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to reset cycle")
    } finally {
      setResettingCycle(false)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-white/40 font-bold uppercase tracking-wider text-xs">Checking admin authorization...</p>
      </div>
    )
  }

  const activeCycleWinners = winners.filter(w => w.cycle_id === selectedCycleId)
  const pendingCount = activeCycleWinners.filter(w => w.payout_status === 'pending_approval' && w.reward_points > 0).length

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10 min-h-screen text-white relative">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        <div>
          <Link href="/leaderboard" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-xs font-black uppercase tracking-widest mb-4 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Leaderboard
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest">
              <Award className="w-3.5 h-3.5" />
              Leaderboard Admin
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mt-2 italic uppercase">MANAGE LEADERBOARD</h2>
          <p className="text-white/60 font-medium italic">Configure rewards, adjust settings, reset cycles, and pay leaderboard winners.</p>
        </div>
      </div>

      {/* TABS CONTROLLER */}
      <div className="flex justify-start border-b border-white/5 pb-2 gap-4">
        <button
          onClick={() => setActiveTab("payouts")}
          className={`px-4 py-2 font-black text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === "payouts"
              ? "border-purple-500 text-white"
              : "border-transparent text-white/40 hover:text-white/80"
          }`}
        >
          Confirm Payouts
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`px-4 py-2 font-black text-xs uppercase tracking-wider transition-all border-b-2 ${
            activeTab === "settings"
              ? "border-purple-500 text-white"
              : "border-transparent text-white/40 hover:text-white/80"
          }`}
        >
          Leaderboard Settings & Reset
        </button>
      </div>

      {loading ? (
        <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
          <span className="text-xs font-bold uppercase tracking-wider text-white/40">Loading leaderboard details...</span>
        </div>
      ) : activeTab === "payouts" ? (
        /* ==================== TAB 1: PAYOUTS ==================== */
        cycles.length === 0 ? (
          <div className="glass border-white/10 rounded-[2.5rem] p-20 text-center flex flex-col items-center justify-center">
            <Clock className="w-16 h-16 text-white/10 mb-4" />
            <h4 className="text-lg font-black uppercase text-white/60">No completed cycles yet</h4>
            <p className="text-white/40 text-sm mt-1 max-w-md">No winners have been archived. You can execute a cycle reset manually in the settings tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* SIDEBAR: CYCLE LIST */}
            <div className="lg:col-span-1 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-white/40 px-2">Completed Cycles List</h3>
              <div className="space-y-2">
                {cycles.map((cycle) => {
                  const isSelected = selectedCycleId === cycle.id
                  const cycleEndDate = new Date(cycle.end_at).toLocaleDateString("en-US", {
                    day: "numeric",
                    month: "short",
                    year: "numeric"
                  })
                  
                  return (
                    <button
                      key={cycle.id}
                      onClick={() => setSelectedCycleId(cycle.id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between group ${
                        isSelected
                          ? "bg-purple-600/20 border-purple-500/40 text-white shadow-lg shadow-purple-650/5"
                          : "bg-white/[0.02] border-white/5 text-white/60 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="space-y-1">
                        <span className="text-xs font-black uppercase tracking-widest block text-purple-400">Cycle #{cycle.id}</span>
                        <span className="text-sm font-bold block">Ended: {cycleEndDate}</span>
                      </div>
                      <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? "text-purple-400 translate-x-1" : "text-white/20 group-hover:translate-x-1"}`} />
                    </button>
                  )
                })}
              </div>
            </div>

            {/* MAIN WINNER DETAILS */}
            <div className="lg:col-span-3 space-y-6">
              <div className="glass border-white/10 rounded-[2.5rem] overflow-hidden relative">
                {/* Card Header with Bulk Action */}
                <div className="p-6 md:p-8 border-b border-white/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/[0.01]">
                  <div>
                    <h3 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      Winners of Cycle #{selectedCycleId}
                    </h3>
                    <p className="text-white/40 text-xs mt-1">Total {activeCycleWinners.length} winner entries detected.</p>
                  </div>
                  {pendingCount > 0 && (
                    <Button
                      onClick={handleApproveCycleAll}
                      disabled={bulkLoading}
                      className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-purple-600/20 px-6 h-12"
                    >
                      {bulkLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      Approve All ({pendingCount} Winners)
                    </Button>
                  )}
                </div>

                {/* Table list */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/[0.02]">
                        <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">Rank</th>
                        <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Category</th>
                        <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Username</th>
                        <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Score</th>
                        <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Reward Points</th>
                        <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">Status</th>
                        <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-medium text-sm">
                      {activeCycleWinners.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-10 text-center text-white/40">
                            No winner data for this cycle.
                          </td>
                        </tr>
                      ) : (
                        activeCycleWinners.map((winner) => {
                          const isPending = winner.payout_status === "pending_approval"
                          const isApproved = winner.payout_status === "approved"
                          
                          return (
                            <tr key={winner.id} className="hover:bg-white/[0.01] transition-colors">
                              {/* Rank Column */}
                              <td className="p-5 text-center">
                                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-black ${
                                  winner.rank === 1 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                                  winner.rank === 2 ? "bg-slate-350/20 text-slate-300 border border-slate-300/30" :
                                  winner.rank === 3 ? "bg-amber-700/20 text-amber-500 border border-amber-700/30" :
                                  "bg-white/5 text-white/60"
                                }`}>
                                  #{winner.rank}
                                </span>
                              </td>

                              {/* Type Column */}
                              <td className="p-5">
                                <span className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                  winner.leaderboard_type === 'faucet_shortlink'
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : winner.leaderboard_type === 'offerwall'
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    : "bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20"
                                }`}>
                                  {winner.leaderboard_type === 'faucet_shortlink' && (
                                    <>
                                      <Coins className="w-3 h-3" />
                                      Faucet & Shortlink
                                    </>
                                  )}
                                  {winner.leaderboard_type === 'offerwall' && (
                                    <>
                                      <Gamepad2 className="w-3 h-3" />
                                      Offerwall
                                    </>
                                  )}
                                  {winner.leaderboard_type === 'referral' && (
                                    <>
                                      <Users className="w-3 h-3" />
                                      Referral
                                    </>
                                  )}
                                </span>
                              </td>

                              {/* Username */}
                              <td className="p-5 text-white font-bold">{winner.username}</td>

                              {/* Score */}
                              <td className="p-5 text-white/60 font-mono text-xs">
                                {winner.score.toLocaleString("id-ID")}{" "}
                                <span className="text-[10px] text-white/30 font-sans font-medium uppercase">
                                  {winner.leaderboard_type === 'referral' ? 'refs' : 'points'}
                                </span>
                              </td>

                              {/* Reward Points */}
                              <td className="p-5 text-purple-400 font-black font-mono">
                                +{winner.reward_points.toLocaleString("id-ID")}
                              </td>

                              {/* Status */}
                              <td className="p-5 text-center">
                                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-[10px] font-black uppercase tracking-wider border
                                  ${isApproved 
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                  }`}
                                >
                                  {isApproved ? "Paid" : "Pending Approval"}
                                </span>
                              </td>

                              {/* Action Button */}
                              <td className="p-5 text-center">
                                {isPending && winner.reward_points > 0 ? (
                                  <Button
                                    onClick={() => handleApproveWinner(winner.id)}
                                    disabled={actionLoadingId === winner.id || bulkLoading}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 rounded-xl border border-purple-500/20 hover:bg-purple-600 hover:text-white hover:border-transparent text-purple-400 font-black text-[10px] uppercase tracking-wider px-3 gap-1"
                                  >
                                    {actionLoadingId === winner.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <Check className="w-3 h-3" />
                                    )}
                                    Approve
                                  </Button>
                                ) : (
                                  <span className="text-xs text-white/20">-</span>
                                )}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )
      ) : (
        /* ==================== TAB 2: CONFIG & RESET ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          {/* CONFIGURATION FORM */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="glass border-white/10 rounded-[2rem] overflow-hidden shadow-xl">
              <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.01]">
                <h3 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-400" />
                  Rewards Configuration
                </h3>
                <p className="text-white/40 text-xs mt-1">Set winner limits and reward points for each leaderboard category. Rewards must be numbers separated by commas (starting from Rank 1).</p>
              </div>
              <CardContent className="p-6 md:p-8 space-y-6">
                
                {/* 1. FAUCET & SHORTLINK CONFIG */}
                <div className="space-y-3">
                  <h4 className="text-sm font-black uppercase text-emerald-400 flex items-center gap-1.5">
                    <Coins className="w-4 h-4" />
                    Faucet & Shortlink
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-wider">Winners Count</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={faucetLimit}
                        onChange={(e) => setFaucetLimit(parseInt(e.target.value, 10) || 1)}
                        className="w-full h-11 px-4 rounded-xl bg-white/[0.02] border border-white/10 text-white text-sm font-bold focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-wider">Rewards per Rank (Rank 1, 2, 3...)</label>
                      <textarea
                        rows={2}
                        value={faucetRewards}
                        onChange={(e) => setFaucetRewards(e.target.value)}
                        placeholder="200000, 150000, 100000..."
                        className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* 2. REFERRAL CONFIG */}
                <div className="space-y-3">
                  <h4 className="text-sm font-black uppercase text-fuchsia-400 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Referral
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-wider">Winners Count</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={referralLimit}
                        onChange={(e) => setReferralLimit(parseInt(e.target.value, 10) || 1)}
                        className="w-full h-11 px-4 rounded-xl bg-white/[0.02] border border-white/10 text-white text-sm font-bold focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-wider">Rewards per Rank (Rank 1, 2, 3...)</label>
                      <textarea
                        rows={2}
                        value={referralRewards}
                        onChange={(e) => setReferralRewards(e.target.value)}
                        placeholder="300000, 200000, 150000..."
                        className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                <hr className="border-white/5" />

                {/* 3. OFFERWALL CONFIG */}
                <div className="space-y-3">
                  <h4 className="text-sm font-black uppercase text-amber-400 flex items-center gap-1.5">
                    <Gamepad2 className="w-4 h-4" />
                    Offerwall
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-wider">Winners Count</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={offerwallLimit}
                        onChange={(e) => setOfferwallLimit(parseInt(e.target.value, 10) || 1)}
                        className="w-full h-11 px-4 rounded-xl bg-white/[0.02] border border-white/10 text-white text-sm font-bold focus:outline-none focus:border-purple-500/50 transition-colors"
                      />
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className="text-[10px] font-black text-white/40 uppercase tracking-wider">Rewards per Rank (Rank 1, 2, 3...)</label>
                      <textarea
                        rows={2}
                        value={offerwallRewards}
                        onChange={(e) => setOfferwallRewards(e.target.value)}
                        placeholder="300000, 200000, 150000..."
                        className="w-full p-3 rounded-xl bg-white/[0.02] border border-white/10 text-white text-xs font-mono focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <Button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-purple-600/20 px-8 h-12"
                  >
                    {savingSettings ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* DANGER AREA: RESET LEADERBOARD */}
          <div className="lg:col-span-1">
            <Card className="border border-red-500/25 bg-red-500/5 rounded-[2rem] overflow-hidden shadow-xl">
              <div className="p-6 md:p-8 border-b border-red-500/20 bg-red-500/5">
                <h3 className="text-xl font-black uppercase tracking-wider flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  Danger Zone
                </h3>
                <p className="text-red-300/40 text-xs mt-1">Manual execution tool for resetting active leaderboard cycle.</p>
              </div>
              <CardContent className="p-6 md:p-8 space-y-6">
                <p className="text-white/60 text-xs leading-relaxed">
                  Resetting the leaderboard will close the current active cycle, calculate standings, and snapshot the top players based on the configured winners count. The rewards will be prepared as <strong>pending approval</strong> for you to distribute.
                </p>

                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-[10px] font-bold text-red-300 leading-tight">
                    Warning: This action is permanent and cannot be undone. Standings score will be cleared for the new cycle.
                  </span>
                </div>

                <AnimatePresence>
                  {showResetConfirm ? (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-4 overflow-hidden"
                    >
                      <p className="text-xs text-red-400 font-bold uppercase tracking-wider text-center">Type &quot;RESET&quot; below to confirm:</p>
                      <input
                        type="text"
                        placeholder="RESET"
                        id="confirm_reset_text"
                        onChange={(e) => {
                          const btn = document.getElementById("execute_reset_btn") as HTMLButtonElement
                          if (btn) btn.disabled = e.target.value !== "RESET"
                        }}
                        className="w-full h-11 px-4 text-center rounded-xl bg-white/[0.02] border border-red-500/35 text-white text-sm font-mono focus:outline-none"
                      />
                      <div className="grid grid-cols-2 gap-3">
                        <Button
                          onClick={() => setShowResetConfirm(false)}
                          variant="ghost"
                          className="rounded-xl border border-white/5 text-white/60 hover:text-white"
                        >
                          Cancel
                        </Button>
                        <Button
                          id="execute_reset_btn"
                          disabled={true}
                          onClick={handleResetCycle}
                          className="rounded-xl bg-red-600 hover:bg-red-700 text-white font-black"
                        >
                          {resettingCycle ? <Loader2 className="w-4 h-4 animate-spin" /> : "EXECUTE RESET"}
                        </Button>
                      </div>
                    </motion.div>
                  ) : (
                    <Button
                      onClick={() => setShowResetConfirm(true)}
                      className="w-full rounded-2xl bg-red-950/40 hover:bg-red-900/40 border border-red-500/30 text-red-400 font-black text-xs uppercase tracking-widest gap-2 h-12 transition-all shadow-lg shadow-red-950/10"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Reset Leaderboard Cycle
                    </Button>
                  )}
                </AnimatePresence>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
