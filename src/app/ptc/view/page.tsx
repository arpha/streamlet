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
  AlertCircle,
  Star,
  Heart,
  Smile,
  Bell,
  Flag,
  Shield,
  Sparkles,
  ExternalLink
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
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

// Helper function to extract YouTube video ID from various YouTube URL formats
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null
  
  try {
    const urlObj = new URL(url)
    
    // Check for youtube.com
    if (urlObj.hostname.includes("youtube.com")) {
      // Handle /watch?v=...
      if (urlObj.pathname === "/watch") {
        return urlObj.searchParams.get("v")
      }
      // Handle /shorts/...
      if (urlObj.pathname.startsWith("/shorts/")) {
        return urlObj.pathname.split("/")[2] || null
      }
      // Handle /embed/...
      if (urlObj.pathname.startsWith("/embed/")) {
        return urlObj.pathname.split("/")[2] || null
      }
    }
    
    // Check for youtu.be (short url)
    if (urlObj.hostname === "youtu.be") {
      return urlObj.pathname.slice(1) || null
    }
  } catch (e) {
    // Parsing fails
  }
  
  return null
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
  const [isYoutubeAd, setIsYoutubeAd] = useState(false)
  const [isVideoPlaying, setIsVideoPlaying] = useState(true)

  // Timer States
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [timerStarted, setTimerStarted] = useState(false)
  const ytPlayerRef = useRef<any>(null)

  // Captcha States
  const [externalCaptchaType, setExternalCaptchaType] = useState<"turnstile" | "hcaptcha" | null>(null)
  const [captchaTimestamp, setCaptchaTimestamp] = useState<number | null>(null)
  const [externalSignature, setExternalSignature] = useState<string | null>(null)
  const [streamletSignature, setStreamletSignature] = useState<string | null>(null)
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [hcaptchaLoaded, setHcaptchaLoaded] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [hcaptchaToken, setHcaptchaToken] = useState<string | null>(null)
  const [streamletChallenge, setStreamletChallenge] = useState<{ prompt: string; options: string[] } | null>(null)
  const [streamletToken, setStreamletToken] = useState<string | null>(null)
  const [isLoadingCaptcha, setIsLoadingCaptcha] = useState(false)

  const turnstileRef = useRef<HTMLDivElement>(null)
  const hcaptchaRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)
  const hcaptchaWidgetId = useRef<string | null>(null)

  // Claim State
  const [isClaiming, setIsClaiming] = useState(false)
  const [isTabActive, setIsTabActive] = useState(true)
  const [isAdWindowOpen, setIsAdWindowOpen] = useState(true)

  // Poll state of the opened ad window to pause timer if closed/blocked
  useEffect(() => {
    if (isYoutubeAd) return

    const checkAdWindow = () => {
      const adWin = (window as any).adWindow
      if (adWin) {
        if (adWin.closed) {
          setIsAdWindowOpen(false)
        } else {
          setIsAdWindowOpen(true)
        }
      } else {
        setIsAdWindowOpen(false)
      }
    }

    checkAdWindow()

    const interval = setInterval(checkAdWindow, 500)
    return () => clearInterval(interval)
  }, [isYoutubeAd])

  // Listen to visibility and focus events to pause/resume timer
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(document.visibilityState === "visible")
    }
    const handleFocus = () => setIsTabActive(true)
    const handleBlur = () => setIsTabActive(false)

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", handleFocus)
    window.addEventListener("blur", handleBlur)

    // Set initial focus state
    if (typeof document !== "undefined") {
      setIsTabActive(document.visibilityState === "visible")
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("blur", handleBlur)
    }
  }, [])

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

        // Check if it is a YouTube ad
        const ytVideoId = getYouTubeVideoId(data.url)
        if (ytVideoId) {
          setIsYoutubeAd(true)
          setIsVideoPlaying(false) // Wait for user to play
        } else {
          setIsYoutubeAd(false)
          setIsVideoPlaying(true) // Start ticking immediately
        }
      } catch (err) {
        toast.error("Failed to connect to database.")
        router.push("/ptc")
      } finally {
        setIsLoadingCampaign(false)
      }
    }

    loadCampaign()
  }, [campaignId, supabase, router])

  // Handle YouTube Iframe Player API Loading and Initialization
  useEffect(() => {
    if (!campaign || !isYoutubeAd) return

    const videoId = getYouTubeVideoId(campaign.url)
    if (!videoId) return

    // Callback when API is ready
    const initPlayer = () => {
      if (!window.YT) return
      
      // Ensure element exists in DOM
      const playerDiv = document.getElementById("youtube-player")
      if (!playerDiv) return

      try {
        ytPlayerRef.current = new window.YT.Player("youtube-player", {
          height: "100%",
          width: "100%",
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 1,
            rel: 0,
            showinfo: 0,
            modestbranding: 1,
          },
          events: {
            onStateChange: (event: any) => {
              // event.data matches:
              // YT.PlayerState.PLAYING = 1
              // YT.PlayerState.PAUSED = 2
              // YT.PlayerState.ENDED = 0
              if (event.data === 1) {
                setIsVideoPlaying(true)
              } else {
                setIsVideoPlaying(false)
              }
            },
          },
        })
      } catch (e) {
        console.error("YouTube Player init error:", e)
      }
    }

    // Check if script is already present
    if (!window.YT) {
      // Load YouTube Player API script
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag)
      } else {
        document.head.appendChild(tag)
      }

      // Define global callback
      window.onYouTubeIframeAPIReady = () => {
        initPlayer()
      }
    } else {
      initPlayer()
    }

    return () => {
      if (ytPlayerRef.current && typeof ytPlayerRef.current.destroy === "function") {
        ytPlayerRef.current.destroy()
        ytPlayerRef.current = null
      }
    }
  }, [campaign, isYoutubeAd])

  // Countdown timer ticking down and dynamic browser tab title update
  useEffect(() => {
    if (timeLeft === null || !timerStarted) return

    if (timeLeft <= 0) {
      document.title = "Ready to Claim! | Streamlet"
      return
    }

    if (isYoutubeAd && !isTabActive) {
      document.title = `[PAUSED] (${timeLeft}s) ${campaign?.title || "Viewing Ad"} | Streamlet`
      return
    }

    // Pause timer if video is not playing
    if (isYoutubeAd && !isVideoPlaying) {
      document.title = `[PAUSED - VIDEO] (${timeLeft}s) ${campaign?.title || "Viewing Ad"} | Streamlet`
      return
    }

    // Pause timer if standard ad page is closed/blocked
    if (!isYoutubeAd && !isAdWindowOpen) {
      document.title = `[PAUSED - AD CLOSED] (${timeLeft}s) ${campaign?.title || "Viewing Ad"} | Streamlet`
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
  }, [timeLeft, timerStarted, campaign, isTabActive, isYoutubeAd, isVideoPlaying, isAdWindowOpen])

  // Fetch Captcha Signed Payload when timer hits 0
  useEffect(() => {
    if (timeLeft !== 0 || externalCaptchaType !== null || isLoadingCaptcha) return

    const loadCaptchaSignature = async () => {
      setIsLoadingCaptcha(true)
      try {
        const res = await fetch("/api/ptc/captcha")
        const data = await res.json()
        if (data.success) {
          setExternalCaptchaType(data.externalCaptchaType)
          setCaptchaTimestamp(data.timestamp)
          setExternalSignature(data.externalSignature)
          setStreamletSignature(data.streamletSignature)
          setStreamletChallenge(data.streamletChallenge)
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
  }, [timeLeft, externalCaptchaType, isLoadingCaptcha])

  // Initialize Turnstile Challenge
  useEffect(() => {
    if (externalCaptchaType !== "turnstile" || !turnstileLoaded || !turnstileRef.current || !window.turnstile) return

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
  }, [externalCaptchaType, turnstileLoaded])

  // Initialize hCaptcha Challenge
  useEffect(() => {
    if (externalCaptchaType !== "hcaptcha" || !hcaptchaLoaded || !hcaptchaRef.current || !window.hcaptcha) return

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
  }, [externalCaptchaType, hcaptchaLoaded])

  const captchaVerified = (
    externalCaptchaType === "turnstile" 
      ? !!turnstileToken 
      : (externalCaptchaType === "hcaptcha" 
        ? !!hcaptchaToken 
        : false)
  ) && !!streamletToken

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
          externalCaptchaType,
          externalCaptchaToken: externalCaptchaType === "turnstile" ? turnstileToken : hcaptchaToken,
          streamletCaptchaToken: streamletToken,
          captchaTimestamp,
          externalSignature,
          streamletSignature,
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
        if (externalCaptchaType === "turnstile" && window.turnstile && turnstileWidgetId.current) {
          window.turnstile.reset(turnstileWidgetId.current)
        } else if (externalCaptchaType === "hcaptcha" && window.hcaptcha && hcaptchaWidgetId.current) {
          window.hcaptcha.reset(hcaptchaWidgetId.current)
        }
        setTurnstileToken(null)
        setHcaptchaToken(null)
        setStreamletToken(null)
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
    <div className="w-full h-screen overflow-hidden flex flex-col bg-zinc-950 text-white select-none">
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

      {/* TOP HEADER BAR */}
      <header className="h-20 bg-zinc-950/90 border-b border-white/5 backdrop-blur-md flex items-center justify-between px-6 z-40">
        {/* Left: Brand & Back button */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => router.push("/ptc")}
            className="text-zinc-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="hidden sm:block border-l border-white/10 h-6" />
          <div className="hidden sm:flex flex-col">
            <span className="text-[10px] font-black text-primary tracking-wider uppercase font-mono">Streamlet PTC</span>
            <span className="text-xs text-zinc-300 font-bold max-w-[200px] truncate">{campaign?.title || "Loading Campaign..."}</span>
          </div>
        </div>

        {/* Center: Timer or Completion State */}
        <div className="flex-1 max-w-md mx-6 flex flex-col items-center gap-1.5">
          {timeLeft !== null && timeLeft > 0 ? (
            <>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 font-bold tracking-widest font-mono uppercase">
                  {!isYoutubeAd && !isAdWindowOpen
                    ? "PAUSED (AD CLOSED)"
                    : (isYoutubeAd && !isTabActive
                      ? "PAUSED"
                      : (isYoutubeAd && !isVideoPlaying
                        ? "PAUSED (VIDEO)"
                        : "VIEWING AD"))}
                </span>
                <span className={`text-xl font-black font-mono tracking-tight transition-colors ${
                  (!isYoutubeAd && !isAdWindowOpen) || (isYoutubeAd && (!isTabActive || !isVideoPlaying))
                    ? "text-rose-500"
                    : "text-primary animate-pulse"
                }`}>
                  {timeLeft}s
                </span>
              </div>
              <div className="w-full bg-zinc-900 border border-white/5 h-2 rounded-full overflow-hidden p-0.5">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ease-linear ${
                    (!isYoutubeAd && !isAdWindowOpen) || (isYoutubeAd && (!isTabActive || !isVideoPlaying))
                      ? "bg-zinc-700"
                      : "bg-gradient-to-r from-primary via-fuchsia-500 to-primary"
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase font-mono animate-pulse">
              <CheckCircle2 className="w-4 h-4" /> Ready to Claim Reward!
            </div>
          )}
        </div>

        {/* Right: Fallback button */}
        <div className="flex items-center gap-3">
          {campaign?.url && (
            <Button
              variant="outline"
              size="sm"
              className="text-[11px] h-8 font-semibold border-white/10 hover:bg-white/5 bg-transparent text-zinc-400 hover:text-white"
              onClick={() => {
                const adWin = window.open(campaign.url, "_blank", "noopener,noreferrer")
                if (typeof window !== "undefined") {
                  (window as any).adWindow = adWin
                  setIsAdWindowOpen(true)
                }
              }}
            >
              <AlertCircle className="w-3.5 h-3.5 mr-1 text-yellow-500" />
              Situs tidak terbuka?
            </Button>
          )}
        </div>
      </header>

      {/* IFRAME AREA */}
      <div className="flex-1 relative bg-zinc-900">
        {isLoadingCampaign ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="text-sm text-zinc-400 font-mono">Loading Advertiser Site...</span>
          </div>
        ) : campaign?.url ? (
          isYoutubeAd ? (
            <div className="w-full h-full bg-black relative">
              <div id="youtube-player" className="w-full h-full" />
              {!isVideoPlaying && timeLeft !== null && timeLeft > 0 && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-rose-500/90 border border-rose-600 text-white text-xs font-bold font-mono shadow-lg animate-bounce flex items-center gap-1.5 pointer-events-none">
                  <AlertCircle className="w-4 h-4" />
                  Silakan tekan tombol PUTAR (Play) pada video untuk memulai timer!
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 px-6 text-center">
              <div className="max-w-md p-8 rounded-3xl bg-white/[0.02] border border-white/5 shadow-2xl space-y-6">
                <div className="flex justify-center">
                  <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                    <ExternalLink className="w-10 h-10 animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-white uppercase tracking-wide">
                    {!isAdWindowOpen ? "Timer Paused! Ad Closed" : "Situs Dibuka di Jendela Baru"}
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed font-mono">
                    {!isAdWindowOpen
                      ? "The ad page was closed or blocked. Please click the button below to re-open the advertiser's site and resume the timer."
                      : "Situs pengiklan telah dibuka di tab baru Anda. Harap tunggu hingga timer di atas selesai untuk mengklaim reward Anda."}
                  </p>
                </div>
                
                <div className="flex flex-col gap-2 pt-2">
                  <Button
                    onClick={() => {
                      const adWin = window.open(campaign.url, "_blank", "noopener,noreferrer")
                      if (typeof window !== "undefined") {
                        (window as any).adWindow = adWin
                        setIsAdWindowOpen(true)
                      }
                    }}
                    className="w-full neon-glow font-bold text-xs gap-2 py-5"
                  >
                    <ExternalLink className="w-4 h-4" /> Buka Kembali Situs
                  </Button>
                  <p className="text-[10px] text-zinc-500 font-mono">
                    Jika situs tidak otomatis terbuka, kemungkinan terblokir oleh pemblokir iklan (popup blocker).
                  </p>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950">
            <AlertCircle className="w-8 h-8 text-rose-500" />
            <span className="text-sm text-rose-400">Failed to load campaign URL.</span>
          </div>
        )}

        {/* PAUSE MODAL OVERLAY (when user switches tab/focus away) */}
        {timeLeft !== null && timeLeft > 0 && isYoutubeAd && !isTabActive && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center">
            <div className="max-w-md p-8 rounded-2xl bg-zinc-950/80 border border-white/5 shadow-2xl space-y-4">
              <div className="flex justify-center">
                <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 animate-pulse">
                  <Timer className="w-10 h-10" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-white">Timer Paused!</h3>
              <p className="text-sm text-zinc-400 leading-relaxed font-mono">
                Sistem mendeteksi Anda meninggalkan tab iklan. Silakan **pindah fokus/klik** kembali ke halaman ini agar timer berjalan kembali.
              </p>
              <div className="text-3xl font-black font-mono text-rose-500">
                {timeLeft}s Remaining
              </div>
              <div className="flex justify-center pt-2">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  Harap tetap fokus di tab ini untuk melanjutkan klaim.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* CAPTCHA MODAL OVERLAY (when timer reaches 0) */}
        {timeLeft === 0 && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-md z-30 flex items-center justify-center p-4">
            <Card className="w-full max-w-md glass border-primary/20 bg-zinc-950/90 shadow-2xl relative overflow-hidden">
              <CardHeader className="text-center pb-2">
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-full bg-primary/10 border border-primary/20 text-primary">
                    <ShieldCheck className="w-8 h-8 animate-pulse" />
                  </div>
                </div>
                <CardTitle className="text-lg font-bold text-white font-mono">Security Verification</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Selesaikan kedua captcha di bawah untuk mengklaim reward Anda.
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-4 pt-2">
                {isLoadingCaptcha ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground font-mono">Loading Security Verification...</span>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Security Check 1: Turnstile */}
                    {externalCaptchaType === "turnstile" && (
                      <div className="w-full p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-2.5">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Turnstile Verification
                          </span>
                          {turnstileToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div ref={turnstileRef} className="min-w-[300px] min-h-[65px] flex items-center justify-center scale-90" />
                      </div>
                    )}

                    {/* Security Check 2: hCaptcha */}
                    {externalCaptchaType === "hcaptcha" && (
                      <div className="w-full p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-2.5">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            hCaptcha Verification
                          </span>
                          {hcaptchaToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <div ref={hcaptchaRef} className="min-w-[303px] min-h-[78px] flex items-center justify-center scale-90" />
                      </div>
                    )}

                    {/* Security Check 3: Streamlet Custom Captcha */}
                    {streamletChallenge && (
                      <div className="w-full p-4 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col gap-3">
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 font-mono">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            Streamlet Security Check
                          </span>
                          {streamletToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                        </div>
                        <p className="text-xs text-zinc-400 text-center">
                          Please click the <span className="font-extrabold text-white underline decoration-primary decoration-2 underline-offset-4 font-mono">{streamletChallenge.prompt}</span> icon below:
                        </p>
                        <div className="flex justify-center gap-3 pt-0.5">
                          {streamletChallenge.options.map((option) => {
                            const IconComponent = (() => {
                              switch (option) {
                                case "star": return Star
                                case "heart": return Heart
                                case "smile": return Smile
                                case "bell": return Bell
                                case "flag": return Flag
                                case "shield": return Shield
                                default: return Sparkles
                              }
                            })()

                            const isSelected = streamletToken === option

                            return (
                              <button
                                key={option}
                                type="button"
                                onClick={() => setStreamletToken(option)}
                                className={`p-3.5 rounded-lg transition-all duration-200 border flex items-center justify-center ${
                                  isSelected
                                    ? "bg-primary border-primary text-white scale-110 shadow-lg shadow-primary/20"
                                    : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-white/70 hover:text-white"
                                }`}
                              >
                                <IconComponent className="w-4.5 h-4.5" />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Claim Button */}
                    <Button 
                      className={`w-full h-12 text-sm font-bold rounded-lg transition-all gap-2 uppercase ${
                        captchaVerified 
                          ? "bg-primary hover:bg-primary/90 text-white neon-glow" 
                          : "bg-white/5 text-white/20 cursor-not-allowed border border-white/10"
                      }`}
                      onClick={handleClaimReward}
                      disabled={!captchaVerified || isClaiming}
                    >
                      {isClaiming ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Coins className="w-4 h-4" />
                      )}
                      {captchaVerified ? `CLAIM ${campaign?.reward_per_view} POINTS` : "Complete Security Verification"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
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
