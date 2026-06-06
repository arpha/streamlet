"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { 
  Trophy, 
  Users, 
  TrendingUp, 
  Sparkles, 
  HelpCircle, 
  Calendar,
  AlertCircle,
  Clock,
  ShieldCheck,
  ChevronDown,
  Loader2,
  Coins
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"

interface Cycle {
  id: number
  start_at: string
  end_at: string
}

interface LeaderboardUser {
  username: string
  total_points?: number
  total_referrals?: number
  total_claims?: number
  rank: number
  estimated_prize: number
}

interface PastWinner {
  id: number
  cycle_id: number
  leaderboard_type: 'shortlink' | 'referral'
  username: string
  score: number
  rank: number
  reward_points: number
  payout_status: 'pending_approval' | 'approved' | 'rejected'
}

export default function LeaderboardPage() {
  const { id: userId, isAdmin } = useStore()
  
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'shortlink' | 'referral'>('shortlink')
  
  const [cycle, setCycle] = useState<Cycle | null>(null)
  const [shortlinkList, setShortlinkList] = useState<LeaderboardUser[]>([])
  const [referralList, setReferralList] = useState<LeaderboardUser[]>([])
  
  const [pastCycles, setPastCycles] = useState<Cycle[]>([])
  const [pastWinners, setPastWinners] = useState<PastWinner[]>([])
  const [selectedPastCycleId, setSelectedPastCycleId] = useState<number | null>(null)
  
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number } | null>(null)

  const supabase = createClient()

  useEffect(() => {
    async function loadData() {
      try {
        const { data, error } = await supabase.rpc("get_leaderboards")
        if (error) throw error

        if (data) {
          setCycle({
            id: data.cycle_id,
            start_at: data.start_at,
            end_at: data.end_at
          })
          setShortlinkList(data.shortlink_leaderboard || [])
          setReferralList(data.referral_leaderboard || [])
          setPastCycles(data.past_cycles || [])
          setPastWinners(data.past_winners || [])
          
          if (data.past_cycles && data.past_cycles.length > 0) {
            setSelectedPastCycleId(data.past_cycles[0].id)
          }
        }
      } catch (err) {
        console.error("Failed to load leaderboard:", err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  // Timer countdown effect
  useEffect(() => {
    if (!cycle?.end_at) return

    const calculateTimeLeft = () => {
      const difference = new Date(cycle.end_at).getTime() - new Date().getTime()
      
      if (difference <= 0) {
        return { days: 0, hours: 0, minutes: 0, seconds: 0 }
      }

      return {
        days: Math.floor(difference / (1000 * 60 * 60 * 24)),
        hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((difference / 1000 / 60) % 60),
        seconds: Math.floor((difference / 1000) % 60)
      }
    }

    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [cycle])

  const activeList = activeTab === 'shortlink' ? shortlinkList : referralList

  // Helper values for podium
  const rank1 = activeList.find(u => u.rank === 1)
  const rank2 = activeList.find(u => u.rank === 2)
  const rank3 = activeList.find(u => u.rank === 3)
  const tableList = activeList.filter(u => u.rank > 3)

  // Past winners for selection
  const filteredPastWinners = pastWinners.filter(w => w.cycle_id === selectedPastCycleId)
  const pastShortlinkWinners = filteredPastWinners.filter(w => w.leaderboard_type === 'shortlink')
  const pastReferralWinners = filteredPastWinners.filter(w => w.leaderboard_type === 'referral')

  const prizePool = [
    300000, 200000, 150000, 100000, 75000, 
    50000, 40000, 35000, 30000, 20000
  ]

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">Loading latest standings...</span>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10 text-white min-h-screen">
      {/* HEADER WITH META */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest">
            <Trophy className="w-3.5 h-3.5" />
            COMPETITION ARENA
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase">STREAMLET LEADERBOARD</h2>
          <p className="text-white/60 font-medium italic">Collect as many points as possible and win up to 300,000 points!</p>
        </div>

        {isAdmin && (
          <Link href="/admin/leaderboard">
            <Button className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-purple-600/20 h-12">
              <ShieldCheck className="w-4 h-4" />
              Manage Payouts
            </Button>
          </Link>
        )}
      </div>

      {/* COUNTDOWN TIMER BAR */}
      {timeLeft && (
        <div className="glass border-white/10 rounded-3xl p-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden bg-gradient-to-r from-purple-950/20 to-fuchsia-950/20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Clock className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-black uppercase tracking-widest text-purple-400">Active Cycle #{cycle?.id}</span>
              <h4 className="text-base font-bold text-white mt-0.5">Time Remaining Before Reset</h4>
            </div>
          </div>

          <div className="flex gap-4">
            {[
              { label: "Days", value: timeLeft.days },
              { label: "Hours", value: timeLeft.hours },
              { label: "Minutes", value: timeLeft.minutes },
              { label: "Seconds", value: timeLeft.seconds }
            ].map((t) => (
              <div key={t.label} className="w-16 h-18 md:w-20 md:h-22 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center">
                <span className="text-2xl md:text-3xl font-black font-mono text-purple-300">
                  {t.value.toString().padStart(2, "0")}
                </span>
                <span className="text-[10px] md:text-xs font-bold text-white/40 uppercase mt-1">
                  {t.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {/* TABS SELECTOR */}
      <div className="flex justify-center">
        <div className="inline-flex p-1.5 bg-white/[0.02] border border-white/5 rounded-2xl gap-2">
          <button
            onClick={() => setActiveTab('shortlink')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              activeTab === 'shortlink'
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "text-white/40 hover:text-white"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Shortlinks
          </button>
          <button
            onClick={() => setActiveTab('referral')}
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${
              activeTab === 'referral'
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "text-white/40 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" />
            Referrals
          </button>
        </div>
      </div>

      {/* MAIN RANK STANDINGS */}
      <div className="space-y-12">
        {activeList.length === 0 ? (
          <div className="glass border-white/10 rounded-[2.5rem] p-20 text-center flex flex-col items-center justify-center">
            <Trophy className="w-16 h-16 text-white/10 mb-4 animate-bounce" />
            <h4 className="text-lg font-black uppercase text-white/60">No activity on this leaderboard yet</h4>
            <p className="text-white/40 text-sm mt-1 max-w-sm">Be the first to complete tasks and secure the top spot in this cycle!</p>
          </div>
        ) : (
          <div className="space-y-10">
            {/* PODIUM SECTION (TOP 3) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto pt-6 px-4">
              {/* RANK 2 */}
              <div className="order-2 md:order-1 flex flex-col items-center">
                {rank2 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="w-full flex flex-col items-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-slate-500/10 border-2 border-slate-400 flex items-center justify-center shadow-lg relative mb-3">
                      <span className="text-2xl font-black text-slate-300">2</span>
                      <div className="absolute -top-3 bg-slate-400 text-slate-950 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">SILVER</div>
                    </div>
                    <span className="font-bold text-sm text-white max-w-[150px] truncate">{rank2.username}</span>
                    <span className="text-xs text-white/40 font-mono mt-0.5">
                      {activeTab === 'shortlink' ? `${rank2.total_points?.toLocaleString("id-ID")} Pts` : `${rank2.total_referrals} Refs`}
                    </span>
                    
                    {/* Podium block */}
                    <div className="w-full h-28 bg-gradient-to-t from-slate-900/50 to-slate-800/20 border-t border-slate-500/20 rounded-t-3xl mt-4 flex flex-col items-center justify-center p-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Cycle Reward</span>
                      <span className="text-lg font-black text-slate-300 font-mono mt-1">+{prizePool[1].toLocaleString("id-ID")} Pts</span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="w-full h-28 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl mt-4" />
                )}
              </div>

              {/* RANK 1 */}
              <div className="order-1 md:order-2 flex flex-col items-center relative">
                {rank1 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full flex flex-col items-center z-10"
                  >
                    <div className="w-20 h-20 rounded-full bg-amber-500/10 border-2 border-amber-400 flex items-center justify-center shadow-2xl relative mb-3 shadow-amber-500/10">
                      <span className="text-3xl font-black text-amber-300">1</span>
                      <div className="absolute -top-3 bg-amber-400 text-amber-950 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full flex items-center gap-1 shadow-lg shadow-amber-400/20">
                        <Sparkles className="w-3 h-3 animate-spin" /> GOLD
                      </div>
                    </div>
                    <span className="font-black text-base text-white max-w-[180px] truncate">{rank1.username}</span>
                    <span className="text-xs text-amber-400 font-bold font-mono mt-0.5">
                      {activeTab === 'shortlink' ? `${rank1.total_points?.toLocaleString("id-ID")} Pts` : `${rank1.total_referrals} Refs`}
                    </span>
                    
                    {/* Podium block */}
                    <div className="w-full h-36 bg-gradient-to-t from-amber-950/20 to-amber-900/5 border-t border-amber-500/30 rounded-t-3xl mt-4 flex flex-col items-center justify-center p-4 active-glow shadow-2xl shadow-amber-500/5">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">Cycle Reward</span>
                      <span className="text-xl font-black text-amber-300 font-mono mt-1">+{prizePool[0].toLocaleString("id-ID")} Pts</span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="w-full h-36 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl mt-4" />
                )}
              </div>

              {/* RANK 3 */}
              <div className="order-3 flex flex-col items-center">
                {rank3 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full flex flex-col items-center"
                  >
                    <div className="w-16 h-16 rounded-full bg-amber-800/10 border-2 border-amber-700/80 flex items-center justify-center shadow-lg relative mb-3">
                      <span className="text-2xl font-black text-amber-600">3</span>
                      <div className="absolute -top-3 bg-amber-750 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full">BRONZE</div>
                    </div>
                    <span className="font-bold text-sm text-white max-w-[150px] truncate">{rank3.username}</span>
                    <span className="text-xs text-white/40 font-mono mt-0.5">
                      {activeTab === 'shortlink' ? `${rank3.total_points?.toLocaleString("id-ID")} Pts` : `${rank3.total_referrals} Refs`}
                    </span>
                    
                    {/* Podium block */}
                    <div className="w-full h-24 bg-gradient-to-t from-amber-950/20 to-amber-950/5 border-t border-amber-700/20 rounded-t-3xl mt-4 flex flex-col items-center justify-center p-4">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block">Cycle Reward</span>
                      <span className="text-lg font-black text-amber-500 font-mono mt-1">+{prizePool[2].toLocaleString("id-ID")} Pts</span>
                    </div>
                  </motion.div>
                ) : (
                  <div className="w-full h-24 bg-white/[0.01] border border-dashed border-white/5 rounded-3xl mt-4" />
                )}
              </div>
            </div>

            {/* RANK TABLE FOR 4-10 */}
            {tableList.length > 0 && (
              <div className="glass border-white/10 rounded-[2.5rem] overflow-hidden max-w-4xl mx-auto shadow-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.01]">
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-center w-20">Rank</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Username</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Score</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Estimated Reward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium text-sm">
                    {tableList.map((user) => (
                      <tr key={user.username} className="hover:bg-white/[0.005] transition-colors">
                        <td className="p-5 text-center font-bold text-white/60">#{user.rank}</td>
                        <td className="p-5 text-white font-bold">{user.username}</td>
                        <td className="p-5 text-white/60 font-mono text-xs">
                          {activeTab === 'shortlink' 
                            ? `${user.total_points?.toLocaleString("id-ID")} Pts (${user.total_claims} Claims)`
                            : `${user.total_referrals} Referrals`
                          }
                        </td>
                        <td className="p-5 text-purple-400 font-black font-mono">
                          +{user.estimated_prize.toLocaleString("id-ID")} Pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* RULES & INSTRUCTIONS BOX */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden">
          <CardHeader className="p-6 md:p-8 border-b border-white/5 bg-white/[0.01]">
            <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              SHORTLINK RULES
            </CardTitle>
            <CardDescription className="text-white/40 font-medium italic">How shortlink leaderboard scores are calculated.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-4 text-sm text-white/60">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Shortlink leaderboard is calculated based on the total points earned from completing shortlink visits from any provider.</p>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>The calculated scores **include additional point bonuses based on your rank level** (Silver +5%, Platinum +10%, Diamond +15%).</p>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Points earned from referral commissions are **not included** in the Shortlink Leaderboard score.</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden">
          <CardHeader className="p-6 md:p-8 border-b border-white/5 bg-white/[0.01]">
            <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              REFERRAL RULES
            </CardTitle>
            <CardDescription className="text-white/40 font-medium italic">How referral leaderboard scores are calculated.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-4 text-sm text-white/60">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Referral leaderboard is calculated based on the number of new friends you invite (registered with your referral code) during the active cycle.</p>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Referred accounts are only valid and counted if **they have collected at least 100 XP** (to prevent fake or spam accounts).</p>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Prizes are automatically logged at the end of the 30-day cycle, and rankings will reset. Referrals from past cycles are not carried over.</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PAST WINNERS LOG ARCHIVE */}
      {pastCycles.length > 0 && (
        <div className="glass border-white/10 rounded-[2.5rem] p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-white/5 pb-6 bg-white/[0.01]">
            <div>
              <h3 className="text-xl font-black uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-5 h-5 text-purple-400" />
                PREVIOUS CYCLE WINNERS
              </h3>
              <p className="text-white/40 text-xs mt-1">List of winners and payout distribution status from completed cycles.</p>
            </div>

            <div className="relative inline-block w-48">
              <select
                value={selectedPastCycleId || ""}
                onChange={(e) => setSelectedPastCycleId(Number(e.target.value))}
                className="w-full h-11 px-4 rounded-xl bg-white/[0.02] border border-white/10 text-white text-xs font-bold uppercase tracking-wider focus:outline-none appearance-none cursor-pointer"
              >
                {pastCycles.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-950 text-white">
                    Cycle #{c.id}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-white/40 absolute right-3 top-3.5 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* PAST SHORTLINK WINNERS */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-blue-400 flex items-center gap-1.5 px-2">
                <TrendingUp className="w-4 h-4" />
                Shortlink Winners (Cycle #{selectedPastCycleId})
              </h4>
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                {pastShortlinkWinners.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40">No data available for this category.</div>
                ) : (
                  pastShortlinkWinners.map((winner) => (
                    <div key={winner.id} className="p-4 flex items-center justify-between hover:bg-white/[0.005] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-white/40 w-6">#{winner.rank}</span>
                        <span className="font-bold text-sm text-white">{winner.username}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-purple-400 font-bold">+{winner.reward_points.toLocaleString("id-ID")} Pts</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          winner.payout_status === 'approved' 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {winner.payout_status === 'approved' ? "Paid" : "Pending"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* PAST REFERRAL WINNERS */}
            <div className="space-y-4">
              <h4 className="text-xs font-black uppercase tracking-widest text-fuchsia-400 flex items-center gap-1.5 px-2">
                <Users className="w-4 h-4" />
                Referral Winners (Cycle #{selectedPastCycleId})
              </h4>
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                {pastReferralWinners.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40">No data available for this category.</div>
                ) : (
                  pastReferralWinners.map((winner) => (
                    <div key={winner.id} className="p-4 flex items-center justify-between hover:bg-white/[0.005] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-white/40 w-6">#{winner.rank}</span>
                        <span className="font-bold text-sm text-white">{winner.username}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-purple-400 font-bold">+{winner.reward_points.toLocaleString("id-ID")} Pts</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          winner.payout_status === 'approved' 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {winner.payout_status === 'approved' ? "Paid" : "Pending"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
