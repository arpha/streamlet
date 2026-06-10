"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Coins, Flame, Link2, Users, CheckCircle2, Clock, Sparkles, Trophy } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

interface TaskProgress {
  task_id: string
  title: string
  task_type: string
  target_count: number
  reward_points: number
  reward_xp: number
  period: string
  current_count: number
  completed: boolean
  claimed: boolean
}

export function DashboardTasksBoard() {
  const { id: userId, setBalance, setXp } = useStore()
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<"daily" | "weekly">("daily")
  const [tasks, setTasks] = useState<TaskProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [dailyCountdown, setDailyCountdown] = useState("")
  const [weeklyCountdown, setWeeklyCountdown] = useState("")

  const fetchTasks = async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase.rpc("get_user_tasks_progress", {
        p_user_id: userId,
      })
      if (error) throw error
      setTasks((data || []) as TaskProgress[])
    } catch (e: any) {
      console.error("Error fetching tasks:", e)
    } finally {
      setLoading(false)
    }
  };

  useEffect(() => {
    fetchTasks()
  }, [userId])

  // Countdown timer calculations
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date()
      
      // Calculate daily reset (00:00 UTC next day)
      const nextDaily = new Date()
      nextDaily.setUTCHours(24, 0, 0, 0)
      const diffDaily = nextDaily.getTime() - now.getTime()
      
      if (diffDaily > 0) {
        const hours = Math.floor(diffDaily / (1000 * 60 * 60))
        const minutes = Math.floor((diffDaily % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diffDaily % (1000 * 60)) / 1000)
        setDailyCountdown(`${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`)
      } else {
        setDailyCountdown("Resetting...")
      }

      // Calculate weekly reset (Monday 00:00 UTC)
      const nextWeekly = new Date()
      const currentDay = nextWeekly.getUTCDay()
      const daysUntilMonday = currentDay === 0 ? 1 : 8 - currentDay
      nextWeekly.setUTCDate(nextWeekly.getUTCDate() + daysUntilMonday)
      nextWeekly.setUTCHours(0, 0, 0, 0)
      
      const diffWeekly = nextWeekly.getTime() - now.getTime()
      if (diffWeekly > 0) {
        const days = Math.floor(diffWeekly / (1000 * 60 * 60 * 24))
        const hours = Math.floor((diffWeekly % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((diffWeekly % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((diffWeekly % (1000 * 60)) / 1000)
        setWeeklyCountdown(`${days}d ${hours.toString().padStart(2, "0")}h ${minutes.toString().padStart(2, "0")}m`)
      } else {
        setWeeklyCountdown("Resetting...")
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleClaim = async (task: TaskProgress) => {
    if (!userId) return
    try {
      const { data, error } = await supabase.rpc("claim_task_reward", {
        p_user_id: userId,
        p_task_id: task.task_id,
      })

      if (error) throw error

      const result = data as any
      if (result.success) {
        toast.success(result.message, {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        })

        // Update local state and store values
        if (result.new_balance !== undefined) {
          setBalance(Number(result.new_balance))
        }

        // Increment local XP based on reward
        useStore.setState((state) => ({ xp: state.xp + task.reward_xp }))

        // Refresh task progress list
        fetchTasks()
      } else {
        toast.error(result.message)
      }
    } catch (e: any) {
      toast.error("Failed to claim reward: " + e.message)
    }
  }

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "faucet_claims":
        return <Flame className="w-5 h-5 text-purple-400" />
      case "shortlink_claims":
        return <Link2 className="w-5 h-5 text-cyan-400" />
      case "offerwall_points":
        return <Coins className="w-5 h-5 text-amber-400" />
      case "referrals":
        return <Users className="w-5 h-5 text-fuchsia-400" />
      case "daily_tasks_completed":
        return <CheckCircle2 className="w-5 h-5 text-emerald-400" />
      default:
        return <Trophy className="w-5 h-5 text-primary" />
    }
  }

  const filteredTasks = tasks.filter((t) => t.period === activeTab)

  if (loading) {
    return (
      <div className="w-full h-48 flex items-center justify-center glass rounded-[2.5rem] border-white/10">
        <Clock className="w-6 h-6 text-primary animate-spin" />
      </div>
    )
  }

  if (tasks.length === 0) return null

  return (
    <div className="space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <Trophy className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
              Tasks Board
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            </h2>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">
              Complete tasks to earn bonus rewards
            </p>
          </div>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
          <button
            onClick={() => setActiveTab("daily")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "daily"
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Daily Tasks
          </button>
          <button
            onClick={() => setActiveTab("weekly")}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === "weekly"
                ? "bg-primary text-white shadow-lg shadow-primary/20"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            Weekly Tasks
          </button>
        </div>
      </div>

      {/* Countdown Alert Banner */}
      <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
        <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-wider">
          <Clock className="w-4 h-4 text-primary" />
          Time left until next reset:
        </div>
        <span className="text-sm font-black font-mono text-primary">
          {activeTab === "daily" ? dailyCountdown : weeklyCountdown}
        </span>
      </div>

      {/* Task Cards Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <AnimatePresence mode="popLayout">
          {filteredTasks.map((task, i) => {
            const percent = Math.min(100, Math.floor((task.current_count / task.target_count) * 100))
            const isReadyToClaim = task.completed && !task.claimed

            return (
              <motion.div
                key={task.task_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3, delay: i * 0.05 }}
                className="glass relative overflow-hidden rounded-[2rem] border-white/10 p-6 flex flex-col justify-between hover:border-white/20 transition-all duration-300 group shadow-lg shadow-black/20"
              >
                {/* Background glow for claimable tasks */}
                {isReadyToClaim && (
                  <div className="absolute inset-0 bg-primary/5 animate-pulse pointer-events-none" />
                )}

                <div className="space-y-4">
                  {/* Title & Icon row */}
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-black text-white text-base tracking-tight leading-snug">
                      {task.title}
                    </h3>
                    <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {getTaskIcon(task.task_type)}
                    </div>
                  </div>

                  {/* Rewards Indicator */}
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 font-black font-mono text-[10px] px-2.5 py-1 rounded-xl">
                      +{task.reward_points} Pts
                    </span>
                    <span className="flex items-center gap-1 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-black font-mono text-[10px] px-2.5 py-1 rounded-xl">
                      +{task.reward_xp} XP
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mt-6">
                  {/* Progress Info */}
                  <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                    <span>Progress</span>
                    <span className="font-mono text-white/80">
                      {task.current_count}/{task.target_count} ({percent}%)
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div
                      style={{ width: `${percent}%` }}
                      className="h-full bg-gradient-to-r from-primary to-fuchsia-600 rounded-full transition-all duration-500"
                    />
                  </div>

                  {/* Action Button */}
                  {task.claimed ? (
                    <div className="w-full h-11 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Claimed
                    </div>
                  ) : (
                    <Button
                      onClick={() => handleClaim(task)}
                      disabled={!task.completed}
                      className={`w-full h-11 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
                        isReadyToClaim
                          ? "bg-gradient-to-r from-primary to-fuchsia-600 hover:from-primary/90 hover:to-fuchsia-600/90 text-white shadow-lg shadow-primary/20 animate-bounce"
                          : "bg-white/5 border border-white/10 text-white/30 cursor-not-allowed hover:bg-white/5"
                      }`}
                      style={isReadyToClaim ? { animationDuration: "2s" } : {}}
                    >
                      {task.completed ? "Claim Reward" : "In Progress"}
                    </Button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>

          {/* Ad slot in empty grid space */}
          <div className="glass relative overflow-hidden rounded-[2rem] border-white/10 flex items-center justify-center min-h-[250px]">
            <div ref={(el) => {
              if (el && !el.dataset.adLoaded) {
                el.dataset.adLoaded = "true"
                const configScript = document.createElement("script")
                configScript.textContent = `atOptions = { 'key': '27c408318ef2976d86d9dd84a5117ce5', 'format': 'iframe', 'height': 250, 'width': 300, 'params': {} };`
                el.appendChild(configScript)
                const adScript = document.createElement("script")
                adScript.src = "https://www.highperformanceformat.com/27c408318ef2976d86d9dd84a5117ce5/invoke.js"
                adScript.async = true
                el.appendChild(adScript)
              }
            }} className="max-w-full overflow-hidden" />
          </div>
      </div>
    </div>
  )
}
