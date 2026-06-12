"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft, Search, Megaphone, Link2, ExternalLink, Play, Pause } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface PtcCampaign {
  id: string
  user_id: string
  title: string
  url: string
  duration: number
  cost_per_view: number
  reward_per_view: number
  total_views: number
  views_completed: number
  daily_views_limit: number | null
  daily_views_completed: number
  status: string
  created_at: string
  profiles: {
    username: string
    email: string
  } | null
}

export default function AdminPtcPage() {
  const { isAdmin } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [campaigns, setCampaigns] = useState<PtcCampaign[]>([])
  
  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [durationFilter, setDurationFilter] = useState("all")

  useEffect(() => {
    if (isAdmin === undefined) return
    if (!isAdmin) {
      toast.error("Access Denied: Admin authorization required.")
      router.push("/")
    } else {
      fetchCampaigns()
    }
  }, [isAdmin, router])

  const fetchCampaigns = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("ptc_campaigns")
        .select(`
          *,
          profiles (
            username,
            email
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setCampaigns((data as any) || [])
    } catch (e: any) {
      toast.error("Failed to load PTC campaigns: " + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggleStatus = async (campaign: PtcCampaign) => {
    try {
      const nextStatus = campaign.status === "active" ? "paused" : "active"
      const { error } = await supabase
        .from("ptc_campaigns")
        .update({ status: nextStatus })
        .eq("id", campaign.id)

      if (error) throw error
      toast.success(`Campaign ${campaign.status === "active" ? "paused" : "activated"} successfully!`)
      fetchCampaigns()
    } catch (e: any) {
      toast.error("Failed to toggle status: " + e.message)
    }
  }

  // Filter logic
  const filteredCampaigns = campaigns.filter((camp) => {
    const title = camp.title.toLowerCase()
    const url = camp.url.toLowerCase()
    const username = camp.profiles?.username?.toLowerCase() || ""
    const email = camp.profiles?.email?.toLowerCase() || ""
    
    const matchesSearch = 
      title.includes(search.toLowerCase()) || 
      url.includes(search.toLowerCase()) || 
      username.includes(search.toLowerCase()) || 
      email.includes(search.toLowerCase())

    const matchesStatus = statusFilter === "all" || camp.status === statusFilter
    const matchesDuration = durationFilter === "all" || String(camp.duration) === durationFilter

    return matchesSearch && matchesStatus && matchesDuration
  })

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#020617] p-6 md:p-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="outline" size="icon" className="glass border-white/10 text-white/70 hover:text-white rounded-xl">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
              Player PTC Campaigns
            </h1>
            <p className="text-sm text-white/50 font-bold uppercase tracking-wider">
              Manage and monitor paid-to-click advertisements submitted by players
            </p>
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="glass border-white/5 rounded-2xl">
        <CardContent className="p-6 grid gap-4 md:grid-cols-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-white/30" />
            <Input
              type="text"
              placeholder="Search by title, url, advertiser..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl border-white/10 bg-white/5 text-white"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-primary"
            >
              <option value="all" className="bg-[#020617]">All Status</option>
              <option value="active" className="bg-[#020617]">Active</option>
              <option value="paused" className="bg-[#020617]">Paused</option>
              <option value="completed" className="bg-[#020617]">Completed</option>
            </select>
          </div>

          {/* Duration Filter */}
          <div>
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-primary"
            >
              <option value="all" className="bg-[#020617]">All Durations</option>
              <option value="10" className="bg-[#020617]">10 seconds</option>
              <option value="30" className="bg-[#020617]">30 seconds</option>
              <option value="60" className="bg-[#020617]">60 seconds</option>
              <option value="120" className="bg-[#020617]">120 seconds</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="glass border-white/5 rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] p-6">
          <CardTitle className="text-lg font-bold text-white uppercase italic flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-amber-500" />
            PTC Ad Campaigns ({filteredCampaigns.length})
          </CardTitle>
          <CardDescription className="text-white/40">Advertiser submissions, view progression metrics and limits</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase font-black tracking-widest text-[9px]">
                <th className="p-4 pl-6">Ad Info</th>
                <th className="p-4">Advertiser</th>
                <th className="p-4">Duration</th>
                <th className="p-4">Cost / Reward</th>
                <th className="p-4">Progress (Views)</th>
                <th className="p-4">Daily Views</th>
                <th className="p-4 pr-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredCampaigns.map((camp) => {
                const progressPercent = Math.min(((camp.views_completed || 0) / (camp.total_views || 1)) * 100, 100)
                
                return (
                  <tr key={camp.id} className="text-white/80 hover:bg-white/[0.02]">
                    <td className="p-4 pl-6 max-w-[200px]">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold text-sm text-zinc-200 truncate" title={camp.title}>{camp.title}</span>
                        <a 
                          href={camp.url} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[10px] text-primary hover:underline flex items-center gap-1 font-mono truncate"
                        >
                          <Link2 className="w-3 h-3 shrink-0" />
                          {camp.url}
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-zinc-200">{camp.profiles?.username || "Anonymous"}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{camp.profiles?.email || "-"}</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-zinc-300">
                      {camp.duration}s
                    </td>
                    <td className="p-4 font-mono font-bold">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-rose-400">-{camp.cost_per_view} Cost</span>
                        <span className="text-emerald-400">+{camp.reward_per_view} Reward</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5 w-32">
                        <div className="flex justify-between items-center text-[10px] font-bold">
                          <span className="text-zinc-200">{camp.views_completed} / {camp.total_views}</span>
                          <span className="text-zinc-500 font-mono">{progressPercent.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-white/5 border border-white/10 rounded-full h-1.5 overflow-hidden">
                          <div 
                            className="bg-primary h-full rounded-full transition-all duration-500" 
                            style={{ width: `${progressPercent}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="p-4 font-mono font-bold text-zinc-300">
                      {camp.daily_views_limit ? (
                        <span>{camp.daily_views_completed} / {camp.daily_views_limit}</span>
                      ) : (
                        <span className="text-zinc-600 font-bold uppercase tracking-wider text-[9px]">No Limit</span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                          camp.status === "active" 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                            : camp.status === "paused"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}>
                          {camp.status}
                        </span>
                        
                        {camp.status !== "completed" && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => handleToggleStatus(camp)}
                            className="h-8 w-8 rounded-lg text-white/60 hover:text-white hover:bg-white/5"
                          >
                            {camp.status === "active" ? (
                              <Pause className="w-3.5 h-3.5 text-amber-500" />
                            ) : (
                              <Play className="w-3.5 h-3.5 text-emerald-400" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filteredCampaigns.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-white/30 font-bold uppercase tracking-wider">
                    No campaigns found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  )
}
