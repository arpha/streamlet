"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft, Search, HardDrive, ShieldAlert, Cpu } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

interface UserMiner {
  id: string
  user_id: string
  miner_type: string
  cost: number
  created_at: string
  expires_at: string
  last_claimed_at: string
  charged_until: string
  profiles: {
    username: string
    email: string
  } | null
}

export default function AdminMinersPage() {
  const { isAdmin } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [miners, setMiners] = useState<UserMiner[]>([])
  
  // Filters
  const [search, setSearch] = useState("")
  const [minerType, setMinerType] = useState("all")
  const [status, setStatus] = useState("all")

  useEffect(() => {
    if (isAdmin === undefined) return
    if (!isAdmin) {
      toast.error("Access Denied: Admin authorization required.")
      router.push("/")
    } else {
      fetchMiners()
    }
  }, [isAdmin, router])

  const fetchMiners = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("user_miners")
        .select(`
          *,
          profiles (
            username,
            email
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      setMiners((data as any) || [])
    } catch (e: any) {
      toast.error("Failed to load miners: " + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Filter logic
  const filteredMiners = miners.filter((miner) => {
    const username = miner.profiles?.username?.toLowerCase() || ""
    const email = miner.profiles?.email?.toLowerCase() || ""
    const matchesSearch = username.includes(search.toLowerCase()) || email.includes(search.toLowerCase())
    const matchesType = minerType === "all" || miner.miner_type === minerType
    
    const isExpired = new Date(miner.expires_at).getTime() < Date.now()
    const matchesStatus = 
      status === "all" ||
      (status === "active" && !isExpired) ||
      (status === "expired" && isExpired)

    return matchesSearch && matchesType && matchesStatus
  })

  const getMinerBadgeColor = (type: string) => {
    switch (type) {
      case "coal":
        return "bg-amber-950/20 text-amber-700 border-amber-800/30"
      case "iron":
        return "bg-zinc-800/30 text-zinc-300 border-zinc-700/40"
      case "gold":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20"
      default:
        return "bg-zinc-500/10 text-zinc-400 border-zinc-600/20"
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
              Player Miners List
            </h1>
            <p className="text-sm text-white/50 font-bold uppercase tracking-wider">
              Monitor active and expired virtual miner leases across all players
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
              placeholder="Search by username or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 rounded-xl border-white/10 bg-white/5 text-white"
            />
          </div>

          {/* Miner Type Filter */}
          <div>
            <select
              value={minerType}
              onChange={(e) => setMinerType(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-primary"
            >
              <option value="all" className="bg-[#020617]">All Miner Types</option>
              <option value="coal" className="bg-[#020617]">Coal Miner</option>
              <option value="iron" className="bg-[#020617]">Iron Miner</option>
              <option value="gold" className="bg-[#020617]">Gold Miner</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-white/10 bg-white/5 text-white text-sm outline-none focus:border-primary"
            >
              <option value="all" className="bg-[#020617]">All Status</option>
              <option value="active" className="bg-[#020617]">Active Leases</option>
              <option value="expired" className="bg-[#020617]">Expired Leases</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card className="glass border-white/5 rounded-[2rem] overflow-hidden">
        <CardHeader className="border-b border-white/5 bg-white/[0.01] p-6">
          <CardTitle className="text-lg font-bold text-white uppercase italic flex items-center gap-2">
            <Cpu className="w-5 h-5 text-amber-500" />
            Player Leases ({filteredMiners.length})
          </CardTitle>
          <CardDescription className="text-white/40">Lease history, claim logs and active statuses</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-white/40 uppercase font-black tracking-widest text-[9px]">
                <th className="p-4 pl-6">Player</th>
                <th className="p-4">Miner Type</th>
                <th className="p-4">Lease Cost</th>
                <th className="p-4">Time Remaining</th>
                <th className="p-4">Charging Remaining</th>
                <th className="p-4">Last Claimed</th>
                <th className="p-4 pr-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredMiners.map((miner) => {
                const isExpired = new Date(miner.expires_at).getTime() < Date.now()
                const isCharged = new Date(miner.charged_until).getTime() > Date.now()
                
                return (
                  <tr key={miner.id} className="text-white/80 hover:bg-white/[0.02]">
                    <td className="p-4 pl-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-sm text-zinc-200">{miner.profiles?.username || "Anonymous"}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{miner.profiles?.email || "-"}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${getMinerBadgeColor(miner.miner_type)}`}>
                        {miner.miner_type}
                      </span>
                    </td>
                    <td className="p-4 font-mono font-bold text-rose-400">
                      -{miner.cost.toLocaleString()} Pts
                    </td>
                    <td className="p-4 font-bold text-zinc-300">
                      {isExpired ? (
                        <span className="text-rose-500 font-bold uppercase tracking-wider text-[10px]">Expired</span>
                      ) : (
                        formatDistanceToNow(new Date(miner.expires_at))
                      )}
                    </td>
                    <td className="p-4 font-bold">
                      {isExpired ? (
                        <span className="text-zinc-600 font-bold">-</span>
                      ) : isCharged ? (
                        <span className="text-emerald-400">
                          {formatDistanceToNow(new Date(miner.charged_until))}
                        </span>
                      ) : (
                        <span className="text-amber-500 font-black uppercase tracking-wider text-[10px] animate-pulse">Needs Charge</span>
                      )}
                    </td>
                    <td className="p-4 text-zinc-400 font-bold">
                      {miner.last_claimed_at ? formatDistanceToNow(new Date(miner.last_claimed_at), { addSuffix: true }) : "-"}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border ${
                        isExpired 
                          ? "bg-rose-500/10 text-rose-400 border-rose-500/20" 
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}>
                        {isExpired ? "Expired" : "Active"}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filteredMiners.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-white/30 font-bold uppercase tracking-wider">
                    No miners found.
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
