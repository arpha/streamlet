"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Loader2, Search, Filter, RefreshCw, AlertTriangle, Shield, ShieldAlert,
  ChevronLeft, ChevronRight, Flame, Link2, Coins, Users, CalendarCheck, HelpCircle
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from 'date-fns'

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

export default function AdminActivitiesPage() {
  const { id: userId, isAdmin } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [activities, setActivities] = useState<ActivityLog[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [limit, setLimit] = useState(50)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Track duplicate IPs & Fingerprints in the current list for highlighting potential cheaters
  const [duplicateIps, setDuplicateIps] = useState<Set<string>>(new Set())
  const [duplicateFingerprints, setDuplicateFingerprints] = useState<Set<string>>(new Set())

  // Protect route
  useEffect(() => {
    if (!isAdmin) {
      router.push("/")
    }
  }, [isAdmin, router])

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(0)
    }, 500)
    return () => clearTimeout(handler)
  }, [search])

  const fetchActivities = async () => {
    if (!userId || !isAdmin) return
    setIsLoading(true)
    try {
      const { data, error } = await supabase.rpc("get_admin_player_activities", {
        p_user_id: userId,
        p_search: debouncedSearch || null,
        p_type: typeFilter === "all" ? null : typeFilter,
        p_limit: limit,
        p_offset: page * limit
      })

      if (error) throw error

      const logs = (data || []) as ActivityLog[]
      setActivities(logs)
      setHasMore(logs.length === limit)

      // Calculate duplicates in current batch (anti-cheat indicator)
      const ipCounts: Record<string, number> = {}
      const fingerprintCounts: Record<string, number> = {}
      const dupIps = new Set<string>()
      const dupFingerprints = new Set<string>()

      logs.forEach(log => {
        if (log.ip_address && log.ip_address !== "127.0.0.1") {
          ipCounts[log.ip_address] = (ipCounts[log.ip_address] || 0) + 1
          if (ipCounts[log.ip_address] > 1) {
            dupIps.add(log.ip_address)
          }
        }
        if (log.device_fingerprint) {
          fingerprintCounts[log.device_fingerprint] = (fingerprintCounts[log.device_fingerprint] || 0) + 1
          if (fingerprintCounts[log.device_fingerprint] > 1) {
            dupFingerprints.add(log.device_fingerprint)
          }
        }
      })

      setDuplicateIps(dupIps)
      setDuplicateFingerprints(dupFingerprints)

    } catch (e: any) {
      console.error("Error loading activities:", e)
      toast.error("Failed to load player activities: " + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [userId, isAdmin, debouncedSearch, typeFilter, limit, page])

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "faucet":
        return <Flame className="w-4 h-4 text-purple-400" />
      case "shortlink":
        return <Link2 className="w-4 h-4 text-cyan-400" />
      case "offerwall":
        return <Coins className="w-4 h-4 text-amber-400" />
      case "withdrawal":
        return <Users className="w-4 h-4 text-rose-400" />
      case "checkin":
        return <CalendarCheck className="w-4 h-4 text-emerald-400" />
      default:
        return <HelpCircle className="w-4 h-4 text-white/40" />
    }
  }

  const getActivityBadgeClass = (type: string) => {
    switch (type) {
      case "faucet":
        return "bg-purple-500/10 text-purple-400 border border-purple-500/20"
      case "shortlink":
        return "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
      case "offerwall":
        return "bg-amber-500/10 text-amber-400 border border-amber-500/20"
      case "withdrawal":
        return "bg-rose-500/10 text-rose-400 border border-rose-500/20"
      case "checkin":
        return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
      default:
        return "bg-white/10 text-white/60"
    }
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
              Player Activities
            </h2>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">
              Monitor claims, withdrawals, and potential multi-accounting
            </p>
          </div>
        </div>

        <Button 
          onClick={fetchActivities} 
          disabled={isLoading}
          variant="outline"
          className="glass border-white/10 text-white/70 hover:text-white rounded-xl gap-2 hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter / Search Row */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search username, email, IP or device fingerprint..."
            className="pl-10 h-12 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:border-primary/50 transition-all font-medium text-sm"
          />
        </div>

        {/* Type Filter */}
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value)
              setPage(0)
            }}
            className="w-full pl-10 pr-4 h-12 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-primary/50 transition-all font-bold text-xs uppercase tracking-wider appearance-none cursor-pointer"
          >
            <option className="bg-[#0f172a] text-white" value="all">All Activities</option>
            <option className="bg-[#0f172a] text-white" value="faucet">Faucet Claims</option>
            <option className="bg-[#0f172a] text-white" value="shortlink">Shortlinks</option>
            <option className="bg-[#0f172a] text-white" value="offerwall">Offerwalls</option>
            <option className="bg-[#0f172a] text-white" value="withdrawal">Withdrawals</option>
            <option className="bg-[#0f172a] text-white" value="checkin">Daily Checkins</option>
          </select>
        </div>

        {/* Limit Filter */}
        <select
          value={limit}
          onChange={(e) => {
            setLimit(Number(e.target.value))
            setPage(0)
          }}
          className="h-12 px-4 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-primary/50 transition-all font-bold text-xs uppercase tracking-wider appearance-none cursor-pointer"
        >
          <option className="bg-[#0f172a] text-white" value={25}>Show 25 rows</option>
          <option className="bg-[#0f172a] text-white" value={50}>Show 50 rows</option>
          <option className="bg-[#0f172a] text-white" value={100}>Show 100 rows</option>
        </select>
      </div>

      {/* Main Content Area */}
      <Card className="glass rounded-[2rem] border-white/10 overflow-hidden shadow-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-white/50">
                  <th className="py-4 px-6">User</th>
                  <th className="py-4 px-6">Activity Type</th>
                  <th className="py-4 px-6">Amount</th>
                  <th className="py-4 px-6">Details</th>
                  <th className="py-4 px-6">Security Info</th>
                  <th className="py-4 px-6">Status</th>
                  <th className="py-4 px-6 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-white/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white/30">Loading activities...</span>
                    </td>
                  </tr>
                ) : activities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-20 text-center text-white/30">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50 text-amber-500" />
                      <span className="text-xs font-bold uppercase tracking-wider block">No activities found</span>
                      <span className="text-[10px] lowercase block mt-1 font-medium">Try adjusting your filters or search query</span>
                    </td>
                  </tr>
                ) : (
                  activities.map((log, index) => {
                    const isDupIp = log.ip_address && duplicateIps.has(log.ip_address)
                    const isDupFingerprint = log.device_fingerprint && duplicateFingerprints.has(log.device_fingerprint)

                    return (
                      <tr 
                        key={index} 
                        className="hover:bg-white/[0.02] transition-colors duration-200"
                      >
                        {/* User Column */}
                        <td className="py-4 px-6">
                          <div className="flex flex-col">
                            <span className="font-black text-white uppercase tracking-tight">{log.username || "Anonymous"}</span>
                            <span className="text-[10px] text-white/40 font-medium">{log.email}</span>
                          </div>
                        </td>

                        {/* Activity Type Badge */}
                        <td className="py-4 px-6">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${getActivityBadgeClass(log.activity_type)}`}>
                            {getActivityIcon(log.activity_type)}
                            {log.activity_type}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-4 px-6">
                          <span className={`font-mono font-black ${
                            log.activity_type === "withdrawal" ? "text-rose-400" : "text-emerald-400"
                          }`}>
                            {log.amount}
                          </span>
                        </td>

                        {/* Details */}
                        <td className="py-4 px-6">
                          <span className="font-bold text-xs uppercase tracking-wide text-white/70">{log.details}</span>
                        </td>

                        {/* Security Info (IP & Fingerprint) */}
                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1 text-[11px] font-mono">
                            {log.ip_address ? (
                              <span className={`flex items-center gap-1 ${
                                isDupIp ? "text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 w-fit" : "text-white/50"
                              }`}>
                                {isDupIp && <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />}
                                IP: {log.ip_address}
                              </span>
                            ) : (
                              <span className="text-white/20 italic">IP: N/A</span>
                            )}
                            
                            {log.device_fingerprint ? (
                              <span className={`flex items-center gap-1 ${
                                isDupFingerprint ? "text-rose-400 font-bold bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 w-fit" : "text-white/50"
                              }`}>
                                {isDupFingerprint && <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />}
                                FP: {log.device_fingerprint.substring(0, 12)}...
                              </span>
                            ) : (
                              <span className="text-white/20 italic">FP: N/A</span>
                            )}
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-4 px-6">
                          <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${
                            log.status === "completed" 
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                              : log.status === "pending"
                              ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                              : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          }`}>
                            {log.status}
                          </span>
                        </td>

                        {/* Time */}
                        <td className="py-4 px-6 text-right">
                          <span className="text-[11px] font-bold text-white/50 uppercase whitespace-nowrap">
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                          </span>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!isLoading && activities.length > 0 && (
            <div className="flex items-center justify-between p-6 border-t border-white/10 bg-white/[0.01]">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
                Page {page + 1}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  disabled={page === 0}
                  onClick={() => setPage(prev => Math.max(0, prev - 1))}
                  variant="outline"
                  className="glass border-white/10 text-white/70 hover:text-white rounded-xl h-10 w-10 p-0 hover:bg-white/5"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>

                <Button
                  disabled={!hasMore}
                  onClick={() => setPage(prev => prev + 1)}
                  variant="outline"
                  className="glass border-white/10 text-white/70 hover:text-white rounded-xl h-10 w-10 p-0 hover:bg-white/5"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
