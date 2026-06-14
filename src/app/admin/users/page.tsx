"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Loader2, Search, RefreshCw, AlertTriangle, Shield, ShieldAlert,
  ChevronLeft, ChevronRight, Ban, CheckCircle2, Eye, X, HelpCircle
} from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from 'date-fns'

interface UserProfile {
  id: string
  username: string
  email: string
  balance: number
  xp: number
  is_admin: boolean
  is_suspended: boolean
  suspension_reason: string | null
  last_active_at: string | null
  created_at: string
}

export default function AdminUsersPage() {
  const { id: userId, isAdmin } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(true)
  const [users, setUsers] = useState<UserProfile[]>([])
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all") // all, active, suspended
  const [limit] = useState(20)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Suspend Modal state
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null)
  const [suspensionReason, setSuspensionReason] = useState("")
  const [isSubmittingSuspension, setIsSubmittingSuspension] = useState(false)

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

  const fetchUsers = async () => {
    if (!userId || !isAdmin) return
    setIsLoading(true)
    try {
      let query = supabase
        .from("profiles")
        .select("*")

      // Search Filter
      if (debouncedSearch) {
        query = query.or(`username.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`)
      }

      // Status Filter
      if (statusFilter === "suspended") {
        query = query.eq("is_suspended", true)
      } else if (statusFilter === "active") {
        query = query.eq("is_suspended", false)
      }

      // Pagination
      const from = page * limit
      const to = from + limit - 1

      const { data, error } = await query
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) throw error

      const profiles = (data || []) as UserProfile[]
      setUsers(profiles)
      setHasMore(profiles.length === limit)
    } catch (e: any) {
      console.error("Error loading users:", e)
      toast.error("Failed to load user list: " + e.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [userId, isAdmin, debouncedSearch, statusFilter, page])

  const handleUnsuspend = async (targetUser: UserProfile) => {
    try {
      const { error } = await supabase.rpc("unsuspend_user", {
        p_admin_id: userId,
        p_target_id: targetUser.id
      })

      if (error) throw error

      toast.success(`User ${targetUser.username} has been re-activated successfully!`)
      fetchUsers()
    } catch (e: any) {
      console.error("Unsuspend error:", e)
      toast.error("Failed to re-activate user: " + e.message)
    }
  }

  const handleSuspendSubmit = async () => {
    if (!selectedUser) return
    if (!suspensionReason.trim()) {
      toast.error("Please enter a reason for suspension.")
      return
    }

    setIsSubmittingSuspension(true)
    try {
      const { error } = await supabase.rpc("suspend_user", {
        p_admin_id: userId,
        p_target_id: selectedUser.id,
        p_reason: suspensionReason.trim()
      })

      if (error) throw error

      toast.success(`User ${selectedUser.username} has been suspended.`)
      setSelectedUser(null)
      setSuspensionReason("")
      fetchUsers()
    } catch (e: any) {
      console.error("Suspend error:", e)
      toast.error("Failed to suspend user: " + e.message)
    } finally {
      setIsSubmittingSuspension(false)
    }
  }

  const isOnline = (lastActiveAt: string | null) => {
    if (!lastActiveAt) return false
    const diffMs = Date.now() - new Date(lastActiveAt).getTime()
    return diffMs < 5 * 60 * 1000
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tight flex items-center gap-2">
              Manage Users
            </h2>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">
              Search, audit, suspend, and activate player accounts
            </p>
          </div>
        </div>

        <Button 
          onClick={fetchUsers} 
          disabled={isLoading}
          variant="outline"
          className="glass border-white/10 text-white/70 hover:text-white rounded-xl gap-2 hover:bg-white/5"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Filter / Search Row */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Search */}
        <div className="relative md:col-span-2">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or email..."
            className="pl-10 h-12 bg-white/5 border-white/10 rounded-2xl text-white placeholder:text-white/30 focus:border-primary/50 transition-all font-medium text-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(0)
            }}
            className="w-full px-4 h-12 bg-white/5 border border-white/10 rounded-2xl text-white focus:border-primary/50 transition-all font-bold text-xs uppercase tracking-wider appearance-none cursor-pointer"
          >
            <option className="bg-[#0f172a] text-white" value="all">All Accounts</option>
            <option className="bg-[#0f172a] text-white" value="active">Active Only</option>
            <option className="bg-[#0f172a] text-white" value="suspended">Suspended Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="glass rounded-[2rem] border-white/10 overflow-hidden shadow-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-white/50">
                  <th className="py-4 px-6">User Details</th>
                  <th className="py-4 px-6">Points Balance</th>
                  <th className="py-4 px-6">XP Rank</th>
                  <th className="py-4 px-6">Account Status</th>
                  <th className="py-4 px-6">Joined At</th>
                  <th className="py-4 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-white/80">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-2" />
                      <span className="text-xs font-bold uppercase tracking-wider text-white/30">Loading user profiles...</span>
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-white/30">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50 text-indigo-500" />
                      <span className="text-xs font-bold uppercase tracking-wider block">No users found</span>
                      <span className="text-[10px] lowercase block mt-1 font-medium">Try adjusting your search query</span>
                    </td>
                  </tr>
                ) : (
                  users.map((profile) => (
                    <tr 
                      key={profile.id} 
                      className="hover:bg-white/[0.02] transition-colors duration-200"
                    >
                      {/* User details */}
                      <td className="py-4 px-6">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-white uppercase tracking-tight">
                              {profile.username || "Anonymous"}
                            </span>
                            {profile.is_admin && (
                              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded text-[8px] font-black uppercase">
                                Admin
                              </span>
                            )}
                            {isOnline(profile.last_active_at) ? (
                              <span className="flex h-2 w-2 relative" title="Online now">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-white/25" title={profile.last_active_at ? `Last active: ${new Date(profile.last_active_at).toLocaleString()}` : "Never"} />
                            )}
                          </div>
                          <span className="text-[10px] text-white/40 font-medium">{profile.email}</span>
                        </div>
                      </td>

                      {/* Balance */}
                      <td className="py-4 px-6 font-mono font-black text-fuchsia-400">
                        {profile.balance.toLocaleString()} Pts
                      </td>

                      {/* XP Rank */}
                      <td className="py-4 px-6 font-semibold">
                        <span className="text-zinc-300">{profile.xp.toLocaleString()} XP</span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-6">
                        {profile.is_suspended ? (
                          <div className="space-y-1">
                            <span className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              Suspended
                            </span>
                            {profile.suspension_reason && (
                              <span className="block text-[9px] text-rose-400/80 font-medium max-w-[150px] truncate" title={profile.suspension_reason}>
                                Reason: {profile.suspension_reason}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Active
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="py-4 px-6 text-xs text-white/40 font-bold uppercase whitespace-nowrap">
                        {new Date(profile.created_at).toLocaleDateString("id-ID", {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </td>

                      {/* Action buttons */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            onClick={() => router.push(`/admin/activities?search=${profile.username}`)}
                            variant="outline"
                            className="glass border-white/5 hover:border-white/15 h-9 w-9 p-0 rounded-xl text-white/50 hover:text-white"
                            title="View Player Logs"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          
                          {/* Prevent admin from suspending themselves or other admins */}
                          {!profile.is_admin && (
                            profile.is_suspended ? (
                              <Button
                                onClick={() => handleUnsuspend(profile)}
                                variant="outline"
                                className="border-emerald-500/30 hover:border-emerald-500/60 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 font-bold text-xs uppercase tracking-wide h-9 px-3 rounded-xl flex items-center gap-1.5"
                                title="Activate User"
                              >
                                <CheckCircle2 className="w-4 h-4" /> Activate
                              </Button>
                            ) : (
                              <Button
                                onClick={() => {
                                  setSelectedUser(profile)
                                  setSuspensionReason("")
                                }}
                                variant="outline"
                                className="border-rose-500/30 hover:border-rose-500/60 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 font-bold text-xs uppercase tracking-wide h-9 px-3 rounded-xl flex items-center gap-1.5"
                                title="Suspend User"
                              >
                                <Ban className="w-4 h-4" /> Suspend
                              </Button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          {!isLoading && users.length > 0 && (
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

      {/* Suspend Reason Custom Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div 
            className="w-full max-w-md bg-[#090d1f] border border-rose-500/20 rounded-[2.5rem] p-6 md:p-8 shadow-2xl relative space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button 
              onClick={() => setSelectedUser(null)}
              className="absolute top-4 right-4 p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-lg text-white uppercase italic tracking-tight">Suspend Account</h3>
                <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">User: {selectedUser.username}</p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                Enter the reason for suspending this user. They will be immediately blocked from logging in or using the app, and a trigger will block their database mutations.
              </p>

              <div className="space-y-2 text-left">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Suspension Reason</label>
                <textarea
                  value={suspensionReason}
                  onChange={(e) => setSuspensionReason(e.target.value)}
                  placeholder="e.g. Using bot to automate faucet claims, Multiple self-referral accounts, VPN/Proxy usage..."
                  className="w-full h-32 p-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder:text-white/20 focus:border-rose-500/50 transition-all font-medium text-sm resize-none outline-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button
                disabled={isSubmittingSuspension}
                onClick={() => setSelectedUser(null)}
                variant="outline"
                className="flex-1 rounded-2xl h-11 border-white/10 text-white/60 hover:text-white hover:bg-white/5 font-black uppercase text-[11px] tracking-wider"
              >
                Cancel
              </Button>
              <Button
                disabled={isSubmittingSuspension || !suspensionReason.trim()}
                onClick={handleSuspendSubmit}
                className="flex-1 rounded-2xl h-11 bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[11px] tracking-wider border-0 shadow-lg shadow-rose-500/10"
              >
                {isSubmittingSuspension ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Suspending...
                  </>
                ) : (
                  "Confirm Suspend"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
