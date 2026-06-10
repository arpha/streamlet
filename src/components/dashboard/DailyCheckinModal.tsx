"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { Gift, CheckCircle2, Lock, Zap, Ticket, Sparkles, CalendarCheck } from "lucide-react"

interface DailyCheckinModalProps {
  isOpen: boolean
  onClose: () => void
  lastCheckinAt: string | null
  streak: number
  onCheckinSuccess: (newStreak: number, lastCheckin: string) => void
}

const REWARDS = [
  { day: 1, xp: 5, tickets: 0 },
  { day: 2, xp: 10, tickets: 0 },
  { day: 3, xp: 15, tickets: 0 },
  { day: 4, xp: 20, tickets: 0 },
  { day: 5, xp: 30, tickets: 0 },
  { day: 6, xp: 40, tickets: 0 },
  { day: 7, xp: 50, tickets: 1 },
]

export function DailyCheckinModal({
  isOpen,
  onClose,
  lastCheckinAt,
  streak,
  onCheckinSuccess,
}: DailyCheckinModalProps) {
  const supabase = createClient()
  const { setXp, setEventTickets } = useStore()
  const [loading, setLoading] = useState(false)
  const [claimingDay, setClaimingDay] = useState<number | null>(null)

  // Hitung status check-in hari ini
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0) // 00:00 UTC / 07:00 WIB
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  const lastCheckin = lastCheckinAt ? new Date(lastCheckinAt) : null
  const hasCheckedInToday = lastCheckin && lastCheckin >= todayStart

  // Tentukan hari aktif yang bisa diklaim hari ini
  let activeDay = 1
  if (hasCheckedInToday) {
    activeDay = -1 // sudah absen
  } else if (lastCheckin && lastCheckin >= yesterdayStart) {
    activeDay = streak >= 7 ? 1 : streak + 1
  } else {
    activeDay = 1 // bolos atau baru pertama kali
  }

  const handleClaim = async (dayNum: number) => {
    if (loading || activeDay !== dayNum) return
    setLoading(true)
    setClaimingDay(dayNum)

    // Trigger popunder ad dynamically on daily check-in claim click
    if (typeof window !== "undefined" && !document.getElementById('popunder-ad-script')) {
      const script = document.createElement('script')
      script.id = 'popunder-ad-script'
      script.src = 'https://pl29698487.effectivecpmnetwork.com/66/c3/59/66c3592296a5a47dfcc56ad2915c624d.js'
      script.async = true
      document.body.appendChild(script)
    }

    try {
      const { data, error } = await supabase.rpc("claim_daily_checkin")

      if (error) throw error

      if (data && data.success) {
        // Update store lokal
        setXp(data.new_xp)
        setEventTickets(data.new_tickets)

        // Tampilkan feedback sukses
        toast.success(`Day ${data.streak_day} Check-in Successful!`, {
          description: `You received +${data.reward_xp} XP${
            data.reward_tickets > 0 ? ` & +${data.reward_tickets} Event Ticket!` : "!"
          }`,
          icon: <Sparkles className="w-5 h-5 text-amber-400" />,
        })

        // Hubungi callback parent
        onCheckinSuccess(data.streak_day, new Date().toISOString())
        setTimeout(() => {
          onClose()
        }, 1500)
      } else {
        toast.error(data?.message || "Failed to claim daily check-in.")
      }
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Connection error occurred.")
    } finally {
      setLoading(false)
      setClaimingDay(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass border-white/10 sm:max-w-lg rounded-3xl overflow-hidden bg-[#020617]/95 backdrop-blur-2xl p-6 shadow-[0_25px_50px_rgba(0,0,0,0.8)]">
        
        {/* Dekorasi Background */}
        <div className="absolute -top-12 -left-12 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -right-12 w-40 h-40 bg-fuchsia-600/10 rounded-full blur-3xl pointer-events-none" />

        <DialogHeader className="relative z-10 text-center space-y-2 mb-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center shadow-lg shadow-amber-500/5 animate-pulse">
            <CalendarCheck className="w-7 h-7 text-amber-400" />
          </div>
          <DialogTitle className="text-2xl font-black text-white uppercase tracking-tight italic">
            Daily Check-in
          </DialogTitle>
          <DialogDescription className="text-white/60 font-medium text-xs">
            Check-in daily to collect XP and claim an Event Ticket on Day 7!
          </DialogDescription>
        </DialogHeader>

        {/* Grid Hari 1 - 6 */}
        <div className="grid grid-cols-3 gap-3 relative z-10 mb-4">
          {REWARDS.slice(0, 6).map((r) => {
            const isClaimed = streak >= r.day && (hasCheckedInToday || streak > r.day || activeDay > r.day || activeDay === -1)
            const isActive = activeDay === r.day
            const isLocked = !isClaimed && !isActive

            return (
              <div
                key={r.day}
                onClick={() => isActive && handleClaim(r.day)}
                className={`relative p-3 rounded-2xl border flex flex-col items-center justify-between min-h-[105px] transition-all duration-300 ${
                  isActive
                    ? "bg-gradient-to-b from-primary/10 to-primary/5 border-primary/50 shadow-[0_0_15px_rgba(168,85,247,0.25)] hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
                    : isClaimed
                    ? "bg-emerald-500/5 border-emerald-500/20 opacity-60"
                    : "bg-white/2 border-white/5 opacity-40 cursor-not-allowed"
                }`}
              >
                <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? "text-primary-foreground" : "text-white/40"}`}>
                  Day {r.day}
                </span>

                <div className="my-2">
                  {isClaimed ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                  ) : isActive ? (
                    <Zap className="w-6 h-6 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] animate-bounce" />
                  ) : (
                    <Lock className="w-5 h-5 text-white/30" />
                  )}
                </div>

                <div className="text-center lider-none">
                  <span className={`text-xs font-black ${isActive ? "text-white" : isClaimed ? "text-emerald-400" : "text-white/50"}`}>
                    +{r.xp} XP
                  </span>
                </div>

                {/* Indikator Active */}
                {isActive && (
                  <span className="absolute -top-1.5 -right-1 px-1.5 py-0.5 rounded-md bg-amber-500 text-[8px] font-black text-black uppercase tracking-widest animate-pulse">
                    Claim
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Hari ke-7 (Grand Reward) */}
        {(() => {
          const r7 = REWARDS[6]
          const isClaimed = streak >= 7 && (hasCheckedInToday || activeDay === -1)
          const isActive = activeDay === 7
          const isLocked = !isClaimed && !isActive

          return (
            <div
              onClick={() => isActive && handleClaim(7)}
              className={`relative z-10 p-4 rounded-2xl border flex items-center justify-between transition-all duration-300 ${
                isActive
                  ? "bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 border-amber-500/60 shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:scale-[1.02] active:scale-[0.99] cursor-pointer"
                  : isClaimed
                  ? "bg-emerald-500/5 border-emerald-500/20 opacity-60"
                  : "bg-white/2 border-white/5 opacity-40 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  isActive ? "bg-amber-500/20 border border-amber-500/30" : "bg-white/5 border border-white/5"
                }`}>
                  <Ticket className={`w-6 h-6 ${isActive ? "text-amber-400 animate-pulse" : "text-white/30"}`} />
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? "text-amber-400" : "text-white/40"}`}>
                    Day 7 Grand Reward
                  </span>
                  <span className="text-sm font-black text-white mt-1 flex items-center gap-1.5">
                    +{r7.xp} XP & +1 Event Ticket
                  </span>
                </div>
              </div>

              <div>
                {isClaimed ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold uppercase tracking-widest">
                    <CheckCircle2 className="w-5 h-5 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                    Claimed
                  </div>
                ) : isActive ? (
                  <button className="px-5 py-2 rounded-xl bg-amber-500 text-black font-black text-xs uppercase tracking-widest shadow-lg shadow-amber-500/25 hover:bg-amber-400 transition-colors">
                    {loading ? "..." : "Claim"}
                  </button>
                ) : (
                  <Lock className="w-5 h-5 text-white/30 mr-2" />
                )}
              </div>
            </div>
          )
        })()}

        {/* Footer / Tombol Tutup */}
        <div className="mt-6 flex justify-end relative z-10">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest transition-all border border-white/5 hover:border-white/10"
          >
            Close
          </button>
        </div>

      </DialogContent>
    </Dialog>
  )
}
