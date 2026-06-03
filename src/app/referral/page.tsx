"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Users, Copy, Check, Share2, Send, Loader2, Award, MousePointer2 } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/components/providers/AuthProvider"
import { createClient } from "@/lib/supabase"

// Custom SVG Icons
const FacebookIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
)

const TwitterIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
)

export default function ReferralPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  
  const [copied, setCopied] = useState(false)
  const [referralCode, setReferralCode] = useState("")
  const [stats, setStats] = useState({
    totalReferrals: 0,
    activeToday: 0,
    totalCommissions: 0
  })
  const [isLoadingStats, setIsLoadingStats] = useState(true)

  // Redirect if not logged in
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [user, loading, router])

  // Fetch Referral Stats
  useEffect(() => {
    async function fetchReferralData() {
      if (!user) return
      setIsLoadingStats(true)
      try {
        // Panggil fungsi RPC yang berjalan dengan SECURITY DEFINER (melewati RLS)
        const { data, error } = await supabase.rpc("get_referral_stats", {
          p_user_id: user.id,
        })

        if (error) throw error

        if (data) {
          setReferralCode(data.referral_code || "")
          setStats({
            totalReferrals: data.total_referrals || 0,
            activeToday: data.active_today || 0,
            totalCommissions: data.total_commissions || 0,
          })
        }
      } catch (error) {
        console.error("Error fetching referral stats:", error)
      } finally {
        setIsLoadingStats(false)
      }
    }

    if (user) {
      fetchReferralData()
    }
  }, [user, supabase])

  const origin = typeof window !== "undefined" ? window.location.origin : "https://streamlet.com"
  const referralLink = referralCode ? `${origin}/ref/${referralCode}` : "Loading..."

  const handleCopy = () => {
    if (!referralCode) return
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success("Referral link successfully copied!")
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#020617]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-black gradient-text uppercase tracking-tight italic">Referral Program</h2>
        <p className="text-white/60 font-bold uppercase tracking-widest text-xs">Invite your friends and earn 25% faucet commission for life!</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass md:col-span-2 border-white/10 rounded-[2.5rem] overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white font-bold uppercase text-lg">
              <Share2 className="w-5 h-5 text-primary" />
              Your Referral Link
            </CardTitle>
            <CardDescription className="text-white/40 italic">Share this link to start earning commissions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input 
                  value={referralLink} 
                  readOnly 
                  className="bg-white/5 border-white/10 text-white h-12 pr-12 rounded-2xl px-5 focus-visible:ring-primary font-mono text-sm"
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="absolute right-1 top-1 h-10 w-10 text-white/40 hover:text-white rounded-xl transition-colors"
                  onClick={handleCopy}
                  disabled={!referralCode}
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                className="flex-1 bg-blue-600/10 border-blue-600/20 hover:bg-blue-600/20 text-blue-400 gap-2 h-12 rounded-2xl font-bold uppercase text-xs"
                onClick={() => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`, '_blank')}
              >
                <FacebookIcon className="w-4 h-4" /> Facebook
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 bg-sky-500/10 border-sky-500/20 hover:bg-sky-500/20 text-sky-400 gap-2 h-12 rounded-2xl font-bold uppercase text-xs"
                onClick={() => window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join Streamlet to earn free crypto!")}`, '_blank')}
              >
                <TwitterIcon className="w-4 h-4" /> Twitter
              </Button>
              <Button 
                variant="outline" 
                className="flex-1 bg-cyan-600/10 border-cyan-600/20 hover:bg-cyan-600/20 text-cyan-400 gap-2 h-12 rounded-2xl font-bold uppercase text-xs"
                onClick={() => window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent("Join Streamlet to earn free crypto!")}`, '_blank')}
              >
                <Send className="w-4 h-4" /> Telegram
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="glass border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col justify-between">
          <CardHeader>
            <CardTitle className="text-white font-bold uppercase text-sm tracking-widest text-white/60">Referral Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pb-8">
            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
              <span className="text-white/50 font-bold uppercase text-xs">Total Referrals:</span>
              <span className="font-mono font-black text-white text-base">
                {isLoadingStats ? "..." : stats.totalReferrals}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-3">
              <span className="text-white/50 font-bold uppercase text-xs">Active Today:</span>
              <span className="font-mono font-black text-white text-base">
                {isLoadingStats ? "..." : stats.activeToday}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-white/50 font-bold uppercase text-xs">Total Commission:</span>
              <span className="font-mono font-black text-emerald-400 text-lg">
                {isLoadingStats ? "..." : `${stats.totalCommissions} Pts`}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {[
          { title: 'Faucet Claim', commission: '25%', desc: 'Earn a 25% commission from every faucet claim completed by your friends.', icon: Award },
          { title: 'Offerwalls', commission: '10%', desc: 'Get a 10% cut from every offerwall task completed by your referrals.', icon: MousePointer2 },
          { title: 'Shortlinks', commission: '10%', desc: 'Earn a 10% commission from every shortlink completed by your referrals.', icon: Share2 },
        ].map((item, i) => (
          <Card key={i} className="glass group hover:bg-primary/5 transition-colors border-white/5 rounded-[2rem] p-4">
            <CardHeader className="pb-3">
              <Badge className="w-fit mb-3 bg-primary/20 text-primary border-primary/20 font-black uppercase text-[10px] tracking-wider px-3 py-1 rounded-full">{item.commission} Commission</Badge>
              <CardTitle className="text-white font-black uppercase text-lg italic flex items-center gap-2">
                <item.icon className="w-5 h-5 text-purple-400" />
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-white/50 font-medium italic">{item.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
