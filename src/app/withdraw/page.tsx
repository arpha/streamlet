"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Wallet, History, Send, Info, AlertTriangle, CheckCircle, XCircle, Clock, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useStore } from "@/store/useStore"
import { useAuth } from "@/components/providers/AuthProvider"
import { toast } from "sonner"

// Konfigurasi koin
const COINS = [
  {
    id: "DOGE",
    name: "Dogecoin",
    symbol: "DOGE",
    color: "from-amber-400 to-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/30",
    textColor: "text-amber-400",
    icon: "Ð",
  },
  {
    id: "POL",
    name: "Polygon",
    symbol: "POL",
    color: "from-violet-400 to-violet-600",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/30",
    textColor: "text-violet-400",
    icon: "⬡",
  },
  {
    id: "BNB",
    name: "BNB Chain",
    symbol: "BNB",
    color: "from-yellow-400 to-yellow-600",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    textColor: "text-yellow-400",
    icon: "◆",
  },
]

// Rate konversi: 100 poin = $0.0005
const POINTS_TO_USD = 0.000005

export default function WithdrawPage() {
  const { balance, setBalance } = useStore()
  const { supabase, user, loading: authLoading } = useAuth()
  const router = useRouter()

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  const [selectedCoin, setSelectedCoin] = useState<string | null>(null)
  const [pointsInput, setPointsInput] = useState("")
  const [email, setEmail] = useState("")


  const [submitting, setSubmitting] = useState(false)
  const [withdrawals, setWithdrawals] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>({})
  const [loadingPrices, setLoadingPrices] = useState(true)
  const [cooldownLeft, setCooldownLeft] = useState<number>(0)

  // CoinGecko ID mapping
  const COINGECKO_IDS: Record<string, string> = {
    DOGE: "dogecoin",
    POL: "polygon-ecosystem-token",
    BNB: "binancecoin",
  }

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email)
    }
  }, [user])

  // Fetch crypto prices from CoinGecko
  useEffect(() => {
    async function fetchPrices() {
      try {
        const ids = Object.values(COINGECKO_IDS).join(",")
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`
        )
        const data = await res.json()

        const prices: Record<string, number> = {}
        for (const [symbol, geckoId] of Object.entries(COINGECKO_IDS)) {
          if (data[geckoId]?.usd) {
            prices[symbol] = data[geckoId].usd
          }
        }
        setCryptoPrices(prices)
      } catch (err) {
        console.error("Failed to fetch crypto prices:", err)
      } finally {
        setLoadingPrices(false)
      }
    }
    fetchPrices()
  }, [])

  // Hitung sisa waktu cooldown penarikan (24 jam)
  useEffect(() => {
    const lastWithdraw = withdrawals.find((w) => w.status !== "failed")
    if (!lastWithdraw) {
      setCooldownLeft(0)
      return
    }

    const lastWithdrawTime = new Date(lastWithdraw.created_at).getTime()
    const cooldownDuration = 24 * 60 * 60 * 1000 // 24 jam

    const updateCooldown = () => {
      const now = Date.now()
      const timeSinceLast = now - lastWithdrawTime
      const remaining = Math.max(0, cooldownDuration - timeSinceLast)
      setCooldownLeft(remaining)
    }

    updateCooldown()
    const interval = setInterval(updateCooldown, 1000)

    return () => clearInterval(interval)
  }, [withdrawals])

  const formatCooldown = (ms: number) => {
    const seconds = Math.floor((ms / 1000) % 60)
    const minutes = Math.floor((ms / (1000 * 60)) % 60)
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24)
    
    const parts = []
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 || hours > 0) parts.push(`${minutes}m`)
    parts.push(`${seconds}s`)
    
    return parts.join(" ")
  }

  const minWithdrawal = 3000
  const pointsAmount = parseInt(pointsInput) || 0
  const usdValue = pointsAmount * POINTS_TO_USD
  const progress = Math.min((balance / minWithdrawal) * 100, 100)
  const canWithdraw = balance >= minWithdrawal && 
                      pointsAmount >= minWithdrawal && 
                      pointsAmount <= balance && 
                      selectedCoin && 
                      email.trim() && 
                      cooldownLeft === 0

  // Load withdrawal history
  const loadHistory = useCallback(async () => {
    if (!user) return
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10)

      if (error) {
        console.error("Error loading withdrawal history:", error)
      } else if (data) {
        setWithdrawals(data)
      }
    } catch (err) {
      console.error("Exception loading withdrawal history:", err)
    } finally {
      setLoadingHistory(false)
    }
  }, [user, supabase])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  if (authLoading || !user) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-3 text-white">
        <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-wider text-white/40">Verifying session...</span>
      </div>
    )
  }

  const handleMax = () => {
    setPointsInput(String(balance))
  }

  const handleSubmit = async () => {
    if (!canWithdraw || submitting) return

    setSubmitting(true)
    try {
      const res = await fetch("/api/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: pointsAmount,
          coin: selectedCoin,
          address: email.trim(),
        }),
      })

      const data = await res.json()

      if (data.success) {
        toast.success(data.message)
        if (data.new_balance !== undefined) {
          setBalance(data.new_balance)
        }
        setPointsInput("")
        setSelectedCoin(null)
        loadHistory()
      } else {
        toast.error(data.message || "Failed to withdraw.")
      }
    } catch {
      toast.error("Network error occurred. Please try again later.")
    } finally {
      setSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1">
            <CheckCircle className="w-3 h-3" /> Completed
          </Badge>
        )
      case "failed":
        return (
          <Badge className="bg-rose-500/20 text-rose-400 border-rose-500/30 gap-1">
            <XCircle className="w-3 h-3" /> Failed
          </Badge>
        )
      default:
        return (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 gap-1">
            <Clock className="w-3 h-3" /> Pending
          </Badge>
        )
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-3xl font-bold gradient-text">Withdraw</h2>
        <p className="text-muted-foreground">Withdraw your points automatically to your FaucetPay account in crypto.</p>
      </div>


      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-primary" />
              Auto Withdrawal
            </CardTitle>
            <CardDescription>Points are converted to USD, then crypto, and sent instantly to your FaucetPay.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Withdrawal Progress</span>
                <span className="font-bold text-primary">{progress.toFixed(1)}%</span>
              </div>
              <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-primary to-cyan-500 transition-all duration-500"
                  style={{ width: `${Math.min(progress, 100)}%` }}
                />
              </div>
            </div>

            {balance < minWithdrawal && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-3 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-200/80">
                  <p className="font-bold text-amber-500 mb-1">Minimum Threshold Not Reached</p>
                  You need at least <span className="text-white font-bold">{(minWithdrawal - balance).toLocaleString()} points</span> more to withdraw.
                </div>
              </div>
            )}

            {cooldownLeft > 0 && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 flex gap-3 items-start">
                <Clock className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-rose-200/80">
                  <p className="font-bold text-rose-500 mb-1">Withdrawal Cooldown Active (1x Daily)</p>
                  You have recently completed a withdrawal. Please wait <span className="text-white font-bold">{formatCooldown(cooldownLeft)}</span> before requesting another withdrawal.
                </div>
              </div>
            )}

            {/* Coin Selection */}
            <div className="space-y-2">
              <Label>Select Currency</Label>
              <div className="grid grid-cols-3 gap-3">
                {COINS.map((coin) => (
                  <button
                    key={coin.id}
                    onClick={() => setSelectedCoin(coin.id)}
                    className={`group relative p-4 rounded-2xl border-2 transition-all duration-300 cursor-pointer text-center
                      ${
                        selectedCoin === coin.id
                          ? `${coin.bgColor} ${coin.borderColor} scale-[1.02] shadow-lg`
                          : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                      }`}
                  >
                    <div className={`text-2xl mb-1 ${selectedCoin === coin.id ? coin.textColor : "text-white/50"}`}>
                      {coin.icon}
                    </div>
                    <div className={`text-xs font-black uppercase tracking-wider ${selectedCoin === coin.id ? coin.textColor : "text-white/70"}`}>
                      {coin.symbol}
                    </div>
                    <div className="text-[10px] text-white/40 mt-0.5">{coin.name}</div>
                    {selectedCoin === coin.id && (
                      <div className={`absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-br ${coin.color} flex items-center justify-center`}>
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Email FaucetPay */}
            <div className="space-y-2">
              <Label htmlFor="email">Email FaucetPay</Label>
              <Input
                id="email"
                placeholder="your@email.com"
                className="glass border-white/10 h-11 bg-white/5 text-white/70 cursor-not-allowed focus-visible:ring-0"
                value={email}
                readOnly
              />
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3" /> Make sure this email is registered at FaucetPay.io
              </p>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <Label htmlFor="amount">Withdrawal Amount (Points)</Label>
              <div className="relative">
                <Input
                  id="amount"
                  placeholder="Minimum 3000"
                  className="glass border-white/10 h-11 pr-20"
                  type="number"
                  min={minWithdrawal}
                  max={balance}
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                />
                <Button
                  className="absolute right-1 top-1 h-9 px-3 text-xs bg-white/10 hover:bg-white/20"
                  variant="ghost"
                  onClick={handleMax}
                >
                  MAX
                </Button>
              </div>
              <div className="flex justify-between text-xs font-medium">
                <span className="text-muted-foreground">Minimum: {minWithdrawal.toLocaleString()} points</span>
                <span className="text-primary font-bold">Balance: {balance.toLocaleString()} points</span>
              </div>
            </div>

            {/* Conversion Preview */}
            {pointsAmount >= minWithdrawal && selectedCoin && (
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <p className="text-xs font-bold text-primary uppercase tracking-widest">Estimated Conversion</p>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-black text-white">{pointsAmount.toLocaleString()}</p>
                    <p className="text-[10px] text-white/50 uppercase">Points</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-emerald-400">${usdValue.toFixed(6)}</p>
                    <p className="text-[10px] text-white/50 uppercase">USD</p>
                  </div>
                  <div>
                    <p className="text-lg font-black text-cyan-400">
                      {selectedCoin && cryptoPrices[selectedCoin]
                        ? `≈ ${(usdValue / cryptoPrices[selectedCoin]).toFixed(8)}`
                        : loadingPrices ? "..." : "≈ ?"}
                    </p>
                    <p className="text-[10px] text-white/50 uppercase">{selectedCoin}</p>
                  </div>
                </div>
                <p className="text-[10px] text-white/30 text-center">Final crypto amount is calculated at withdrawal based on real-time prices.</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              className="w-full h-12 neon-glow font-bold gap-2"
              disabled={!canWithdraw || submitting}
              onClick={handleSubmit}
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> PROCESSING WITHDRAWAL...
                </>
              ) : cooldownLeft > 0 ? (
                `COOLDOWN ACTIVE (${formatCooldown(cooldownLeft)})`
              ) : balance < minWithdrawal ? (
                "INSUFFICIENT BALANCE"
              ) : (
                <>
                  <Send className="w-4 h-4" /> WITHDRAW NOW
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Side Info Card */}
        <div className="space-y-6">
          <Card className="glass">
            <CardContent className="p-5 space-y-4">
              <h3 className="text-xs font-black uppercase tracking-widest text-primary">Conversion Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Rate</span>
                  <span className="text-white font-bold">100 Points = $0.0005</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Minimum</span>
                  <span className="text-white font-bold">3,000 Points</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Method</span>
                  <span className="text-white font-bold">FaucetPay</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Process</span>
                  <span className="text-emerald-400 font-bold">Automatic</span>
                </div>
              </div>
              <div className="h-px bg-white/10" />
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/50">Supported Coins</h4>
                {COINS.map((coin) => (
                  <div key={coin.id} className="flex items-center gap-2 text-xs">
                    <span className={`${coin.textColor} text-sm`}>{coin.icon}</span>
                    <span className="text-white/80">{coin.name} ({coin.symbol})</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Withdrawal History */}
      <Card className="glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="w-5 h-5 text-primary" />
            Withdrawal History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-12 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-muted-foreground text-sm">Loading history...</span>
            </div>
          ) : withdrawals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2 opacity-50">
              <History className="w-12 h-12 text-muted-foreground" />
              <p className="text-muted-foreground font-medium">No withdrawal history yet.</p>
              <p className="text-xs text-muted-foreground">Your withdrawals will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {withdrawals.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:bg-white/[0.07] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold
                      ${w.coin === "DOGE" ? "bg-amber-500/20 text-amber-400" : ""}
                      ${w.coin === "POL" ? "bg-violet-500/20 text-violet-400" : ""}
                      ${w.coin === "BNB" ? "bg-yellow-500/20 text-yellow-400" : ""}
                    `}>
                      {COINS.find((c) => c.id === w.coin)?.icon || "?"}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white flex items-center flex-wrap gap-x-2">
                        <span>{w.amount?.toLocaleString()} Points → {w.coin}</span>
                        {w.crypto_amount && (
                          <span className="text-xs text-cyan-400 font-medium">
                            (≈ {(Number(w.crypto_amount) / 1e8).toFixed(8)} {w.coin})
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] text-white/40 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-0.5">
                        <span>
                          {new Date(w.created_at).toLocaleString("en-US", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {w.usd_value && <span>• ${Number(w.usd_value).toFixed(6)}</span>}
                        {w.tx_hash && (
                          <>
                            <span>•</span>
                            <span className="bg-white/5 px-1.5 py-0.5 rounded text-[9px] font-mono text-white/60">
                              Payout ID: #{w.tx_hash}
                            </span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {getStatusBadge(w.status)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
