"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"
import { 
  Coins, 
  Gamepad2, 
  ChevronRight, 
  ShieldCheck, 
  Zap, 
  Users
} from "lucide-react"

export function LandingPage() {
  const [stats, setStats] = useState({ total_users: 0, total_earned: 0, website_age_days: 0, total_paid_usd: 0 })
  const [recentWithdrawals, setRecentWithdrawals] = useState<any[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const statsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/stats")
        const data = await res.json()
        if (data.success) {
          setStats({
            total_users: data.total_users,
            total_earned: data.total_earned,
            website_age_days: data.website_age_days,
            total_paid_usd: data.total_paid_usd || 0
          })
          setRecentWithdrawals(data.recent_withdrawals || [])
        }
      } catch (err) {
        console.error("Failed to fetch landing stats:", err)
      } finally {
        setLoadingStats(false)
      }
    }
    fetchStats()
  }, [])

  const scrollToStats = () => {
    statsRef.current?.scrollIntoView({ behavior: "smooth" })
  }
  return (
    <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-purple-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-fuchsia-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-header h-20">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center shadow-lg">
              <Coins className="w-6 h-6" />
            </div>
            <span className="text-xl font-black tracking-tighter gradient-text">STREAMLET</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm font-bold text-white/60 hover:text-white transition-colors">Features</Link>
            <Link href="#rewards" className="text-sm font-bold text-white/60 hover:text-white transition-colors">Rewards</Link>
            <Link href="#community" className="text-sm font-bold text-white/60 hover:text-white transition-colors">Community</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/auth/login">
              <Button variant="ghost" className="font-bold text-white/80 hover:text-white">Sign In</Button>
            </Link>
            <Link href="/auth/register">
              <Button className="bg-purple-600 hover:bg-purple-700 text-white rounded-xl px-6 font-black shadow-lg shadow-purple-500/20">JOIN NOW</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-40 pb-20 px-6 relative z-10">
        <div className="max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 mb-8">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-black tracking-widest uppercase text-white/60">Fastest Faucet Platform 2026</span>
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] mb-8 uppercase">
              PLAY GAMES,<br />
              <span className="gradient-text">EARN CRYPTO.</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg md:text-xl text-white/60 font-medium mb-12">
              Collect Bitcoin and other popular crypto assets in the most fun way. 
              Claim faucets, watch ads, and withdraw your rewards instantly.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/register">
                <Button className="h-16 px-10 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xl shadow-[0_20px_40px_-10px_rgba(147,51,234,0.5)] group transition-all">
                  GET STARTED <ChevronRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <Button 
                onClick={scrollToStats}
                variant="outline" 
                className="h-16 px-10 rounded-2xl glass border-white/20 text-white font-black text-xl hover:bg-white/10"
              >
                VIEW STATS
              </Button>
            </div>

            {/* Trusted By */}
            <div className="mt-24 pt-12 border-t border-white/5">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 mb-8">INSTANT PAYMENT INTEGRATION</p>
              <div className="flex flex-wrap justify-center items-center gap-12 opacity-40 grayscale hover:grayscale-0 transition-all duration-700">
                <div className="text-3xl font-black tracking-tighter flex items-center gap-2">FAUCET<span>PAY</span></div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section ref={statsRef} id="stats" className="py-16 px-6 relative z-10 border-t border-white/5 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Stat 1: Users */}
            <div className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-purple-500/20 transition-all">
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                <Users className="w-32 h-32 text-white" />
              </div>
              <Users className="w-8 h-8 text-purple-400 mb-4" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-2">Total Users</span>
              <h2 className="text-4xl md:text-5xl font-black font-mono tracking-tighter text-white">
                {loadingStats ? "..." : stats.total_users.toLocaleString()}
              </h2>
            </div>

            {/* Stat 2: Earned */}
            <div className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-fuchsia-500/20 transition-all">
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                <Coins className="w-32 h-32 text-white" />
              </div>
              <Coins className="w-8 h-8 text-fuchsia-400 mb-4" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-2">Total Points Earned</span>
              <h2 className="text-4xl md:text-5xl font-black font-mono tracking-tighter text-white">
                {loadingStats ? "..." : `${stats.total_earned.toLocaleString()} pts`}
              </h2>
            </div>

            {/* Stat 3: Age */}
            <div className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-cyan-500/20 transition-all">
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                <Zap className="w-32 h-32 text-white" />
              </div>
              <Zap className="w-8 h-8 text-cyan-400 mb-4" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-2">Days Online</span>
              <h2 className="text-4xl md:text-5xl font-black font-mono tracking-tighter text-white">
                {loadingStats ? "..." : `${stats.website_age_days.toLocaleString()} Days`}
              </h2>
            </div>

            {/* Stat 4: Paid Out */}
            <div className="p-8 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center justify-center text-center relative overflow-hidden group hover:border-emerald-500/20 transition-all">
              <div className="absolute top-0 right-0 p-6 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                <ShieldCheck className="w-32 h-32 text-white" />
              </div>
              <ShieldCheck className="w-8 h-8 text-emerald-400 mb-4" />
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-2">Total Paid Out</span>
              <h2 className="text-4xl md:text-5xl font-black font-mono tracking-tighter text-white">
                {loadingStats ? "..." : `$${stats.total_paid_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`}
              </h2>
            </div>
          </div>

          {/* Recent Payouts Table */}
          <div className="mt-16 space-y-6">
            <div className="text-center">
              <h3 className="text-2xl font-black uppercase tracking-tight italic text-white mb-2">Recent Payouts</h3>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Live proof of payments processed through FaucetPay</p>
            </div>
            
            <div className="glass border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-white/5 bg-white/[0.02]">
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Date / Time</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Recipient (Masked)</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Coin</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-right">Amount</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-right">USD Value</th>
                      <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium text-sm">
                    {loadingStats ? (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-white/40 font-bold uppercase tracking-wider">
                          Loading recent payouts...
                        </td>
                      </tr>
                    ) : recentWithdrawals.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-10 text-center text-white/40 font-bold uppercase tracking-wider">
                          No recent payouts found.
                        </td>
                      </tr>
                    ) : (
                      recentWithdrawals.map((w, idx) => (
                        <tr key={idx} className="hover:bg-white/[0.01] transition-colors">
                          <td className="p-5 text-white/60 font-mono text-xs">
                            {new Date(w.created_at).toLocaleString()}
                          </td>
                          <td className="p-5 text-white font-mono text-xs">
                            {w.address}
                          </td>
                          <td className="p-5">
                            <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-white/5 border border-white/10 text-purple-400">
                              {w.coin}
                            </span>
                          </td>
                          <td className="p-5 text-right font-black font-mono text-white/80">
                            {w.amount.toLocaleString()} pts
                          </td>
                          <td className="p-5 text-right font-black font-mono text-emerald-400">
                            ${parseFloat(w.usd_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                          </td>
                          <td className="p-5 text-center">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider
                              ${w.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                                w.status === "failed" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : 
                                "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}
                            >
                              {w.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AD BANNER */}
      <div className="w-full max-w-7xl mx-auto px-6 pt-12">
        <div id="frame" style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }}>
          <iframe 
            data-aa='2441223' 
            src='//acceptable.a-ads.com/2441223/?size=Adaptive'
            style={{ border: 0, padding: 0, width: '70%', height: '90px', overflow: 'hidden', display: 'block', margin: 'auto' }}
          />
        </div>
      </div>

      {/* Features Grid */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all group">
              <div className="w-16 h-16 rounded-2xl bg-purple-600/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-2xl font-black mb-4">Lightning Withdrawals</h3>
              <p className="text-white/40 font-medium">Don't wait weeks. Withdraw your coins to FaucetPay in seconds after meeting the minimum threshold.</p>
            </div>

            <div className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-fuchsia-500/30 transition-all group">
              <div className="w-16 h-16 rounded-2xl bg-fuchsia-600/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <Gamepad2 className="w-8 h-8 text-fuchsia-400" />
              </div>
              <h3 className="text-2xl font-black mb-4">Interactive Games</h3>
              <p className="text-white/40 font-medium">Bored with regular faucets? Play exciting mini-games and daily challenges to multiply your earnings.</p>
            </div>

            <div className="p-10 rounded-[2.5rem] bg-white/5 border border-white/10 hover:border-cyan-500/30 transition-all group">
              <div className="w-16 h-16 rounded-2xl bg-cyan-600/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-2xl font-black mb-4">Multi-layer Security</h3>
              <p className="text-white/40 font-medium">We use blockchain-based security and Supabase to ensure your balance is 100% safe and vault-secured.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-20 border-t border-white/5 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-fuchsia-600 flex items-center justify-center">
              <Coins className="w-5 h-5" />
            </div>
            <span className="text-lg font-black tracking-tighter uppercase">STREAMLET</span>
          </div>
          <p className="text-sm font-bold text-white/20 uppercase tracking-widest">© 2026 Streamlet Development. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/terms" className="text-xs font-bold text-white/40 hover:text-white uppercase transition-colors">Term of Service</Link>
            <Link href="/privacy" className="text-xs font-bold text-white/40 hover:text-white uppercase transition-colors">Privacy Policy</Link>
            <a href="https://t.me/streamletfaucet" target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-sky-450 hover:text-sky-400 uppercase transition-colors flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.24-5.54 3.65-.52.36-1 .53-1.42.52-.47-.01-1.37-.27-2.03-.49-.82-.27-1.47-.41-1.42-.87.03-.24.36-.49.99-.74 3.89-1.69 6.48-2.8 7.77-3.32 3.7-1.5 4.46-1.76 4.96-1.77.11 0 .36.03.52.16.13.11.17.27.18.38 0 .08-.01.27-.02.35z"/>
              </svg>
              Telegram
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
