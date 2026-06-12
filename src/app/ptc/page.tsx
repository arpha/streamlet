"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  MousePointer2, 
  Clock, 
  Coins, 
  Sparkles, 
  Eye, 
  Loader2, 
  ExternalLink,
  ShieldCheck 
} from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function PTCPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchPTCAds = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/ptc")
      const data = await res.json()
      if (data.success) {
        setCampaigns(data.campaigns || [])
      } else {
        toast.error(data.message || "Gagal memuat iklan PTC.")
      }
    } catch (err) {
      toast.error("Terjadi kesalahan koneksi.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPTCAds()
  }, [])

  const handleWatchAd = (campaign: any) => {
    // Open target website in a new window/tab
    window.open(campaign.url, "_blank", "noopener,noreferrer")
    
    // Redirect current page to the timer verification page
    router.push(`/ptc/view?id=${campaign.id}`)
  }

  const totalPointsAvailable = campaigns.reduce((acc, c) => acc + c.reward_per_view, 0)

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold gradient-text">Pay-To-Click (PTC)</h2>
          <p className="text-muted-foreground">Visit advertiser websites for a few seconds to earn free points.</p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchPTCAds}
          disabled={isLoading}
          className="glass border-white/5 hover:bg-white/10 gap-1 text-xs font-semibold self-start md:self-auto"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          Refresh Ads
        </Button>
      </div>

      {/* Stats Summary Banner */}
      {!isLoading && campaigns.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-5 rounded-2xl glass border-primary/20 relative overflow-hidden bg-primary/5">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Eye className="w-6 h-6 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Ads Available</div>
              <div className="text-xl font-bold font-mono text-white">{campaigns.length} Ads</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-yellow-500/10">
              <Coins className="w-6 h-6 text-yellow-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Earning Potential</div>
              <div className="text-xl font-bold font-mono text-yellow-500">+{totalPointsAvailable.toLocaleString()} Points</div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-semibold">Loading active PTC ads list...</p>
        </div>
      ) : campaigns.length === 0 ? (
        <Card className="glass border-white/5 py-16 text-center">
          <CardContent className="flex flex-col items-center gap-4">
            <MousePointer2 className="w-16 h-16 text-primary/30" />
            <h3 className="text-2xl font-bold text-white">No ads available</h3>
            <p className="text-muted-foreground max-w-sm">
              All ads have been visited or their daily limits/quotas have run out. Please check back later!
            </p>
            <Button className="mt-2 neon-glow font-semibold" onClick={() => router.push("/advertise")}>
              Create Your Own Ad
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <Card key={c.id} className="glass border-white/5 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 flex flex-col justify-between overflow-hidden group">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span className="flex items-center gap-1 font-mono">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    {c.duration} Seconds
                  </span>
                  <span className="flex items-center gap-1 font-mono text-yellow-500 font-bold bg-yellow-500/5 px-2 py-0.5 rounded-full">
                    <Coins className="w-3.5 h-3.5" />
                    +{c.reward_per_view} Points
                  </span>
                </div>
                <CardTitle className="text-base line-clamp-2 text-white group-hover:text-primary transition-colors">
                  {c.title}
                </CardTitle>
              </CardHeader>
              
              <CardContent className="pt-0 space-y-4">
                <p className="text-xs text-zinc-500 truncate">{c.url}</p>
                <Button 
                  className="w-full neon-glow font-bold text-xs gap-2 py-5"
                  onClick={() => handleWatchAd(c)}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> VISIT & CLAIM
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Trust Feature List */}
      <div className="grid gap-6 md:grid-cols-3 pt-6 border-t border-white/5">
        {[
          { icon: ShieldCheck, title: 'Anti-Bot Protection', desc: 'We use layered captcha verification to ensure ads are viewed by real humans.' },
          { icon: Sparkles, title: 'Instant Points & XP', desc: 'Points and XP are directly added to your balance once the countdown finishes.' },
          { icon: MousePointer2, title: '24-Hour Cycle', desc: 'Ads reset 24 hours after your last view.' },
        ].map((item, i) => (
          <div key={i} className="flex gap-4 p-4 rounded-2xl glass border-white/5">
            <item.icon className="w-6 h-6 text-primary flex-shrink-0" />
            <div>
              <h4 className="font-bold text-sm text-white">{item.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
