"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Loader2, ArrowLeft, RefreshCw, Wallet, CheckCircle, XCircle, Clock, 
  RotateCcw, Trash2, ShieldAlert, AlertCircle, Info, ExternalLink
} from "lucide-react"
import { toast } from "sonner"

interface Withdrawal {
  id: string
  amount: number
  coin: string
  address: string
  usd_value: number | null
  crypto_amount: string | null
  tx_hash: string | null
  status: string
  error_message: string | null
  created_at: string
  profiles?: {
    username: string
  } | null
}

export default function AdminWithdrawalsPage() {
  const { id: userId, isAdmin } = useStore()
  const router = useRouter()
  const supabase = createClient()

  const [checkingAuth, setCheckingAuth] = useState(true)
  const [loading, setLoading] = useState(true)
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending")
  const [actioningId, setActioningId] = useState<string | null>(null)

  // Auth Protection Gate
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
    fetchWithdrawals()
  }, [userId, isAdmin, router])

  const fetchWithdrawals = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("withdrawals")
        .select(`
          id,
          amount,
          coin,
          address,
          usd_value,
          crypto_amount,
          tx_hash,
          status,
          error_message,
          created_at,
          profiles (
            username
          )
        `)
        .order("created_at", { ascending: false })

      if (error) throw error
      if (data) setWithdrawals(data as unknown as Withdrawal[])
    } catch (err: any) {
      console.error("Error fetching withdrawals:", err)
      toast.error("Failed to load withdrawals.")
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (withdrawalId: string, action: "retry" | "cancel") => {
    setActioningId(withdrawalId)
    const { toast } = await import("sonner")

    try {
      const res = await fetch("/api/admin/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId, action }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message)
        fetchWithdrawals()
      } else {
        toast.error(data.message || "Failed to execute action.")
      }
    } catch (err: any) {
      toast.error(err.message || "Network error occurred.")
    } finally {
      setActioningId(null)
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-4" />
        <p className="text-white/40 font-bold uppercase tracking-wider text-xs">Checking admin authorization...</p>
      </div>
    )
  }

  const pendingWithdrawals = withdrawals.filter(w => w.status === "pending")
  const historyWithdrawals = withdrawals.filter(w => w.status !== "pending")

  const displayedList = activeTab === "pending" ? pendingWithdrawals : historyWithdrawals

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8 min-h-screen text-white">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/admin">
            <Button variant="outline" className="glass border-white/10 text-white/70 hover:text-white rounded-xl p-3 h-11">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h2 className="text-3xl font-black text-white uppercase italic tracking-tight">
              Withdrawal Management
            </h2>
            <p className="text-xs text-white/50 font-bold uppercase tracking-wider">
              Retry pending payouts due to empty faucet balance or refund user points manually
            </p>
          </div>
        </div>

        <Button 
          onClick={fetchWithdrawals} 
          disabled={loading}
          variant="outline"
          className="glass border-white/10 text-white/70 hover:text-white rounded-xl gap-2 hover:bg-white/5 h-11"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh Requests
        </Button>
      </div>

      {/* QUICK SUMMARY CARDS */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-amber-400 font-mono">
                {pendingWithdrawals.length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">Pending Withdrawals</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-emerald-400 font-mono">
                {withdrawals.filter(w => w.status === "completed").length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">Completed Payouts</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/5 rounded-2xl">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <span className="text-3xl font-black text-rose-400 font-mono">
                {withdrawals.filter(w => w.status === "failed").length}
              </span>
              <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider mt-0.5">Cancelled / Failed</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABS SELECTOR */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("pending")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "pending"
              ? "border-primary text-white"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          Pending Queue ({pendingWithdrawals.length})
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-3 text-sm font-black uppercase tracking-wider border-b-2 transition-all ${
            activeTab === "history"
              ? "border-primary text-white"
              : "border-transparent text-white/50 hover:text-white"
          }`}
        >
          Processed History ({historyWithdrawals.length})
        </button>
      </div>

      {/* WITHDRAWAL DATA LIST */}
      <Card className="glass border-white/5 rounded-[2rem] overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-20 text-center">
              <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-xs text-white/40 font-bold uppercase tracking-wider">Loading withdrawal records...</p>
            </div>
          ) : displayedList.length === 0 ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
              <Wallet className="w-16 h-16 text-white/10" />
              <h4 className="text-lg font-black uppercase text-white/60">No Withdrawals Found</h4>
              <p className="text-white/40 text-xs max-w-xs">
                {activeTab === "pending" 
                  ? "Good job! All user withdrawals are currently processed and up-to-date." 
                  : "No processed transactions found in system history."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.01] text-[10px] uppercase font-black tracking-widest text-zinc-400">
                    <th className="p-4 pl-6">User</th>
                    <th className="p-4">FaucetPay Email</th>
                    <th className="p-4">Details</th>
                    <th className="p-4">Amt Conversion</th>
                    <th className="p-4">Status / Error</th>
                    <th className="p-4 pr-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayedList.map((w) => {
                    const formattedDate = new Date(w.created_at).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })

                    return (
                      <tr key={w.id} className="hover:bg-white/[0.01] transition-colors text-xs text-zinc-300">
                        {/* User info */}
                        <td className="p-4 pl-6">
                          <p className="font-bold text-white text-sm">{w.profiles?.username || "Unknown"}</p>
                          <p className="text-[10px] text-white/40 font-mono mt-0.5">{w.id.substring(0, 8)}...</p>
                        </td>

                        {/* Email FaucetPay */}
                        <td className="p-4 font-medium font-mono text-zinc-400">
                          {w.address}
                        </td>

                        {/* Details */}
                        <td className="p-4">
                          <p className="font-bold text-white">{w.amount.toLocaleString()} Points</p>
                          <p className="text-[10px] text-white/40 mt-0.5">{formattedDate}</p>
                        </td>

                        {/* Conversion */}
                        <td className="p-4">
                          <p className="font-bold text-emerald-400">${Number(w.usd_value || 0).toFixed(6)}</p>
                          {w.crypto_amount ? (
                            <p className="text-[10px] text-cyan-400 font-mono mt-0.5">
                              {(Number(w.crypto_amount) / 1e8).toFixed(8)} {w.coin}
                            </p>
                          ) : (
                            <p className="text-[10px] text-white/30 font-mono mt-0.5">Not calculated yet ({w.coin})</p>
                          )}
                        </td>

                        {/* Status / Error */}
                        <td className="p-4 space-y-1.5 max-w-xs">
                          <div>
                            {w.status === "completed" && (
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-black uppercase text-[9px] gap-1">
                                <CheckCircle className="w-2.5 h-2.5" /> Completed
                              </Badge>
                            )}
                            {w.status === "failed" && (
                              <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 font-black uppercase text-[9px] gap-1">
                                <XCircle className="w-2.5 h-2.5" /> Cancelled
                              </Badge>
                            )}
                            {w.status === "pending" && (
                              <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-black uppercase text-[9px] gap-1 animate-pulse">
                                <Clock className="w-2.5 h-2.5" /> Pending
                              </Badge>
                            )}
                          </div>
                          
                          {w.error_message && (
                            <div className="flex gap-1 items-start bg-rose-500/5 border border-rose-500/10 p-2 rounded-xl text-rose-200/80 text-[10px]">
                              <AlertCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0 mt-0.5" />
                              <span className="font-medium font-mono leading-relaxed break-all">{w.error_message}</span>
                            </div>
                          )}
                          
                          {w.tx_hash && (
                            <div className="text-[9px] font-mono text-zinc-500 flex items-center gap-1">
                              <span>Payout ID: #{w.tx_hash}</span>
                            </div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="p-4 pr-6 text-right">
                          {w.status === "pending" ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleAction(w.id, "retry")}
                                disabled={actioningId !== null}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl gap-1 h-9 px-3"
                              >
                                {actioningId === w.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <RotateCcw className="w-3 h-3" />
                                )}
                                Retry Payout
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm("Apakah Anda yakin ingin membatalkan penarikan ini dan mengembalikan saldo poin ke pengguna?")) {
                                    handleAction(w.id, "cancel")
                                  }
                                }}
                                disabled={actioningId !== null}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-black uppercase text-[10px] tracking-wider rounded-xl gap-1 h-9 px-3"
                              >
                                <Trash2 className="w-3 h-3" />
                                Cancel & Refund
                              </Button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-zinc-600 uppercase font-black font-mono">Processed</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* ADVISORY BOX */}
      <div className="p-4 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex gap-3 items-start">
        <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-200/80">
          <p className="font-bold text-blue-400 mb-1">Manual Payout Policy</p>
          Sesuai dengan kebijakan situs, penarikan pending dikarenakan saldo faucet kosong memiliki batas waktu estimasi penyelesaian **1 hari kerja**. Pastikan Anda segera mengisi ulang saldo di FaucetPay Anda dan menekan tombol **Retry Payout** sebelum batas waktu terlewati untuk menjaga kepercayaan member.
        </div>
      </div>
    </div>
  )
}
