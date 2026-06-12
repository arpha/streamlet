"use client"

import { useState, useEffect, useRef, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Coins, 
  Timer, 
  CheckCircle2, 
  Loader2, 
  ShieldCheck, 
  ArrowLeft,
  AlertCircle 
} from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
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

function PTCViewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const campaignId = searchParams.get("id")
  const supabase = createClient()
  const { setBalance, setXp } = useStore()

  // Campaign Info
  const [campaign, setCampaign] = useState<any>(null)
  const [isLoadingCampaign, setIsLoadingCampaign] = useState(true)

  // Timer States
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [timerStarted, setTimerStarted] = useState(false)

  // Captcha States
  const [captchaType, setCaptchaType] = useState<"turnstile" | "hcaptcha" | null>(null)
  const [captchaTimestamp, setCaptchaTimestamp] = useState<number | null>(null)
  const [captchaSignature, setCaptchaSignature] = useState<string | null>(null)
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [hcaptchaLoaded, setHcaptchaLoaded] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null)
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false)

  const turnstileRef = useRef<HTMLDivElement>(null)
  const hcaptchaRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const hcaptchaWidgetId = useRef<string | null>(null)

  // Claim State
  const [isClaiming, setIsClaiming] = useState(false)

  // Check if captcha scripts are already loaded on client mount (Next.js Script onLoad bypass fix)
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.turnstile) setTurnstileLoaded(true)
      if (window.hcaptcha) setHcaptchaLoaded(true)
    }
  }, [])

  // Restore original page tab title on component unmount
  useEffect(() => {
    const originalTitle = document.title
    return () => {
      document.title = originalTitle
    }
  }, [])

  // Fetch campaign details on mount
  useEffect(() => {
    if (!campaignId) {
      toast.error("Invalid campaign ID.")
      router.push("/ptc")
      return
    }

    const loadCampaign = async () => {
      setIsLoadingCampaign(true)
      try {
        const { data, error } = await supabase
          .from("ptc_campaigns")
          .select("*")
          .eq("id", campaignId)
          .single()

        if (error || !data) {
          toast.error("Ad campaign not found or is no longer active.")
          router.push("/ptc")
          return
        }

        setCampaign(data)
        setTimeLeft(data.duration)
        setTimerStarted(true)
      } catch (err) {
        toast.error("Failed to connect to database.")
        router.push("/ptc")
      } finally {
        setIsLoadingCampaign(false)
      }
    }

    loadCampaign()
  }, [campaignId, supabase, router])

  // Countdown timer ticking down and dynamic browser tab title update
  useEffect(() => {
    if (timeLeft === null || !timerStarted) return

    if (timeLeft <= 0) {
      document.title = "Ready to Claim! | Streamlet"
      return
    }

    document.title = `(${timeLeft}s) ${campaign?.title || "Viewing Ad"} | Streamlet`

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev !== null && prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev !== null ? prev - 1 : null
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, timerStarted, campaign])

  // Fetch Captcha Signed Payload when timer hits 0
  useEffect(() => {
    if (timeLeft !== 0 || captchaType !== null || isLoadingCaptcha) return

    const loadCaptchaSignature = async () => {
      setIsLoadingCaptcha(true)
      try {
        const res = await fetch("/api/ptc/captcha")
        const data = await res.json()
        if (data.success) {
          setCaptchaType(data.captchaType)
          setCaptchaTimestamp(data.timestamp)
          setCaptchaSignature(data.signature)
        } else {
          toast.error("Failed to retrieve security signature.")
        }
      } catch (err) {
        toast.error("Connection error while loading captcha.")
      } finally {
        setIsLoadingCaptcha(false)
      }
    }

    loadCaptchaSignature()
  }, [timeLeft, captchaType, isLoadingCaptcha])

  // Initialize Turnstile Challenge
  useEffect(() => {
    if (captchaType !== "turnstile" || !turnstileLoaded || !turnstileRef.current || !window.turnstile) return

    const sitekey = process.env.NEXT_PUBLIC_CF_TURNSTILE_SITE_KEY || "1x00000000000000000000AA"

    try {
      if (turnstileWidgetId.current && window.turnstile) {
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
  }, [captchaType, turnstileLoaded])

  // Initialize hCaptcha Challenge
  useEffect(() => {
    if (captchaType !== "hcaptcha" || !hcaptchaLoaded || !hcaptchaRef.current || !window.hcaptcha) return

    const sitekey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001"

    try {
      if (hcaptchaWidgetId.current && window.hcaptcha) {
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
  }, [captchaType, hcaptchaLoaded])

  const captchaVerified = captchaType === "turnstile" ? !!turnstileToken : (captchaType === "hcaptcha" ? !!hcaptchaToken : false)

  // Handle Reward Claim Submission
  const handleClaimReward = async () => {
    if (!captchaVerified || isClaiming || !campaign) return

    setIsClaiming(true)
    try {
      const res = await fetch("/api/ptc/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          captchaType,
          captchaToken: captchaType === "turnstile" ? turnstileToken : hcaptchaToken,
          captchaTimestamp,
          captchaSignature,
        })
      })
      const data = await res.json()

      if (data.success) {
        toast.success(data.message || `Successfully claimed +${campaign.reward_per_view} Points!`)
        setBalance(data.new_balance)
        if (data.new_xp !== undefined) {
          setXp(data.new_xp)
        }
        router.push("/ptc")
      } else {
        toast.error(data.message || "Failed to claim reward.")
        // Reset Captcha if verification fails
        if (captchaType === "turnstile" && window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current)
        } else if (captchaType === "hcaptcha" && window.hcaptcha && hcaptchaWidgetId.current) {
          window.hcaptcha.reset(hcaptchaWidgetId.current)
        }
        setTurnstileToken(null)
        setHcaptchaToken(null)
      }
    } catch (err) {
      toast.error("Connection error occurred.")
    } finally {
      setIsClaiming(false)
    }
  }

  // Progress percentage calculation
  const progressPercent = campaign && timeLeft !== null
    ? Math.min(100, Math.floor(((campaign.duration - timeLeft) / campaign.duration) * 100))
    : 0

  return (
    <div className="max-w-xl mx-auto space-y-6 py-12 px-4">
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

      <Button 
        variant="ghost" 
        size="sm" 
        onClick={() => router.push("/ptc")}
        className="text-zinc-400 hover:text-white mb-2"
      >
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to PTC
      </Button>

      <Card className="glass border-primary/20 relative overflow-hidden bg-zinc-950/40">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
              <Timer className="w-8 h-8 text-primary animate-pulse" />
            </div>
          </div>
          <CardTitle className="text-xl font-bold text-white">
            {isLoadingCampaign ? "Loading Ad Campaign Details..." : campaign?.title}
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500 font-mono">
            {campaign?.url}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <AnimatePresence mode="wait">
            {isLoadingCampaign ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-sm text-zinc-400">Loading campaign...</span>
              </div>
            ) : timeLeft !== null && timeLeft > 0 ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-5 text-center"
              >
                {/* Countdown display */}
                <div className="text-5xl font-black font-mono text-primary animate-pulse">
                  {timeLeft}s
                </div>

                {/* Progress bar */}
                <div className="w-full bg-zinc-900 border border-white/5 h-4 rounded-full overflow-hidden p-0.5">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-primary via-fuchsia-500 to-primary transition-all duration-1000 ease-linear"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="flex items-start gap-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 text-left">
                  <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-yellow-500/80 leading-relaxed">
                    <strong>IMPORTANT:</strong> Do not close the advertiser website tab/window that you just opened. The countdown will continue on this page.
                  </span>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {isLoadingCaptcha ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Loading Security Verification...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Security Check 1: Turnstile */}
                    {captchaType === "turnstile" && (
                      <div className="w-full p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-3">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Turnstile Verification
                          </span>
                          {turnstileToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div ref={turnstileRef} className="min-w-[300px] min-h-[65px] flex items-center justify-center" />
                      </div>
                    )}

                    {/* Security Check 2: hCaptcha */}
                    {captchaType === "hcaptcha" && (
                      <div className="w-full p-5 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-3">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            hCaptcha Verification
                          </span>
                          {hcaptchaToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div ref={hcaptchaRef} className="min-w-[303px] min-h-[78px] flex items-center justify-center" />
                      </div>
                    )}

                    {/* Claim Button */}
                    <Button 
                      className={`w-full h-14 text-base font-bold rounded-xl transition-all gap-2 uppercase ${
                        captchaVerified 
                          ? "bg-primary hover:bg-primary/90 text-white neon-glow" 
                          : "bg-white/5 text-white/20 cursor-not-allowed border border-white/10"
                      }`}
                      onClick={handleClaimReward}
                      disabled={!captchaVerified || isClaiming}
                    >
                      {isClaiming ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <Coins className="w-5 h-5" />
                      )}
                      {captchaVerified ? `CLAIM ${campaign?.reward_per_view} POINTS` : "Complete Security Verification"}
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  )
}

export default function PTCViewPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    }>
      <PTCViewContent />
    </Suspense>
  )
}
