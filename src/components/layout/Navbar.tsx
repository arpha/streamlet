"use client"

import { Bell, User, Settings, LogOut, ChevronDown, Sparkles } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useStore } from "@/store/useStore"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export function Navbar() {
  const { username } = useStore()
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }
  
  return (
    <header className="h-20 bg-transparent sticky top-0 z-30 flex items-center justify-between px-8 gap-4 border-b border-white/[0.05] backdrop-blur-md">
      <div className="flex items-center gap-4">
        <Badge variant="outline" className="hidden md:flex bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-3 py-1.5 rounded-full gap-2 font-bold animate-pulse">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          Network Status: Online
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" className="relative text-white/70 hover:text-white glass border-white/10 h-10 w-10 rounded-xl">
          <Bell className="w-5 h-5" />
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary rounded-full neon-glow shadow-[0_0_8px_rgba(147,51,234,0.8)]" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger className="h-auto px-2 py-1.5 pr-5 rounded-2xl glass border-white/10 hover:bg-white/10 transition-all flex items-center gap-3 group cursor-pointer">
              <div className="relative flex-shrink-0">
                <Avatar className="h-9 w-9 rounded-xl border border-white/20 shadow-xl overflow-hidden">
                  <AvatarImage src="" alt="User" />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-fuchsia-600 text-xs font-black text-white">
                    {username ? username.substring(0, 2).toUpperCase() : "GS"}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-[#020617] rounded-full" />
              </div>
              <div className="hidden sm:flex flex-col items-start gap-0">
                <span className="text-sm font-black text-white leading-tight uppercase">{username || "Guest User"}</span>
                <span className="text-[10px] text-white/40 font-black uppercase tracking-widest leading-none">Member</span>
              </div>
              <ChevronDown className="w-4 h-4 text-white/30 group-hover:text-primary transition-colors ml-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 glass border-white/10 rounded-2xl mt-2 p-2 shadow-[0_20px_50px_rgba(0,0,0,0.5)]" align="end">
            <div className="px-4 py-4 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="font-black text-sm text-white uppercase italic">Account Menu</span>
                <span className="text-[10px] text-white/50 font-bold uppercase tracking-tighter">Manage your settings</span>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/10 mx-2" />
            <DropdownMenuItem className="cursor-pointer gap-2 p-3 rounded-xl focus:bg-white/10 text-white/70 focus:text-white transition-all">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                <User className="w-4 h-4" />
              </div>
              <span className="font-bold uppercase text-xs tracking-widest">My Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer gap-2 p-3 rounded-xl focus:bg-white/10 text-white/70 focus:text-white transition-all">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center border border-white/5">
                <Settings className="w-4 h-4" />
              </div>
              <span className="font-bold uppercase text-xs tracking-widest">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/10 mx-2" />
            <DropdownMenuItem onClick={handleLogout} className="cursor-pointer gap-2 p-3 rounded-xl focus:bg-rose-500/10 text-rose-400 focus:text-rose-400 transition-all">
              <div className="w-9 h-9 rounded-lg bg-rose-400/20 flex items-center justify-center border border-rose-400/20">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="font-bold uppercase text-xs tracking-widest">Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
