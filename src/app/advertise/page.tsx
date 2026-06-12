"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Megaphone, 
  MousePointer2, 
  CheckCircle2, 
  AlertTriangle, 
  Coins, 
  ArrowRightLeft, 
  Wallet, 
  History, 
  Sparkles, 
  Plus, 
  ExternalLink, 
  Eye, 
  Clock, 
  Loader2 
} from "lucide-react"
import { useStore } from "@/store/useStore"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { motion, AnimatePresence } from "framer-motion"

const PRICING_TIERS = [
  { duration: 10, cost: 70, reward: 40, label: "10 Detik" },
  { duration: 30, cost: 150, reward: 100, label: "30 Detik" },
  { duration: 60, cost: 250, reward: 160, label: "60 Detik" },
  { duration: 120, cost: 450, reward: 300, label: "120 Detik" },
]

const TOKEN_TO_USD_RATE = 0.000005 // 1 Token = $0.000005 USD

export default function AdvertisePage() {
  const { balance, advertiserTokens, setBalance, setAdvertiserTokens } = useStore()
  const supabase = createClient()

  // Tabs state
  const [activeTab, setActiveTab] = useState("ptc-create")

  // Create Campaign State
  const [campaignTitle, setCampaignTitle] = useState("")
  const [campaignUrl, setCampaignUrl] = useState("")
  const [campaignDuration, setCampaignDuration] = useState(10)
  const [campaignViews, setCampaignViews] = useState(100)
  const [campaignDailyViewsLimit, setCampaignDailyViewsLimit] = useState<string>("")
  const [isCreatingCampaign, setIsCreatingCampaign] = useState(false)

  // Exchange State
  const [exchangePoints, setExchangePoints] = useState(1000)
  const [isExchanging, setIsExchanging] = useState(false)

  // Deposit State
  const [depositTokens, setDepositTokens] = useState(10000)
  const [isDepositing, setIsDepositing] = useState(false)

  // Campaigns List State
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false)

  // Fetch campaigns
  const fetchCampaigns = async () => {
    setIsLoadingCampaigns(true)
    try {
      const res = await fetch("/api/advertise/campaigns")
      const data = await res.json()
      if (data.success) {
        setCampaigns(data.campaigns || [])
      } else {
        toast.error(data.message || "Gagal memuat kampanye iklan.")
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi.")
    } finally {
      setIsLoadingCampaigns(false)
    }
  }

  useEffect(() => {
    fetchCampaigns()
    
    // Check url search params for deposit success/cancel
    const params = new URLSearchParams(window.location.search)
    if (params.get("deposit") === "success") {
      toast.success("Deposit berhasil! Saldo Token Anda akan segera diperbarui.")
      // Clean url params
      window.history.replaceState({}, document.title, window.location.pathname)
    } else if (params.get("deposit") === "cancel") {
      toast.error("Deposit dibatalkan oleh pengguna.")
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  // Calculate campaign price
  const selectedTier = PRICING_TIERS.find(t => t.duration === campaignDuration) || PRICING_TIERS[0]
  const totalCampaignCost = selectedTier.cost * campaignViews

  // Create Campaign Handler
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!campaignTitle.trim()) return toast.error("Judul kampanye wajib diisi.")
    if (!campaignUrl.trim() || !campaignUrl.startsWith("http")) return toast.error("URL harus valid dan diawali dengan http:// atau https://.")
    if (campaignViews < 50) return toast.error("Jumlah tayangan minimal adalah 50 views.")

    const dailyLimit = campaignDailyViewsLimit ? parseInt(campaignDailyViewsLimit) : null
    if (dailyLimit !== null && (isNaN(dailyLimit) || dailyLimit <= 0)) {
      return toast.error("Limit tayangan harian harus lebih dari 0.")
    }
    if (dailyLimit !== null && dailyLimit > campaignViews) {
      return toast.error("Limit tayangan harian tidak boleh melebihi total tayangan.")
    }

    setIsCreatingCampaign(true)
    try {
      const res = await fetch("/api/advertise/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: campaignTitle,
          url: campaignUrl,
          duration: campaignDuration,
          totalViews: campaignViews,
          dailyViewsLimit: dailyLimit,
        })
      })
      const data = await res.json()
      if (data.success) {
        toast.success("Kampanye iklan berhasil dibuat dan aktif!")
        setCampaignTitle("")
        setCampaignUrl("")
        setCampaignViews(100)
        setCampaignDailyViewsLimit("")
        setAdvertiserTokens(data.new_tokens ?? (advertiserTokens - totalCampaignCost))
        fetchCampaigns()
      } else {
        toast.error(data.message || "Gagal membuat kampanye.")
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat memproses kampanye.")
    } finally {
      setIsCreatingCampaign(false)
    }
  }

  // Exchange points to tokens Handler
  const handleExchange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (exchangePoints <= 0) return toast.error("Jumlah poin tidak valid.")
    if (balance < exchangePoints) return toast.error("Saldo poin Anda tidak mencukupi.")

    setIsExchanging(true)
    try {
      const res = await fetch("/api/advertise/exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: exchangePoints })
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Berhasil menukar ${exchangePoints.toLocaleString()} Poin menjadi ${exchangePoints.toLocaleString()} Token!`)
        setBalance(data.new_balance)
        setAdvertiserTokens(data.new_tokens)
      } else {
        toast.error(data.message || "Gagal menukar poin.")
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat menukar poin.")
    } finally {
      setIsExchanging(false)
    }
  }

  // FaucetPay Merchant Deposit Handler
  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (depositTokens < 1000) return toast.error("Minimal deposit adalah 1,000 Token.")

    setIsDepositing(true)
    try {
      const res = await fetch("/api/advertise/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: depositTokens })
      })
      const data = await res.json()
      if (data.success && data.action) {
        // Create a hidden form and submit to FaucetPay
        const form = document.createElement("form")
        form.method = "POST"
        form.action = data.action

        for (const [key, val] of Object.entries(data.fields)) {
          const input = document.createElement("input")
          input.type = "hidden"
          input.name = key
          input.value = val as string
          form.appendChild(input)
        }

        document.body.appendChild(form)
        form.submit()
      } else {
        toast.error(data.message || "Gagal menyiapkan gerbang pembayaran.")
      }
    } catch (err) {
      toast.error("Gagal terhubung ke gerbang pembayaran.")
    } finally {
      setIsDepositing(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold gradient-text">Advertiser Dashboard</h2>
          <p className="text-muted-foreground">Promosikan situs web Anda ke ribuan pengguna aktif Streamlet.</p>
        </div>
      </div>

      {/* Saldo Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass border-primary/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Coins className="w-24 h-24 text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary animate-pulse" />
              SALDO TOKEN IKLAN
            </CardTitle>
            <div className="text-4xl font-extrabold font-mono text-primary flex items-baseline gap-1 mt-2">
              {advertiserTokens.toLocaleString()}
              <span className="text-xs text-muted-foreground font-normal">Tokens</span>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Digunakan khusus untuk membuat kampanye iklan PTC.
          </CardContent>
        </Card>

        <Card className="glass border-white/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Sparkles className="w-24 h-24 text-primary" />
          </div>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Coins className="w-4 h-4 text-yellow-500" />
              SALDO POIN FAUCET
            </CardTitle>
            <div className="text-4xl font-extrabold font-mono text-yellow-500 flex items-baseline gap-1 mt-2">
              {balance.toLocaleString()}
              <span className="text-xs text-muted-foreground font-normal">Points</span>
            </div>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground flex justify-between items-center">
            <span>Dapat ditukarkan langsung ke Token Iklan (1:1).</span>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-xs text-primary hover:text-primary-hover p-0"
              onClick={() => setActiveTab("exchange")}
            >
              Tukar Sekarang →
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 glass p-1 gap-1 h-auto">
          <TabsTrigger value="ptc-create" className="gap-2 py-2 data-[state=active]:bg-primary transition-all">
            <Plus className="w-4 h-4" /> Pasang PTC
          </TabsTrigger>
          <TabsTrigger value="exchange" className="gap-2 py-2 data-[state=active]:bg-primary transition-all">
            <ArrowRightLeft className="w-4 h-4" /> Tukar Poin
          </TabsTrigger>
          <TabsTrigger value="deposit" className="gap-2 py-2 data-[state=active]:bg-primary transition-all">
            <Wallet className="w-4 h-4" /> Deposit Crypto
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-2 py-2 data-[state=active]:bg-primary transition-all">
            <History className="w-4 h-4" /> Kampanye Saya
          </TabsTrigger>
        </TabsList>
        
        {/* Tab 1: Create PTC Campaign */}
        <TabsContent value="ptc-create" className="mt-6">
          <div className="grid gap-6 md:grid-cols-3">
            {/* Pricing List */}
            <div className="space-y-6">
              <Card className="glass h-fit border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Coins className="w-5 h-5 text-primary" />
                    Tarif PTC Terbaru
                  </CardTitle>
                  <CardDescription>Biaya per tayangan berdasarkan durasi timer.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {PRICING_TIERS.map((tier) => (
                    <div key={tier.duration} className="flex justify-between items-center p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm">{tier.label}</span>
                        <span className="text-xs text-emerald-400">Reward: {tier.reward} Poin</span>
                      </div>
                      <span className="font-extrabold text-primary font-mono text-sm">{tier.cost} Token</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="p-4 rounded-xl glass border-white/5 space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2 text-yellow-500 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  Aturan & Kebijakan Iklan
                </div>
                <p>1. Situs web tidak boleh mengandung malware, virus, atau pop-up paksaan.</p>
                <p>2. Tidak diperbolehkan mengiklankan konten ilegal, rasisme, atau kekerasan.</p>
                <p>3. Dana kampanye yang sudah dipotong tidak dapat dikembalikan setelah iklan tayang.</p>
              </div>
            </div>

            {/* Campaign Form */}
            <Card className="glass md:col-span-2 border-white/5">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Plus className="w-5 h-5 text-primary" />
                  Buat Kampanye PTC Baru
                </CardTitle>
                <CardDescription>Isi detail iklan di bawah untuk memulai promosi.</CardDescription>
              </CardHeader>
              <form onSubmit={handleCreateCampaign}>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="title">Judul Iklan</Label>
                    <Input 
                      id="title" 
                      placeholder="Contoh: Streamlet Faucet - Earn Free Crypto Now!" 
                      className="glass border-white/10" 
                      value={campaignTitle}
                      onChange={(e) => setCampaignTitle(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="url">URL Kampanye</Label>
                    <Input 
                      id="url" 
                      type="url"
                      placeholder="https://situs-anda.com/ref?id=123" 
                      className="glass border-white/10" 
                      value={campaignUrl}
                      onChange={(e) => setCampaignUrl(e.target.value)}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="duration">Durasi Timer</Label>
                      <select
                        id="duration"
                        className="w-full h-10 px-3 rounded-md bg-zinc-900 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        value={campaignDuration}
                        onChange={(e) => setCampaignDuration(Number(e.target.value))}
                      >
                        {PRICING_TIERS.map(t => (
                          <option key={t.duration} value={t.duration}>{t.label} ({t.cost} Token)</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="views">Jumlah Tayangan (Views)</Label>
                      <Input 
                        id="views" 
                        type="number" 
                        min="50"
                        step="10"
                        placeholder="Minimal 50" 
                        className="glass border-white/10" 
                        value={campaignViews}
                        onChange={(e) => setCampaignViews(Math.max(50, Number(e.target.value)))}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="daily-limit">Limit Tayangan / Hari (Opsional)</Label>
                      <Input 
                        id="daily-limit" 
                        type="number" 
                        min="1"
                        placeholder="Tanpa limit" 
                        className="glass border-white/10" 
                        value={campaignDailyViewsLimit}
                        onChange={(e) => setCampaignDailyViewsLimit(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-muted-foreground">Kalkulasi Total Biaya:</div>
                      <div className="text-xs text-muted-foreground">
                        {campaignViews.toLocaleString()} views x {selectedTier.cost} Tokens
                      </div>
                    </div>
                    <div className="text-2xl font-extrabold font-mono text-primary">
                      {totalCampaignCost.toLocaleString()} Tokens
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12 neon-glow font-bold text-sm gap-2"
                    disabled={isCreatingCampaign}
                  >
                    {isCreatingCampaign ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        MEMBUAT KAMPANYE...
                      </>
                    ) : (
                      <>
                        <Megaphone className="w-4 h-4" />
                        SUBMIT KAMPANYE IKLAN
                      </>
                    )}
                  </Button>
                </CardContent>
              </form>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 2: Exchange Points to Tokens */}
        <TabsContent value="exchange" className="mt-6">
          <Card className="glass max-w-xl mx-auto border-white/5">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-primary" />
                Tukar Poin ke Token Iklan
              </CardTitle>
              <CardDescription>
                Konversikan saldo poin faucet Anda secara instan ke token iklan dengan rasio 1:1.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleExchange}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <Label htmlFor="exchange-amount">Jumlah Poin yang Ditukar</Label>
                    <span className="text-xs text-muted-foreground">Maksimal: {balance.toLocaleString()} Poin</span>
                  </div>
                  <Input 
                    id="exchange-amount"
                    type="number"
                    min="1"
                    max={balance}
                    value={exchangePoints}
                    onChange={(e) => setExchangePoints(Math.min(balance, Number(e.target.value)))}
                    className="glass border-white/10 text-center text-xl font-bold font-mono py-6"
                  />
                  <div className="flex justify-center gap-2 mt-2">
                    {[100, 500, 1000, 5000, 10000].map(amt => (
                      <Button
                        key={amt}
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={balance < amt}
                        className="text-xs glass border-white/5 hover:bg-white/10"
                        onClick={() => setExchangePoints(Math.min(balance, amt))}
                      >
                        +{amt.toLocaleString()}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={balance <= 0}
                      className="text-xs glass border-white/5 hover:bg-white/10 text-primary"
                      onClick={() => setExchangePoints(balance)}
                    >
                      MAX
                    </Button>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between">
                  <div className="text-center flex-1">
                    <div className="text-xs text-muted-foreground">Poin Faucet</div>
                    <div className="text-lg font-bold font-mono text-yellow-500 mt-1">-{exchangePoints.toLocaleString()}</div>
                  </div>
                  <ArrowRightLeft className="w-5 h-5 text-muted-foreground" />
                  <div className="text-center flex-1">
                    <div className="text-xs text-muted-foreground">Token Iklan</div>
                    <div className="text-lg font-bold font-mono text-primary mt-1">+{exchangePoints.toLocaleString()}</div>
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 neon-glow font-bold text-sm gap-2"
                  disabled={isExchanging || exchangePoints <= 0}
                >
                  {isExchanging ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      MEMPROSES PENUKARAN...
                    </>
                  ) : (
                    <>
                      <ArrowRightLeft className="w-4 h-4" />
                      TUKAR POIN INSTAN
                    </>
                  )}
                </Button>
              </CardContent>
            </form>
          </Card>
        </TabsContent>

        {/* Tab 3: Deposit Crypto (FaucetPay Merchant) */}
        <TabsContent value="deposit" className="mt-6">
          <Card className="glass max-w-xl mx-auto border-white/5">
            <CardHeader className="text-center">
              <CardTitle className="text-xl flex items-center justify-center gap-2">
                <Wallet className="w-5 h-5 text-primary" />
                Deposit Token via FaucetPay
              </CardTitle>
              <CardDescription>
                Membeli token secara otomatis menggunakan pembayaran FaucetPay Merchant API.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleDeposit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="deposit-amount">Jumlah Token Iklan yang Ingin Dibeli</Label>
                  <Input 
                    id="deposit-amount"
                    type="number"
                    min="1000"
                    step="1000"
                    value={depositTokens}
                    onChange={(e) => setDepositTokens(Math.max(1000, Number(e.target.value)))}
                    className="glass border-white/10 text-center text-xl font-bold font-mono py-6"
                  />
                  <span className="text-xs text-muted-foreground block text-center mt-1">
                    Minimal deposit: 1,000 Token. Nilai konversi: 1 Token = $0.000005 USD.
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                  <div className="text-left">
                    <span className="text-xs text-muted-foreground block">Total Tagihan (USD):</span>
                    <span className="text-2xl font-extrabold font-mono text-primary">
                      ${(depositTokens * TOKEN_TO_USD_RATE).toFixed(4)}
                    </span>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    10k Token = $0.05 USD <br />
                    100k Token = $0.50 USD
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 neon-glow font-bold text-sm gap-2"
                  disabled={isDepositing || depositTokens < 1000}
                >
                  {isDepositing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      MENGHUBUNGKAN KE FAUCETPAY...
                    </>
                  ) : (
                    <>
                      <Wallet className="w-4 h-4" />
                      BAYAR DENGAN FAUCETPAY
                    </>
                  )}
                </Button>
              </CardContent>
            </form>
          </Card>
        </TabsContent>

        {/* Tab 4: My Campaigns List */}
        <TabsContent value="campaigns" className="mt-6">
          <Card className="glass border-white/5">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Kampanye PTC Anda</CardTitle>
                <CardDescription>Kelola dan pantau progres iklan yang telah Anda pasang.</CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="glass border-white/5 hover:bg-white/10 gap-1 text-xs"
                onClick={fetchCampaigns}
                disabled={isLoadingCampaigns}
              >
                {isLoadingCampaigns ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingCampaigns && campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm">Memuat data kampanye...</p>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-center gap-2">
                  <Megaphone className="w-12 h-12 text-primary/40" />
                  <h4 className="font-semibold text-lg text-white">Belum ada kampanye</h4>
                  <p className="text-sm max-w-xs">
                    Anda belum membuat kampanye iklan apa pun. Klik tab "Pasang PTC" untuk memulai.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm text-zinc-300">
                    <thead>
                      <tr className="border-b border-white/5 text-zinc-400 font-medium">
                        <th className="py-3 px-4">Kampanye</th>
                        <th className="py-3 px-4">Durasi</th>
                        <th className="py-3 px-4">Tayangan (Views)</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Tanggal Dibuat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c) => {
                        const percent = Math.min(100, Math.floor((c.views_completed / c.total_views) * 100))
                        return (
                          <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="py-4 px-4 max-w-xs">
                              <div className="font-semibold text-white truncate">{c.title}</div>
                              <a 
                                href={c.url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs text-primary hover:underline flex items-center gap-1 mt-1 truncate"
                              >
                                {c.url} <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                            <td className="py-4 px-4 font-mono text-xs">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-400" /> {c.duration}s
                              </span>
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col gap-1 w-36">
                                <div className="flex justify-between text-xs font-mono">
                                  <span>Total: {c.views_completed}</span>
                                  <span className="text-zinc-500">/ {c.total_views}</span>
                                </div>
                                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden mb-1">
                                  <div className="bg-primary h-full rounded-full" style={{ width: `${percent}%` }} />
                                </div>
                                {c.daily_views_limit ? (
                                  <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                                    <span>Hari Ini: {c.daily_views_completed || 0}</span>
                                    <span>Limit: {c.daily_views_limit}</span>
                                  </div>
                                ) : (
                                  <div className="text-[10px] text-zinc-500 italic">Tanpa limit harian</div>
                                )}
                              </div>
                            </td>
                            <td className="py-4 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                c.status === "active" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                                c.status === "completed" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                                "bg-zinc-800 text-zinc-400 border border-zinc-700"
                              }`}>
                                {c.status}
                              </span>
                            </td>
                            <td className="py-4 px-4 text-xs text-zinc-400 font-mono">
                              {new Date(c.created_at).toLocaleDateString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}
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
        </TabsContent>
      </Tabs>
    </div>
  )
}
