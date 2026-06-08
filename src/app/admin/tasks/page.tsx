"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, Trash2, Edit2, CheckCircle2, Flame, Link2, Coins, Users, Trophy } from "lucide-react"
import { toast } from "sonner"

interface Task {
  id: string
  title: string
  task_type: string
  target_count: number
  reward_points: number
  reward_xp: number
  period: string
  is_active: boolean
}

export default function AdminTasksPage() {
  const { isAdmin } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])

  // Form State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState("")
  const [taskType, setTaskType] = useState("faucet_claims")
  const [targetCount, setTargetCount] = useState(5)
  const [rewardPoints, setRewardPoints] = useState(200)
  const [rewardXp, setRewardXp] = useState(10)
  const [period, setPeriod] = useState("daily")
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    if (!isAdmin) {
      router.push("/")
    } else {
      fetchTasks()
    }
  }, [isAdmin, router])

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("period", { ascending: true })
        .order("reward_points", { ascending: false })

      if (error) throw error
      setTasks(data || [])
    } catch (e: any) {
      toast.error("Failed to load tasks: " + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title) {
      toast.error("Please enter a task title")
      return
    }

    setIsSaving(true)
    try {
      const taskData = {
        title,
        task_type: taskType,
        target_count: Number(targetCount),
        reward_points: Number(rewardPoints),
        reward_xp: Number(rewardXp),
        period,
        is_active: isActive,
        updated_at: new Date().toISOString(),
      }

      if (editingId) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", editingId)

        if (error) throw error
        toast.success("Task updated successfully!")
      } else {
        const { error } = await supabase
          .from("tasks")
          .insert([taskData])

        if (error) throw error
        toast.success("Task created successfully!")
      }

      // Reset form
      setEditingId(null)
      setTitle("")
      setTaskType("faucet_claims")
      setTargetCount(5)
      setRewardPoints(200)
      setRewardXp(10)
      setPeriod("daily")
      setIsActive(true)

      fetchTasks()
    } catch (e: any) {
      toast.error("Failed to save task: " + e.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (task: Task) => {
    setEditingId(task.id)
    setTitle(task.title)
    setTaskType(task.task_type)
    setTargetCount(task.target_count)
    setRewardPoints(task.reward_points)
    setRewardXp(task.reward_xp)
    setPeriod(task.period)
    setIsActive(task.is_active)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id)

      if (error) throw error
      toast.success("Task deleted successfully!")
      fetchTasks()
    } catch (e: any) {
      toast.error("Failed to delete task: " + e.message)
    }
  }

  const handleToggleActive = async (task: Task) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ is_active: !task.is_active })
        .eq("id", task.id)

      if (error) throw error
      toast.success(task.is_active ? "Task deactivated" : "Task activated")
      fetchTasks()
    } catch (e: any) {
      toast.error("Failed to toggle status: " + e.message)
    }
  }

  const getTaskIcon = (type: string) => {
    switch (type) {
      case "faucet_claims":
        return <Flame className="w-4 h-4 text-purple-400" />
      case "shortlink_claims":
        return <Link2 className="w-4 h-4 text-cyan-400" />
      case "offerwall_points":
        return <Coins className="w-4 h-4 text-amber-400" />
      case "referrals":
        return <Users className="w-4 h-4 text-fuchsia-400" />
      case "daily_tasks_completed":
        return <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      default:
        return <Trophy className="w-4 h-4 text-primary" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#020617] p-6 md:p-10 space-y-10">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
          Admin Tasks Management
        </h1>
        <p className="text-sm text-white/50 font-bold uppercase tracking-wider">
          Configure daily and weekly task incentives
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Create / Edit Form */}
        <Card className="glass border-white/10 rounded-[2rem] h-fit">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white uppercase italic">
              {editingId ? "Edit Task" : "Create Task"}
            </CardTitle>
            <CardDescription className="text-white/40">
              {editingId ? "Update existing task details" : "Add a new incentivized task for users"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Task Title</label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Claim Faucet 10 Times"
                  className="rounded-xl border-white/10 bg-white/5 text-white"
                />
              </div>

              {/* Task Type */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Task Type</label>
                <select
                  value={taskType}
                  onChange={(e) => setTaskType(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-primary"
                >
                  <option value="faucet_claims" className="bg-[#020617]">Faucet Claims</option>
                  <option value="shortlink_claims" className="bg-[#020617]">Shortlink Claims</option>
                  <option value="offerwall_points" className="bg-[#020617]">Offerwall Points Earned</option>
                  <option value="referrals" className="bg-[#020617]">Referrals Invited</option>
                  <option value="daily_tasks_completed" className="bg-[#020617]">Completed Daily Tasks</option>
                </select>
              </div>

              {/* Targets and Rewards row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Target</label>
                  <Input
                    type="number"
                    value={targetCount}
                    onChange={(e) => setTargetCount(Number(e.target.value))}
                    min={1}
                    className="rounded-xl border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Reward Pts</label>
                  <Input
                    type="number"
                    value={rewardPoints}
                    onChange={(e) => setRewardPoints(Number(e.target.value))}
                    min={0}
                    className="rounded-xl border-white/10 bg-white/5 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Reward XP</label>
                  <Input
                    type="number"
                    value={rewardXp}
                    onChange={(e) => setRewardXp(Number(e.target.value))}
                    min={0}
                    className="rounded-xl border-white/10 bg-white/5 text-white"
                  />
                </div>
              </div>

              {/* Period */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-white/40">Reset Period</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-white text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="period"
                      value="daily"
                      checked={period === "daily"}
                      onChange={() => setPeriod("daily")}
                      className="accent-primary"
                    />
                    Daily
                  </label>
                  <label className="flex items-center gap-2 text-white text-xs cursor-pointer">
                    <input
                      type="radio"
                      name="period"
                      value="weekly"
                      checked={period === "weekly"}
                      onChange={() => setPeriod("weekly")}
                      className="accent-primary"
                    />
                    Weekly
                  </label>
                </div>
              </div>

              {/* Is Active */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-xs font-black uppercase tracking-wider text-white/60">Active Status</span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>

              {/* Buttons */}
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 rounded-xl bg-primary text-white font-bold"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : editingId ? "Update" : "Create"}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setEditingId(null)
                      setTitle("")
                    }}
                    className="rounded-xl hover:bg-white/5 text-white/60"
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Existing Tasks List */}
        <Card className="glass border-white/10 rounded-[2rem] lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white uppercase italic">Existing Tasks</CardTitle>
            <CardDescription className="text-white/40">List of all active/inactive tasks</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-white/40 uppercase font-black tracking-widest text-[9px]">
                  <th className="pb-3">Title</th>
                  <th className="pb-3">Type</th>
                  <th className="pb-3">Target</th>
                  <th className="pb-3">Reward</th>
                  <th className="pb-3">Period</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {tasks.map((task) => (
                  <tr key={task.id} className="text-white/80 hover:bg-white/[0.02]">
                    <td className="py-4 font-bold max-w-[150px] truncate">{task.title}</td>
                    <td className="py-4">
                      <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                        {getTaskIcon(task.task_type)}
                        {task.task_type.replace("_", " ")}
                      </div>
                    </td>
                    <td className="py-4 font-mono font-bold">{task.target_count}</td>
                    <td className="py-4 font-mono font-bold">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-amber-400">+{task.reward_points} Pts</span>
                        <span className="text-cyan-400">+{task.reward_xp} XP</span>
                      </div>
                    </td>
                    <td className="py-4">
                      <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        task.period === "daily" ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}>
                        {task.period}
                      </span>
                    </td>
                    <td className="py-4">
                      <Switch
                        checked={task.is_active}
                        onCheckedChange={() => handleToggleActive(task)}
                      />
                    </td>
                    <td className="py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(task)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-rose-500/80 hover:text-rose-400 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-white/30 font-bold">
                      No tasks created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
