"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Gamepad2, 
  Coins, 
  HelpCircle, 
  Info, 
  CheckCircle2, 
  ShieldCheck,
  MousePointer2
} from "lucide-react"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"

export default function OfferwallsPage() {
  const router = useRouter()
  const { id: userId } = useStore()
  const [apiKey, setApiKey] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    // Load the public BitcoTasks API Key from env
    const key = process.env.NEXT_PUBLIC_BITCOTASKS_API_KEY || ""
    setApiKey(key)
    setLoading(false)
  }, [])

  const handleLoginRedirect = () => {
    router.push("/auth/login")
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* HEADER */}
      <div className="text-center md:text-left relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest mb-4">
          <Gamepad2 className="w-3.5 h-3.5" />
          Offerwalls Wall
        </div>
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 italic uppercase">OFFERWALLS</h2>
        <p className="text-white/60 font-medium italic">Complete surveys, install apps, and complete online tasks to earn massive points!</p>
      </div>

      {/* EXPLANATION CARDS */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Card 1: Provider Name */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Offerwall Provider</span>
              <span className="text-2xl font-black font-mono text-amber-400">BitcoTasks</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <Gamepad2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Conversion Rate */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Conversion Rate</span>
              <span className="text-2xl font-black font-mono text-cyan-400">200,000 Pts / $1</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
              <Coins className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Referral Commission */}
        <Card className="glass border-white/10 rounded-[2rem] shadow-xl overflow-hidden relative group">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Referral Bonus</span>
              <span className="text-2xl font-black font-mono text-emerald-400">10% Commission</span>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <MousePointer2 className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* USER CHECK */}
      {!userId ? (
        <Card className="glass border-white/10 rounded-[2rem] p-8 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Info className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Authentication Required</h3>
            <p className="text-white/60 text-sm">
              Please sign in to your account to access offerwalls. Your user ID is required to credit points to your balance upon offer completion.
            </p>
            <Button 
              onClick={handleLoginRedirect}
              className="bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-bold rounded-2xl px-8 py-6 h-auto shadow-lg shadow-purple-500/20 uppercase tracking-wider"
            >
              Sign In Now
            </Button>
          </div>
        </Card>
      ) : !apiKey ? (
        // Guide to setup when API key is missing
        <Card className="glass border-white/10 rounded-[2rem] p-8 space-y-6">
          <div className="space-y-4 text-center max-w-2xl mx-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Offerwall Configuration Needed</h3>
            <p className="text-white/60 text-sm">
              BitcoTasks API key has not been configured in the environment variables yet.
            </p>
            
            <div className="text-left bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-xs text-white/80 space-y-2">
              <p className="text-purple-400 font-bold"># How to enable BitcoTasks Offerwall:</p>
              <p>1. Get your **API Key** (Website Key) and **Secret Key** from your BitcoTasks Publisher dashboard.</p>
              <p>2. Add the following variables to your <code className="text-cyan-400">.env.local</code> file:</p>
              <pre className="bg-black/60 p-3 rounded-lg mt-2 text-emerald-400">
{`NEXT_PUBLIC_BITCOTASKS_API_KEY=your_bitcotasks_api_key
BITCOTASKS_SECRET_KEY=your_bitcotasks_secret_key`}
              </pre>
              <p className="mt-2 text-white/40">3. Restart your dev server to apply the env changes.</p>
            </div>
          </div>
        </Card>
      ) : (
        // IFRAME INTEGRATION
        <div className="space-y-4">
          <div className="flex justify-between items-center px-4">
            <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              BitcoTasks Offerwall Loaded
            </span>
            <span className="text-xs text-white/40 font-mono">User: {userId.substring(0, 8)}...</span>
          </div>
          
          <div className="glass border border-white/10 rounded-[2rem] overflow-hidden bg-black/20 shadow-2xl relative">
            <iframe 
              src={`https://bitcotasks.com/offerwall/${apiKey}/${userId}`}
              style={{ width: "100%", height: "800px", border: "none" }}
              title="BitcoTasks Offerwall"
              className="w-full"
              scrolling="yes"
            />
          </div>
        </div>
      )}

      {/* FOOTER RULES */}
      <Card className="glass border-white/10 rounded-[2rem] overflow-hidden relative group">
        <div className="p-6 md:p-8 space-y-4">
          <h4 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            Offerwalls Rules & Guidelines
          </h4>
          <ul className="grid gap-3 text-xs md:text-sm text-white/60 font-medium">
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Use real and honest information when completing surveys. Random or fake answers will result in reward rejection by BitcoTasks.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Using VPNs, Proxies, or other location spoofing tools is strictly prohibited. Violations will result in a permanent account suspension.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Point rewards may take anywhere from a few minutes up to 24 hours to process depending on the task type (e.g. game installations require level completion verification).</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>If you experience issues with points not being credited after completing a task, please click the support/help button directly inside the BitcoTasks widget.</span>
            </li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
