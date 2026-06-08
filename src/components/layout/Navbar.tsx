"use client"

import { Bell, User, Settings, LogOut, ChevronDown, Sparkles, Menu, FileText, MessageSquare, Inbox } from "lucide-react"
import { useState, useEffect } from "react"
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

import { MessageModal } from "@/components/messages/MessageModal"

export function Navbar() {
  const { username, toggleSidebar, isAdmin, id: userId } = useStore()
  const supabase = createClient()
  const router = useRouter()

  const [messages, setMessages] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  const fetchMessages = async () => {
    if (!userId) return
    try {
      const { data, error } = await supabase
        .from('user_messages')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5)
      
      if (error) throw error
      setMessages(data || [])
      setUnreadCount(data?.filter(m => !m.is_read).length || 0)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchMessages()
    // Optional: add realtime subscription for new messages here
  }, [userId])

  const handleMarkAsRead = (id: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }
  
  return (
    <header className="h-20 bg-transparent sticky top-0 z-30 flex items-center justify-between px-8 gap-4 border-b border-white/[0.05] backdrop-blur-md">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleSidebar}
          className="md:hidden text-white/70 hover:text-white glass border-white/10 h-10 w-10 rounded-xl"
        >
          <Menu className="w-5 h-5" />
        </Button>
        <Badge variant="outline" className="hidden md:flex bg-emerald-500/10 text-emerald-400 border-emerald-500/30 px-3 py-1.5 rounded-full gap-2 font-bold animate-pulse">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
          Network Status: Online
        </Badge>
      </div>

      <div className="flex items-center gap-4">
        <a 
          href="https://t.me/streamletfaucet" 
          target="_blank" 
          rel="noopener noreferrer" 
          title="Join Telegram"
          className="flex items-center justify-center text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 border border-sky-500/20 bg-sky-500/5 h-10 w-10 rounded-xl transition-all"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69.01-.03.01-.14-.07-.2-.08-.06-.19-.04-.27-.02-.12.02-1.96 1.24-5.54 3.65-.52.36-1 .53-1.42.52-.47-.01-1.37-.27-2.03-.49-.82-.27-1.47-.41-1.42-.87.03-.24.36-.49.99-.74 3.89-1.69 6.48-2.8 7.77-3.32 3.7-1.5 4.46-1.76 4.96-1.77.11 0 .36.03.52.16.13.11.17.27.18.38 0 .08-.01.27-.02.35z"/>
          </svg>
        </a>

        <DropdownMenu>
          <DropdownMenuTrigger className="relative text-white/70 hover:text-white glass border-white/10 h-10 w-10 rounded-xl flex items-center justify-center cursor-pointer">
            <MessageSquare className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-rose-500 rounded-full neon-glow shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-80 glass border-white/10 rounded-2xl mt-2 p-0 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden" align="end">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <span className="font-black text-sm text-white uppercase tracking-widest">Messages</span>
              {unreadCount > 0 && (
                <Badge variant="outline" className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px] px-2 py-0">
                  {unreadCount} New
                </Badge>
              )}
            </div>
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {messages.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center text-white/30">
                  <Inbox className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-xs font-bold uppercase tracking-widest">No messages</span>
                </div>
              ) : (
                messages.map(msg => (
                  <div 
                    key={msg.id}
                    onClick={() => setSelectedMessage(msg)}
                    className="p-4 border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className={`text-sm font-bold truncate ${!msg.is_read ? 'text-white' : 'text-white/60'}`}>
                        {msg.title}
                      </h4>
                      {!msg.is_read && (
                        <div className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <p className="text-xs text-white/40 line-clamp-1 mt-1 font-medium group-hover:text-white/60 transition-colors">
                      {msg.content}
                    </p>
                    <p className="text-[9px] text-white/30 font-black uppercase mt-2">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

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
            {isAdmin && (
              <>
                <DropdownMenuItem 
                  onClick={() => router.push("/admin/blog")}
                  className="cursor-pointer gap-2 p-3 rounded-xl focus:bg-purple-500/10 text-purple-400 focus:text-purple-300 transition-all"
                >
                  <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center border border-purple-500/20">
                    <FileText className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="font-bold uppercase text-xs tracking-widest">Admin Blog</span>
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => router.push("/admin/messages")}
                  className="cursor-pointer gap-2 p-3 rounded-xl focus:bg-emerald-500/10 text-emerald-400 focus:text-emerald-300 transition-all mt-1"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/20">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="font-bold uppercase text-xs tracking-widest">Admin Messages</span>
                </DropdownMenuItem>
              </>
            )}
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

      <MessageModal 
        message={selectedMessage} 
        isOpen={!!selectedMessage} 
        onClose={() => setSelectedMessage(null)}
        onMarkAsRead={handleMarkAsRead}
      />
    </header>
  )
}
