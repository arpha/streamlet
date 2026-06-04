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
  ShieldCheck,
  Award,
  Crown,
  Gem
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import { AdBlockDetector } from "@/components/shared/AdBlockDetector"
import { AntiAdBlockModal } from "@/components/shared/AntiAdBlockModal"
import { motion, AnimatePresence } from "framer-motion"
import Script from "next/script"
import { Suspense } from "react"

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

function FaucetContent() {
  const [timeLeft, setTimeLeft] = useState(0)
  const [isClaiming, setIsClaiming] = useState(false)
  const [loadingCooldown, setLoadingCooldown] = useState(true)
  const [rewardAmount, setRewardAmount] = useState<number>(10)
  const [loadingReward, setLoadingReward] = useState(true)
  const [adBlockActive, setAdBlockActive] = useState(false)

  // CAPTCHA STATES
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [hcaptchaLoaded, setHcaptchaLoaded] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null)

  // NEW CAPTCHA ROTATION STATES
  const [captchaType, setCaptchaType] = useState<'turnstile' | 'hcaptcha' | null>(null)
  const [captchaTimestamp, setCaptchaTimestamp] = useState<number | null>(null)
  const [captchaSignature, setCaptchaSignature] = useState<string | null>(null)
  const [loadingCaptcha, setLoadingCaptcha] = useState(false)

  const turnstileRef = useRef<HTMLDivElement>(null)
  const hcaptchaRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const hcaptchaWidgetId = useRef<string | null>(null)

  const { id: userId, setBalance, xp } = useStore()
  const supabase = createClient()
  const router = useRouter()

  const cooldownMinutes = 30

  const getFaucetBonus = (baseReward: number, userXp: number) => {
    if (userXp >= 100000) return Math.ceil(baseReward * 0.15)
    if (userXp >= 10000) return Math.ceil(baseReward * 0.10)
    if (userXp >= 1000) return Math.ceil(baseReward * 0.05)
    return 0
  }

  const getLevelBadgeInfo = (userXp: number) => {
    if (userXp >= 100000) return { name: "Diamond", bonus: "+15%", color: "text-cyan-300 bg-cyan-400/10 border-cyan-400/20", icon: Gem }
    if (userXp >= 10000) return { name: "Platinum", bonus: "+10%", color: "text-indigo-200 bg-indigo-300/10 border-indigo-300/20", icon: Crown }
    if (userXp >= 1000) return { name: "Silver", bonus: "+5%", color: "text-slate-300 bg-slate-300/10 border-slate-300/20", icon: Award }
    return null
  }

  // Check if window global captcha objects are already loaded
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.turnstile) setTurnstileLoaded(true)
      if (window.hcaptcha) setHcaptchaLoaded(true)
    }
  }, [])

  // Fetch captcha assignment from server
  const fetchCaptchaAssignment = async () => {
    if (!userId) return
    setLoadingCaptcha(true)
    try {
      const response = await fetch("/api/faucet/captcha")
      const data = await response.json()
      if (data.success) {
        setCaptchaType(data.captchaType)
        setCaptchaTimestamp(data.timestamp)
        setCaptchaSignature(data.signature)
      } else {
        console.error("Failed to load captcha assignment:", data.message)
      }
    } catch (err) {
      console.error("Error fetching captcha assignment:", err)
    } finally {
      setLoadingCaptcha(false)
    }
  }

  // Fetch captcha assignment when ready to claim
  useEffect(() => {
    if (!loadingCooldown && timeLeft === 0 && !captchaType && userId) {
      fetchCaptchaAssignment()
    }
  }, [loadingCooldown, timeLeft, captchaType, userId])

  // Initialize Turnstile
  useEffect(() => {
    if (captchaType !== 'turnstile' || !turnstileLoaded || !turnstileRef.current || !window.turnstile) return

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
  }, [turnstileLoaded, loadingCooldown, timeLeft, captchaType])

  // Initialize hCaptcha
  useEffect(() => {
    if (captchaType !== 'hcaptcha' || !hcaptchaLoaded || !hcaptchaRef.current || !window.hcaptcha) return

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
  }, [hcaptchaLoaded, loadingCooldown, timeLeft, captchaType])

  const resetCaptchas = () => {
    setTurnstileToken(null)
    setHcaptchaToken(null)
    if (window.turnstile && turnstileWidgetId.current) {
      try { window.turnstile.reset(turnstileWidgetId.current) } catch (e) {}
    }
    if (window.hcaptcha && hcaptchaWidgetId.current) {
      try { window.hcaptcha.reset(hcaptchaWidgetId.current) } catch (e) {}
    }
    setCaptchaType(null)
    setCaptchaTimestamp(null)
    setCaptchaSignature(null)
  }

  const captchaVerified = captchaType === 'turnstile' ? !!turnstileToken : (captchaType === 'hcaptcha' ? !!hcaptchaToken : false)

  // Fetch reward amount from database
  useEffect(() => {
    async function fetchSettings() {
      try {
        const { data: rewardData } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'faucet_reward')
          .limit(1)
        
        if (rewardData && rewardData.length > 0) {
          setRewardAmount(Number(rewardData[0].value))
        }
      } catch (err) {
        console.error("Error fetching settings:", err)
      } finally {
        setLoadingReward(false)
      }
    }
    fetchSettings()
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
    if (adBlockActive) {
      toast.error("Please disable your ad blocker to claim faucet rewards.")
      return
    }

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
          captchaType,
          captchaToken: captchaType === 'turnstile' ? turnstileToken : hcaptchaToken,
          captchaTimestamp,
          captchaSignature,
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
      {/* ADBLOCK DETECTOR */}
      <AdBlockDetector onDetect={setAdBlockActive} />
      {adBlockActive && <AntiAdBlockModal />}

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
      <div className="w-full">
        <div id="frame" style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }}>
          <iframe 
            data-aa='2441223' 
            src='//acceptable.a-ads.com/2441223/?size=Adaptive'
            style={{ border: 0, padding: 0, width: '70%', height: '90px', overflow: 'hidden', display: 'block', margin: 'auto' }}
          />
        </div>
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
        <div className="hidden lg:block lg:col-span-2 sticky top-24">
          <iframe 
            data-aa="2441223" 
            src="//acceptable.a-ads.com/2441223/?size=Adaptive"
            style={{ border: 0, padding: 0, width: '120px', height: '500px', overflow: 'hidden', display: 'block', margin: 'auto' }}
          />
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
              <div className="p-8 rounded-[2.5rem] bg-white/[0.03] border border-white/10 flex flex-col items-center gap-2 relative overflow-hidden">
                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Reward Amount</span>
                
                <div className="flex items-center gap-3">
                  <span className="text-4xl md:text-5xl font-black font-mono tracking-tighter text-fuchsia-400">
                    {loadingReward ? "..." : `${rewardAmount + getFaucetBonus(rewardAmount, xp)} Points`}
                  </span>
                </div>

                {!loadingReward && (() => {
                  const badge = getLevelBadgeInfo(xp)
                  if (!badge) return null
                  const BadgeIcon = badge.icon
                  return (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1 rounded-full border ${badge.color}`}
                    >
                      <BadgeIcon className="w-3 h-3" />
                      <span className="text-[10px] font-bold uppercase">{badge.name} Bonus {badge.bonus}</span>
                    </motion.div>
                  )
                })()}
              </div>

              {/* CHALLENGE AREA */}
              <AnimatePresence mode="wait">
                {loadingCooldown || (timeLeft === 0 && (!captchaType || loadingCaptcha)) ? (
                  <div className="flex flex-col items-center py-10 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <span className="text-white/40 font-bold uppercase tracking-widest text-xs">Preparing Security Challenge...</span>
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
                      {/* Security Check 1: Turnstile */}
                      <div className={`w-full p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center gap-3 ${captchaType === 'turnstile' ? '' : 'hidden'}`}>
                         <div className="flex items-center justify-between w-full px-2">
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Security Verification (Turnstile)
                            </span>
                            {turnstileToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                         </div>
                         <div className="w-full flex items-center justify-center py-1">
                           <div ref={turnstileRef} className="min-w-[300px] min-h-[65px] flex items-center justify-center" />
                         </div>
                      </div>

                      {/* Security Check 2: hCaptcha */}
                      <div className={`w-full p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 flex flex-col items-center gap-3 ${captchaType === 'hcaptcha' ? '' : 'hidden'}`}>
                         <div className="flex items-center justify-between w-full px-2">
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Security Verification (hCaptcha)
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
        <div className="hidden lg:block lg:col-span-2 sticky top-24">
          <iframe 
            data-aa="2441223" 
            src="//acceptable.a-ads.com/2441223/?size=Adaptive"
            style={{ border: 0, padding: 0, width: '120px', height: '500px', overflow: 'hidden', display: 'block', margin: 'auto' }}
          />
        </div>
      </div>

      {/* BOTTOM BANNER */}
      <div className="w-full">
        <div id="frame" style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 99998 }}>
          <iframe 
            data-aa='2441223' 
            src='//acceptable.a-ads.com/2441223/?size=Adaptive'
            style={{ border: 0, padding: 0, width: '70%', height: '90px', overflow: 'hidden', display: 'block', margin: 'auto' }}
          />
        </div>
      </div>
    </div>
  )
}

export default function FaucetPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    }>
      <FaucetContent />
    </Suspense>
  )
}
