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
import { LogIn, Mail, Loader2, ShieldCheck, Lock, Eye, EyeOff, ArrowLeft, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import Script from "next/script"

const loginSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Turnstile states
  const [turnstileLoaded, setTurnstileLoaded] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const turnstileWidgetId = useRef<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema)
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

  const onSubmit = async (values: LoginValues) => {
    if (!turnstileToken) {
      toast.error("Please complete the security check.")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          turnstileToken,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Invalid email or password")
      }

      toast.success("Login successful! Welcome back.")
      window.location.href = "/"
    } catch (error: any) {
      toast.error(error.message || "Invalid email or password")
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
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 rounded-full blur-[150px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-600 mb-4 shadow-[0_0_30px_rgba(147,51,234,0.3)] neon-glow">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-4xl font-black tracking-tighter text-white mb-2 uppercase italic">Welcome Back</h1>
          <p className="text-white/60 font-bold uppercase tracking-widest text-xs">Streamlet Community</p>
        </div>

        <Card className="glass border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden">
          <CardHeader className="text-center space-y-1 pb-2">
            <CardTitle className="text-2xl font-black text-white">SIGN IN</CardTitle>
            <CardDescription className="text-white/40 font-medium">Enter your credentials to access your account.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <CardContent className="space-y-6 pt-6">
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/60 font-bold text-xs uppercase ml-1">Email Address</Label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-purple-400 transition-colors" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@email.com" 
                    className="bg-white/5 border-white/10 focus:border-purple-500/50 text-white h-12 rounded-2xl pl-11 pr-5 transition-all outline-none focus-visible:ring-1 focus-visible:ring-purple-500/50 focus-visible:ring-offset-0 w-full"
                    {...register("email")}
                  />
                </div>
                {errors.email && <p className="text-[10px] text-rose-400 font-bold ml-2">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/60 font-bold text-xs uppercase ml-1">Password</Label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 group-focus-within:text-purple-400 transition-colors" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    placeholder="••••••••"
                    className="bg-white/5 border-white/10 focus:border-purple-500/50 text-white h-12 rounded-2xl pl-11 pr-12 transition-all outline-none focus-visible:ring-1 focus-visible:ring-purple-500/50 focus-visible:ring-offset-0 w-full"
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
                {errors.password && <p className="text-[10px] text-rose-400 font-bold ml-2">{errors.password.message}</p>}
              </div>

              {/* Turnstile Verification */}
              <div className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col items-center gap-2">
                 <div className="flex items-center justify-between w-full px-1">
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Security Check
                    </span>
                    {turnstileToken && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                 </div>
                 <div className="w-full flex items-center justify-center py-1">
                   <div ref={turnstileRef} className="min-w-[300px] min-h-[65px] flex items-center justify-center" />
                 </div>
              </div>

              <Button 
                className={`w-full h-14 text-white rounded-2xl font-black text-lg neon-glow transition-all active:scale-95 gap-3 mt-4 uppercase ${turnstileToken ? 'bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-600/90 hover:to-fuchsia-600/90' : 'bg-white/5 text-white/20 cursor-not-allowed border border-white/10'}`} 
                type="submit" 
                disabled={loading || !turnstileToken}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                Sign In Now
              </Button>
            </CardContent>
          </form>
          <CardFooter className="flex justify-center border-t border-white/5 bg-white/[0.02] py-6">
            <p className="text-sm font-bold text-white/40">
              Don't have an account?{" "}
              <Link href="/auth/register" className="text-purple-400 font-black hover:underline uppercase">Sign Up Free</Link>
            </p>
          </CardFooter>
        </Card>

        {/* Security Badge */}
        <div className="mt-8 flex items-center justify-center gap-2 text-white/20 uppercase font-black text-[10px] tracking-[0.3em]">
          <ShieldCheck className="w-3 h-3" />
          Secure Encryption Active
        </div>
      </motion.div>
    </div>
  )
}
