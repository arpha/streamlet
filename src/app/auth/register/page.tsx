"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { UserPlus, Loader2, ShieldCheck, CheckCircle2, User, Mail, Lock, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import Script from "next/script"

const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email format"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one symbol/special character"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
})

type RegisterValues = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [agreeTerms, setAgreeTerms] = useState(false)

  // Turnstile states
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema)
  })

  // Check if window global captcha objects are already loaded
  useEffect(() => {
    if (typeof window !== "undefined" && window.turnstile) {
      setTurnstileLoaded(true)
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

  const resetTurnstile = () => {
    setTurnstileToken(null)
    if (window.turnstile && turnstileWidgetId.current) {
      try {
        window.turnstile.reset(turnstileWidgetId.current)
      } catch (e) {}
    }
  }

  // Utility to read a cookie client-side
  const getCookie = (name: string) => {
    if (typeof document === "undefined") return null
    const value = `; ${document.cookie}`
    const parts = value.split(`; ${name}=`)
    if (parts.length === 2) return parts.pop()?.split(";").shift()
    return null
  }

  const onSubmit = async (values: RegisterValues) => {
    if (!agreeTerms) {
      toast.error("Please agree to our Terms and Conditions.")
      return
    }

    if (!turnstileToken) {
      toast.error("Please complete the security check.")
      return
    }

    setLoading(true)
    try {
      // Read referral code from cookie or fallback to localStorage
      let referralCode = getCookie("referred_by_code")
      if (!referralCode) {
        try {
          referralCode = localStorage.getItem("referred_by_code")
        } catch (e) {}
      }

      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          username: values.username,
          referralCode: referralCode || undefined,
          turnstileToken,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Failed to register")
      }

      // Clean up cookies and localStorage upon successful signup
      try {
        document.cookie = "referred_by_code=; max-age=0; path=/; SameSite=Lax"
        localStorage.removeItem("referred_by_code")
      } catch (e) {}

      toast.success(result.message || "Registration successful! Please check your email for verification.")
      router.push("/auth/login")
    } catch (error: any) {
      if (error.message?.includes("Database error saving new user")) {
        toast.error("Username is already taken. Please choose another one.")
      } else if (error.message?.includes("Email is already registered") || error.message?.includes("already registered")) {
        toast.error("Email is already registered. Please login or use a different email.")
      } else {
        toast.error(error.message || "Failed to register")
      }
      resetTurnstile()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#020617] relative overflow-hidden">
      {/* CAPTCHA SCRIPT */}
      <Script 
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" 
        onLoad={() => setTurnstileLoaded(true)}
        strategy="afterInteractive"
      />

      {/* Back to Home link */}
      <Link 
        href="/" 
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors z-20 uppercase tracking-widest"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to home
      </Link>

      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-600/10 rounded-full blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-primary mb-4 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
            <UserPlus className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2 uppercase italic">Join Now</h1>
          <p className="text-white/60 font-bold uppercase tracking-widest text-xs">Start collecting Crypto today</p>
        </div>

        <Card className="glass border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden">
          <CardHeader className="text-center space-y-1 pb-2">
            <CardTitle className="text-2xl font-black text-white">CREATE ACCOUNT</CardTitle>
            <CardDescription className="text-white/40 font-medium">Registration takes less than a minute.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-5 pt-6">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/60 font-bold text-xs uppercase ml-1">Unique Username</Label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="username" 
                    placeholder="e.g. cryptoking99" 
                    className="bg-white/5 border-white/10 focus:border-primary/50 text-white h-12 rounded-2xl pl-11 pr-5 transition-all outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
                    {...register("username")}
                  />
                </div>
                {errors.username && <p className="text-[10px] text-rose-400 font-bold ml-2">{errors.username.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/60 font-bold text-xs uppercase ml-1">FaucetPay Email</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@email.com" 
                    className="bg-white/5 border-white/10 focus:border-primary/50 text-white h-12 rounded-2xl pl-11 pr-5 transition-all outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
                    {...register("email")}
                  />
                </div>
                <div className="flex items-center justify-between px-1 min-h-[16px] gap-2 flex-wrap">
                  <div>
                    {errors.email && <p className="text-[10px] text-rose-400 font-bold">{errors.email.message}</p>}
                  </div>
                  <a 
                    href="https://faucetpay.io/?r=9971683" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors font-bold uppercase hover:underline ml-auto"
                  >
                    Don't have FaucetPay? Register
                  </a>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/60 font-bold text-xs uppercase ml-1">New Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10 focus:border-primary/50 text-white h-12 rounded-2xl pl-11 pr-12 transition-all outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
                    {...register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password ? (
                  <p className="text-[10px] text-rose-400 font-bold ml-2">{errors.password.message}</p>
                ) : (
                  <p className="text-[10px] text-white/30 ml-2 font-medium">
                    Min. 8 characters with uppercase, lowercase, numbers & symbols
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-white/60 font-bold text-xs uppercase ml-1">Confirm Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-primary transition-colors" />
                  <Input 
                    id="confirm-password" 
                    type={showConfirmPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10 focus:border-primary/50 text-white h-12 rounded-2xl pl-11 pr-12 transition-all outline-none focus-visible:ring-1 focus-visible:ring-primary/50 focus-visible:ring-offset-0"
                    {...register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && <p className="text-[10px] text-rose-400 font-bold ml-2">{errors.confirmPassword.message}</p>}
              </div>

              {/* Turnstile Verification */}
              <div className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-2">
                 <div className="flex items-center justify-between w-full px-1">
                    <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Security Check
                    </span>
                    {turnstileToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                 </div>
                 <div className="w-full flex items-center justify-center py-1">
                   <div ref={turnstileRef} className="min-w-[300px] min-h-[65px] flex items-center justify-center" />
                 </div>
              </div>

              <div 
                onClick={() => setAgreeTerms(!agreeTerms)}
                className={`p-3 rounded-2xl border flex items-center gap-3 cursor-pointer select-none transition-all duration-300 ${
                  agreeTerms 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-white/5 border-white/10 text-white/50 hover:bg-white/[0.08]"
                }`}
              >
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    className="sr-only"
                  />
                  <CheckCircle2 className={`w-4 h-4 transition-colors ${agreeTerms ? "text-emerald-400" : "text-white/20"}`} />
                </div>
                <p className="text-[10px] font-bold leading-relaxed uppercase">
                  By signing up, you agree to our{" "}
                  <Link 
                    href="/terms" 
                    target="_blank"
                    className={`underline hover:text-cyan-300 transition-colors ${agreeTerms ? "text-emerald-400" : "text-white/60"}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Terms and Conditions
                  </Link>
                  .
                </p>
              </div>

              <Button 
                className={`w-full h-14 text-white rounded-2xl font-black text-lg neon-glow transition-all active:scale-95 gap-3 mt-4 uppercase ${turnstileToken && agreeTerms ? 'bg-gradient-to-r from-primary to-fuchsia-600 hover:from-primary/90 hover:to-fuchsia-600/90' : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'}`} 
                type="submit" 
                disabled={loading || !turnstileToken || !agreeTerms}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserPlus className="w-5 h-5" />}
                Register Now
              </Button>
            </CardContent>
          </form>
          <CardFooter className="flex justify-center border-t border-white/5 bg-white/[0.02] py-6">
            <p className="text-sm font-bold text-white/40">
              Already have an account?{" "}
              <Link href="/auth/login" className="text-primary font-black hover:underline uppercase">Login Here</Link>
            </p>
          </CardFooter>
        </Card>

        {/* Info */}
        <div className="mt-8 flex items-center justify-center gap-2 text-white/20 uppercase font-black text-[10px] tracking-[0.3em]">
          <ShieldCheck className="w-3 h-3" />
          100% Privacy Guaranteed
        </div>
      </motion.div>
    </div>
  )
}
