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
        console.error("Gagal memuat leaderboard:", err)
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
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">Memuat peringkat terbaru...</span>
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
            Arena Kompetisi
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase">STREAMLET LEADERBOARD</h2>
          <p className="text-white/60 font-medium italic">Kumpulkan poin sebanyak-banyaknya dan rebut hadiah hingga 300k poin gratis!</p>
        </div>

        {isAdmin && (
          <Link href="/admin/leaderboard">
            <Button className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-purple-600/20 h-12">
              <ShieldCheck className="w-4 h-4" />
              Kelola Pembayaran Hadiah
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
              <span className="text-xs font-black uppercase tracking-widest text-purple-400">Siklus Aktif #{cycle?.id}</span>
              <h4 className="text-base font-bold text-white mt-0.5">Waktu Sisa Sebelum Reset Standings</h4>
            </div>
          </div>

          <div className="flex gap-4">
            {[
              { label: "Hari", value: timeLeft.days },
              { label: "Jam", value: timeLeft.hours },
              { label: "Menit", value: timeLeft.minutes },
              { label: "Detik", value: timeLeft.seconds }
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
            Shortlink Leaderboard
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
            Referral Leaderboard
          </button>
        </div>
      </div>

      {/* MAIN RANK STANDINGS */}
      <div className="space-y-12">
        {activeList.length === 0 ? (
          <div className="glass border-white/10 rounded-[2.5rem] p-20 text-center flex flex-col items-center justify-center">
            <Trophy className="w-16 h-16 text-white/10 mb-4 animate-bounce" />
            <h4 className="text-lg font-black uppercase text-white/60">Belum ada aktivitas di papan peringkat</h4>
            <p className="text-white/40 text-sm mt-1 max-w-sm">Jadilah yang pertama untuk menyelesaikan tugas dan mengamankan posisi teratas di siklus ini!</p>
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
                      {activeTab === 'shortlink' ? `${rank2.total_points?.toLocaleString("id-ID")} Poin` : `${rank2.total_referrals} Reff`}
                    </span>
                    
                    {/* Podium block */}
                    <div className="w-full h-28 bg-gradient-to-t from-slate-900/50 to-slate-800/20 border-t border-slate-500/20 rounded-t-3xl mt-4 flex flex-col items-center justify-center p-4">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Hadiah Siklus</span>
                      <span className="text-lg font-black text-slate-300 font-mono mt-1">+{prizePool[1].toLocaleString("id-ID")} Poin</span>
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
                      {activeTab === 'shortlink' ? `${rank1.total_points?.toLocaleString("id-ID")} Poin` : `${rank1.total_referrals} Reff`}
                    </span>
                    
                    {/* Podium block */}
                    <div className="w-full h-36 bg-gradient-to-t from-amber-950/20 to-amber-900/5 border-t border-amber-500/30 rounded-t-3xl mt-4 flex flex-col items-center justify-center p-4 active-glow shadow-2xl shadow-amber-500/5">
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest block">Hadiah Siklus</span>
                      <span className="text-xl font-black text-amber-300 font-mono mt-1">+{prizePool[0].toLocaleString("id-ID")} Poin</span>
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
                      {activeTab === 'shortlink' ? `${rank3.total_points?.toLocaleString("id-ID")} Poin` : `${rank3.total_referrals} Reff`}
                    </span>
                    
                    {/* Podium block */}
                    <div className="w-full h-24 bg-gradient-to-t from-amber-950/20 to-amber-950/5 border-t border-amber-700/20 rounded-t-3xl mt-4 flex flex-col items-center justify-center p-4">
                      <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block">Hadiah Siklus</span>
                      <span className="text-lg font-black text-amber-500 font-mono mt-1">+{prizePool[2].toLocaleString("id-ID")} Poin</span>
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
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Skor</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Estimasi Hadiah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium text-sm">
                    {tableList.map((user) => (
                      <tr key={user.username} className="hover:bg-white/[0.005] transition-colors">
                        <td className="p-5 text-center font-bold text-white/60">#{user.rank}</td>
                        <td className="p-5 text-white font-bold">{user.username}</td>
                        <td className="p-5 text-white/60 font-mono text-xs">
                          {activeTab === 'shortlink' 
                            ? `${user.total_points?.toLocaleString("id-ID")} Poin (${user.total_claims} Klaim)`
                            : `${user.total_referrals} Referral`
                          }
                        </td>
                        <td className="p-5 text-purple-400 font-black font-mono">
                          +{user.estimated_prize.toLocaleString("id-ID")} Poin
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
              ATURAN SHORTLINK
            </CardTitle>
            <CardDescription className="text-white/40 font-medium italic">Bagaimana penghitungan poin leaderboard shortlink bekerja.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-4 text-sm text-white/60">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Leaderboard Shortlink dihitung dari total poin yang Anda dapatkan setelah berhasil menyelesaikan verifikasi shortlink dari penyedia mana pun.</p>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Perolehan poin yang dihitung sudah **termasuk bonus tambahan berdasarkan level rank** akun Anda (Silver +5%, Platinum +10%, Diamond +15%).</p>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Pendapatan komisi dari referral **tidak dihitung** dalam Leaderboard Shortlink (kompetisi murni dari hasil kerja keras individu).</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden">
          <CardHeader className="p-6 md:p-8 border-b border-white/5 bg-white/[0.01]">
            <CardTitle className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-400" />
              ATURAN REFERRAL
            </CardTitle>
            <CardDescription className="text-white/40 font-medium italic">Bagaimana penghitungan syarat poin leaderboard referral bekerja.</CardDescription>
          </CardHeader>
          <CardContent className="p-6 md:p-8 space-y-4 text-sm text-white/60">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Leaderboard Referral dihitung dari jumlah teman baru yang Anda undang (mendaftar melalui kode referral Anda) selama siklus aktif berlangsung.</p>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Referral yang valid dan dihitung adalah **teman yang telah mengumpulkan minimal 1.000 XP** di akun mereka (untuk mencegah akun palsu/spam).</p>
            </div>
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
              <p>Reset data peringkat dilakukan otomatis setiap 30 hari. Jumlah referral yang diklaim di luar siklus tidak akan diakumulasikan kembali.</p>
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
                RIWAYAT PEMENANG SEBELUMNYA
              </h3>
              <p className="text-white/40 text-xs mt-1">Daftar pemenang dan status distribusi hadiah untuk siklus-siklus lampau.</p>
            </div>

            <div className="relative inline-block w-48">
              <select
                value={selectedPastCycleId || ""}
                onChange={(e) => setSelectedPastCycleId(Number(e.target.value))}
                className="w-full h-11 px-4 rounded-xl bg-white/[0.02] border border-white/10 text-white text-xs font-bold uppercase tracking-wider focus:outline-none appearance-none cursor-pointer"
              >
                {pastCycles.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-950 text-white">
                    Siklus #{c.id}
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
                Shortlink Juara (Siklus #{selectedPastCycleId})
              </h4>
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                {pastShortlinkWinners.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40">Tidak ada data untuk kategori ini.</div>
                ) : (
                  pastShortlinkWinners.map((winner) => (
                    <div key={winner.id} className="p-4 flex items-center justify-between hover:bg-white/[0.005] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-white/40 w-6">#{winner.rank}</span>
                        <span className="font-bold text-sm text-white">{winner.username}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-purple-400 font-bold">+{winner.reward_points.toLocaleString("id-ID")} Poin</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          winner.payout_status === 'approved' 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {winner.payout_status === 'approved' ? "Lunas" : "Tertunda"}
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
                Referral Juara (Siklus #{selectedPastCycleId})
              </h4>
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                {pastReferralWinners.length === 0 ? (
                  <div className="p-8 text-center text-xs text-white/40">Tidak ada data untuk kategori ini.</div>
                ) : (
                  pastReferralWinners.map((winner) => (
                    <div key={winner.id} className="p-4 flex items-center justify-between hover:bg-white/[0.005] transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-white/40 w-6">#{winner.rank}</span>
                        <span className="font-bold text-sm text-white">{winner.username}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-mono text-xs text-purple-400 font-bold">+{winner.reward_points.toLocaleString("id-ID")} Poin</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                          winner.payout_status === 'approved' 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        }`}>
                          {winner.payout_status === 'approved' ? "Lunas" : "Tertunda"}
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
