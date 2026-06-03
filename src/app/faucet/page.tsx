"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Coins, 
  Timer, 
  CheckCircle2, 
  Loader2, 
  Sparkles, 
  ShieldCheck
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import Script from "next/script"

declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: any) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
    hcaptcha?: {
      render: (container: string | HTMLElement, options: any) => string
      reset: (widgetId?: string) => void
      remove: (widgetId?: string) => void
    }
  }
}

export default function FaucetPage() {
  const [timeLeft, setTimeLeft] = useState(0)
  const [isClaiming, setIsClaiming] = useState(false)
  const [loadingCooldown, setLoadingCooldown] = useState(true)
  const [rewardAmount, setRewardAmount] = useState<number>(10)
  const [loadingReward, setLoadingReward] = useState(true)

  // CAPTCHA STATES
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [hcaptchaLoaded, setHcaptchaLoaded] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null)

  const turnstileRef = useRef<HTMLDivElement>(null)
  const hcaptchaRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const hcaptchaWidgetId = useRef<string | null>(null)

  const { id: userId, setBalance } = useStore()
  const supabase = createClient()
  const router = useRouter()

  const cooldownMinutes = 5

  // Check if window global captcha objects are already loaded
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.turnstile) setTurnstileLoaded(true)
      if (window.hcaptcha) setHcaptchaLoaded(true)
    }
  }, [])

  // Initialize Turnstile
  useEffect(() => {
    if (!turnstileLoaded || !turnstileRef.current || !window.turnstile) return

    const sitekey = process.env.NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"

    try {
      if (turnstileWidgetId.current) {
        window.turnstile.remove(turnstileWidgetId.current)
      }

      const widgetId = window.turnstile.render(turnstileRef.current, {
        sitekey,
        theme: "dark",
        callback: (token: string) => {
          setTurnstileToken(token)
        },
        "expired-callback": () => {
          setTurnstileToken(null)
        },
        "error-callback": () => {
          setTurnstileToken(null)
        },
      })
      turnstileWidgetId.current = widgetId
    } catch (err) {
      console.error("Turnstile render error:", err)
    }

    return () => {
      if (turnstileWidgetId.current && window.turnstile) {
        try {
          window.turnstile.remove(turnstileWidgetId.current)
        } catch (e) {}
      }
    }
  }, [turnstileLoaded])

  // Initialize hCaptcha
  useEffect(() => {
    if (!hcaptchaLoaded || !hcaptchaRef.current || !window.hcaptcha) return

    const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001"

    try {
      if (hcaptchaWidgetId.current) {
        window.hcaptcha.reset(hcaptchaWidgetId.current)
      }

      const widgetId = window.hcaptcha.render(hcaptchaRef.current, {
        sitekey,
        theme: "dark",
        callback: (token: string) => {
          setHcaptchaToken(token)
        },
        "expired-callback": () => {
          setHcaptchaToken(null)
        },
        "error-callback": () => {
          setHcaptchaToken(null)
        },
      })
      hcaptchaWidgetId.current = widgetId
    } catch (err) {
      console.error("hCaptcha render error:", err)
    }

    return () => {
      if (hcaptchaWidgetId.current && window.hcaptcha) {
        try {
          window.hcaptcha.reset(hcaptchaWidgetId.current)
        } catch (e) {}
      }
    }
  }, [hcaptchaLoaded])

  const resetCaptchas = () => {
    setTurnstileToken(null)
    setHcaptchaToken(null)
    if (window.turnstile && turnstileWidgetId.current) {
      window.turnstile.reset(turnstileWidgetId.current)
    }
    if (window.hcaptcha && hcaptchaWidgetId.current) {
      window.hcaptcha.reset(hcaptchaWidgetId.current)
    }
  }

  const captchaVerified = !!turnstileToken && !!hcaptchaToken

  // Fetch reward amount from database
  useEffect(() => {
    async function fetchReward() {
      try {
        const { data, error } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'faucet_reward')
          .limit(1)
        
        if (data && data.length > 0) {
          setRewardAmount(Number(data[0].value))
        }
      } catch (err) {
        console.error("Error fetching reward:", err)
      } finally {
        setLoadingReward(false)
      }
    }
    fetchReward()
  }, [supabase])

  // Check last claim and set cooldown
  useEffect(() => {
    async function checkCooldown() {
      if (!userId) {
        setLoadingCooldown(false)
        return
      }

      const { data } = await supabase
        .from('faucet_claims')
        .select('claimed_at')
        .eq('user_id', userId)
        .order('claimed_at', { ascending: false })
        .limit(1)
      
      if (data && data.length > 0) {
        const lastClaim = new Date(data[0].claimed_at).getTime()
        const now = new Date().getTime()
        const diffInSeconds = Math.floor((now - lastClaim) / 1000)
        const cooldownInSeconds = cooldownMinutes * 60
        
        if (diffInSeconds < cooldownInSeconds) {
          setTimeLeft(cooldownInSeconds - diffInSeconds)
        }
      }
      setLoadingCooldown(false)
    }

    checkCooldown()
  }, [userId, supabase])

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000)
      return () => clearInterval(timer)
    }
  }, [timeLeft])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleClaim = async () => {
    if (!userId) {
      toast.error("Please login to claim points")
      router.push("/auth/login")
      return
    }

    setIsClaiming(true)
    
    try {
      const response = await fetch("/api/faucet/claim", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          turnstileToken,
          hcaptchaToken,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        toast.error(result.message || "Failed to claim")
        resetCaptchas()
        return
      }

      if (result.new_balance !== undefined) {
        setBalance(result.new_balance)
      }
      
      setTimeLeft(cooldownMinutes * 60)
      resetCaptchas()
      
      toast.success(result.message || `Successfully claimed ${result.reward_given} Points!`, {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />
      })
    } catch (error: any) {
      toast.error(error.message || "Failed to claim faucet")
      resetCaptchas()
    } finally {
      setIsClaiming(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-10 pb-10 px-4">
      {/* CAPTCHA SCRIPTS */}
      <Script 
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" 
        onLoad={() => setTurnstileLoaded(true)}
        strategy="afterInteractive"
      />
      <Script 
        src="https://js.hcaptcha.com/1/api.js?render=explicit" 
        onLoad={() => setHcaptchaLoaded(true)}
        strategy="afterInteractive"
      />

      {/* TOP BANNER */}
      <div className="w-full flex justify-center">
        <Card className="glass w-full max-w-4xl h-32 flex items-center justify-center p-6 border-white/5 bg-white/[0.02] rounded-[2rem] overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5 opacity-50" />
          <p className="relative z-10 text-white/10 font-bold text-sm tracking-tighter uppercase">Horizontal Advertisement Area</p>
        </Card>
      </div>

      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-fuchsia-400 animate-pulse" />
          <span className="text-xs font-bold text-fuchsia-400 uppercase tracking-[0.2em]">Security Protocol Active</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 italic uppercase">FAUCET</h2>
        <p className="text-white/60 font-medium italic">Complete the challenge to earn {rewardAmount} points!</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 items-start">
        {/* LEFT BANNER */}
        <div className="hidden lg:block lg:col-span-2">
          <Card className="glass h-full flex flex-col items-center justify-center p-6 border-white/5 bg-white/[0.02] min-h-[600px] rounded-[2rem] sticky top-24">
            <span className="text-white/10 font-bold text-[10px] text-center uppercase vertical-text tracking-[0.3em]">Advertisement</span>
          </Card>
        </div>

        {/* MAIN CONTENT */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="glass relative overflow-hidden group border-white/10 rounded-[3rem] shadow-2xl">
            <div className="absolute top-0 right-0 p-10 opacity-5">
              <Coins className="w-60 h-60 text-white" />
            </div>
            
            <CardHeader className="p-10 pb-4 relative z-10">
              <CardTitle className="text-3xl font-black text-white flex items-center gap-4 italic uppercase">
                <div className="p-3 rounded-2xl bg-purple-500/20">
                  <Coins className="w-8 h-8 text-purple-400" />
                </div>
                Ready to Claim
              </CardTitle>
              <CardDescription className="text-white/50 text-lg font-medium italic">Solve the human verification below.</CardDescription>
            </CardHeader>
            
            <CardContent className="p-10 pt-0 space-y-8 relative z-10">
              {/* REWARD AMOUNT DISPLAY */}
              <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 flex flex-col items-center gap-2">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Reward Amount</span>
                <span className="text-4xl md:text-5xl font-black font-mono tracking-tighter text-fuchsia-400">
                  {loadingReward ? "..." : `${rewardAmount} Points`}
                </span>
              </div>

              {/* CHALLENGE AREA */}
              <AnimatePresence mode="wait">
                {loadingCooldown ? (
                  <div className="flex flex-col items-center py-10 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <span className="text-white/40 font-bold uppercase tracking-widest text-xs">Authenticating...</span>
                  </div>
                ) : timeLeft > 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-6 p-10 rounded-[3rem] bg-rose-500/5 border border-rose-500/10 w-full"
                  >
                    <div className="flex items-center gap-4 text-5xl font-black font-mono text-rose-400">
                      <Timer className="w-10 h-10 animate-pulse" />
                      {formatTime(timeLeft)}
                    </div>
                    <p className="text-xs font-black text-rose-400/60 uppercase tracking-[0.2em]">Cooldown in progress</p>
                  </motion.div>
                ) : (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col items-center justify-center gap-6 max-w-md mx-auto w-full">
                      {/* Security Check 1 */}
                      <div className="w-full p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center gap-3">
                         <div className="flex items-center justify-between w-full px-2">
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Verifikasi Keamanan 1
                            </span>
                            {turnstileToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                         </div>
                         <div className="w-full flex items-center justify-center py-1">
                           <div ref={turnstileRef} className="min-w-[300px] min-h-[65px] flex items-center justify-center" />
                         </div>
                      </div>

                      {/* Security Check 2 */}
                      <div className="w-full p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center gap-3">
                         <div className="flex items-center justify-between w-full px-2">
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Verifikasi Keamanan 2
                            </span>
                            {hcaptchaToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                         </div>
                         <div className="w-full flex items-center justify-center py-1">
                           <div ref={hcaptchaRef} className="min-w-[303px] min-h-[78px] flex items-center justify-center" />
                         </div>
                      </div>
                    </div>

                    {/* CLAIM BUTTON */}
                    <Button 
                      className={`w-full h-20 text-2xl font-black rounded-2xl transition-all gap-4 uppercase tracking-tighter shadow-2xl ${captchaVerified ? 'bg-primary hover:bg-primary/90 text-white neon-glow' : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'}`}
                      onClick={handleClaim}
                      disabled={!captchaVerified || isClaiming}
                    >
                      {isClaiming ? <Loader2 className="w-8 h-8 animate-spin" /> : <Coins className="w-8 h-8" />}
                      {captchaVerified ? "CLAIM NOW" : "Complete Security Verification"}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT BANNER */}
        <div className="hidden lg:block lg:col-span-2">
          <Card className="glass h-full flex flex-col items-center justify-center p-6 border-white/5 bg-white/[0.02] min-h-[600px] rounded-[2rem] sticky top-24">
            <span className="text-white/10 font-bold text-[10px] text-center uppercase vertical-text tracking-[0.3em]">Advertisement</span>
          </Card>
        </div>
      </div>

      {/* BOTTOM BANNER */}
      <div className="w-full flex justify-center">
        <Card className="glass w-full max-w-4xl h-32 flex items-center justify-center p-6 border-white/5 bg-white/[0.02] rounded-[2rem] overflow-hidden relative group">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 opacity-50" />
          <p className="relative z-10 text-white/10 font-bold text-sm tracking-tighter uppercase">Footer Advertisement Area</p>
        </Card>
      </div>
    </div>
  )
}
