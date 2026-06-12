"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  Coins, 
  MousePointer2, 
  Link2, 
  Gamepad2, 
  Users, 
  Trophy, 
  Wallet,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Megaphone
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useStore } from "@/store/useStore"
import { motion } from "framer-motion"
import { createClient } from "@/lib/supabase"

const navItems: { name: string; icon: any; href: string; comingSoon?: boolean }[] = [
  { name: "Dashboard", icon: LayoutDashboard, href: "/" },
  { name: "Faucet", icon: Coins, href: "/faucet" },
  { name: "PTC Ads", icon: MousePointer2, href: "/ptc" },
  { name: "Shortlinks", icon: Link2, href: "/shortlinks" },
  { name: "Offerwalls", icon: Gamepad2, href: "/offerwalls" },
  { name: "Leaderboard", icon: Trophy, href: "/leaderboard" },
  { name: "Referrals", icon: Users, href: "/referral" },
  { name: "Withdraw", icon: Wallet, href: "/withdraw" },
  { name: "Advertise", icon: Megaphone, href: "/advertise" },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isSidebarOpen, toggleSidebar, id: userId, balance } = useStore()
  const [faucetCooldown, setFaucetCooldown] = useState(0)
  const [surveysAvailable, setSurveysAvailable] = useState(false)

  // Check survey availability periodically
  useEffect(() => {
    if (!userId) {
      setSurveysAvailable(false)
      return
    }

    async function checkSurveys() {
      try {
        const res = await fetch(`/api/surveys/check?user_id=${userId}`)
        if (res.ok) {
          const data = await res.json()
          setSurveysAvailable(data.surveys_available === true)
        }
      } catch {
        // Silently fail — don't break sidebar
      }
    }

    checkSurveys()
    const interval = setInterval(checkSurveys, 5 * 60 * 1000) // every 5 minutes
    return () => clearInterval(interval)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setFaucetCooldown(0)
      return
    }

    const supabase = createClient()

    async function checkCooldown() {
      try {
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
          const cooldownInSeconds = 10 * 60 // 10 menit

          if (diffInSeconds < cooldownInSeconds) {
            setFaucetCooldown(cooldownInSeconds - diffInSeconds)
          } else {
            setFaucetCooldown(0)
          }
        } else {
          setFaucetCooldown(0)
        }
      } catch (err) {
        console.error("Error checking cooldown for sidebar:", err)
      }
    }

    checkCooldown()
  }, [userId, pathname, balance])

  useEffect(() => {
    if (faucetCooldown > 0) {
      const timer = setInterval(() => {
        setFaucetCooldown(prev => {
          if (prev <= 1) {
            clearInterval(timer)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [faucetCooldown])

  const getPageTitle = (path: string) => {
    switch (path) {
      case "/":
        return "Streamlet | Crypto Faucet & Rewards"
      case "/faucet":
        return "Streamlet | Faucet"
      case "/shortlinks":
        return "Streamlet | Shortlinks"
      case "/referral":
        return "Streamlet | Referrals"
      case "/leaderboard":
        return "Streamlet | Leaderboard"
      case "/admin/leaderboard":
        return "Streamlet | Admin Leaderboard"
      default:
        return "Streamlet | Crypto Faucet & Rewards"
    }
  }

  const formatCooldown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Update document title globally based on pathname and faucetCooldown
  useEffect(() => {
    const baseTitle = getPageTitle(pathname)
    if (faucetCooldown > 0) {
      document.title = `[${formatCooldown(faucetCooldown)}] ${baseTitle}`
    } else {
      document.title = baseTitle
    }
  }, [pathname, faucetCooldown])

  return (
    <motion.aside 
      initial={false}
      animate={{ width: isSidebarOpen ? 288 : 80 }}
      className={cn(
        "fixed left-0 top-0 h-screen glass-sidebar z-50 border-r border-white/5",
        "flex flex-col overflow-hidden transition-all duration-300",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Brand Logo */}
      <div className={cn("h-20 flex items-center gap-3 mb-6", isSidebarOpen ? "px-6" : "justify-center")}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-fuchsia-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        {isSidebarOpen && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xl font-black tracking-tighter gradient-text whitespace-nowrap"
          >
            STREAMLET
          </motion.span>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-4 space-y-2 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const isFaucetDisabled = item.name === "Faucet" && faucetCooldown > 0
          
          const handleClick = (e: React.MouseEvent) => {
            if (item.comingSoon) {
              e.preventDefault()
              toast.info(`Fitur ${item.name} segera hadir!`)
              return
            }
          }

          return (
            <Link 
              key={item.name} 
              href={item.comingSoon ? "#" : item.href}
              onClick={handleClick}
            >
              <div className={cn(
                "group flex items-center rounded-2xl transition-all duration-200",
                isSidebarOpen ? "gap-4 px-4 py-3.5 w-full" : "justify-center w-12 h-12 mx-auto",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-primary/30 active-glow" 
                  : "text-white/40 hover:text-white hover:bg-white/5"
              )}>
                <div className="relative flex-shrink-0">
                  <item.icon className={cn(
                    "w-6 h-6 transition-transform duration-300 group-hover:scale-110",
                    isActive ? "text-white" : ""
                  )} />
                  {/* Pulsing green dot for Offerwalls when surveys are available */}
                  {item.name === "Offerwalls" && surveysAvailable && (
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 border border-emerald-300/50" />
                    </span>
                  )}
                </div>
                {isSidebarOpen && (
                  <motion.span 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="font-bold text-sm whitespace-nowrap uppercase tracking-widest flex items-center justify-between w-full"
                  >
                    <span>{item.name}</span>
                    {item.comingSoon && (
                      <span className="text-[9px] bg-white/10 text-white/50 px-2 py-0.5 rounded-lg font-black uppercase tracking-wider">
                        Soon
                      </span>
                    )}
                    {item.name === "Offerwalls" && surveysAvailable && (
                      <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-lg font-black uppercase tracking-wider animate-pulse ml-2 flex-shrink-0">
                        Surveys Live
                      </span>
                    )}
                    {item.name === "Faucet" && faucetCooldown > 0 && (
                      <span className="text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-lg font-mono font-bold tracking-normal animate-pulse ml-2 flex-shrink-0">
                        {formatCooldown(faucetCooldown)}
                      </span>
                    )}
                  </motion.span>
                )}
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Bottom Group */}
      <div className="p-4 border-t border-white/5 space-y-4">

        <Button 
          variant="ghost" 
          onClick={toggleSidebar}
          className="w-full h-12 rounded-2xl glass border-white/10 hover:bg-white/10 text-white/50 flex items-center justify-center gap-2"
        >
          {isSidebarOpen ? (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="font-black text-xs uppercase tracking-widest">Collapse Menu</span>
            </>
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </Button>
      </div>
    </motion.aside>
  )
}
