"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { createClient } from "@/lib/supabase"
import { MessageSquare, Calendar, CheckCircle2 } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"

interface Message {
  id: string
  title: string
  content: string
  is_read: boolean
  created_at: string
}

interface MessageModalProps {
  message: Message | null
  isOpen: boolean
  onClose: () => void
  onMarkAsRead?: (id: string) => void
}

export function MessageModal({ message, isOpen, onClose, onMarkAsRead }: MessageModalProps) {
  const supabase = createClient()

  useEffect(() => {
    const markAsRead = async () => {
      if (message && !message.is_read && isOpen) {
        try {
          const { error } = await supabase
            .from('user_messages')
            .update({ is_read: true })
            .eq('id', message.id)

          if (error) throw error
          
          if (onMarkAsRead) {
            onMarkAsRead(message.id)
          }
        } catch (error) {
          console.error("Failed to mark message as read:", error)
        }
      }
    }

    markAsRead()
  }, [message, isOpen, supabase, onMarkAsRead])

  if (!message) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass border-white/10 sm:max-w-md rounded-3xl overflow-hidden bg-[#020617]/90 backdrop-blur-xl">
        <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
          <MessageSquare className="w-32 h-32 text-white" />
        </div>
        
        <DialogHeader className="relative z-10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner">
              <MessageSquare className="w-6 h-6 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black text-white leading-tight">
                {message.title}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <Calendar className="w-3 h-3 text-white/40" />
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest">
                  {new Date(message.created_at).toLocaleDateString()}
                </span>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="relative z-10 py-6 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
          <div className="text-white/80 leading-relaxed whitespace-pre-wrap text-sm">
            {message.content}
          </div>
        </div>

        <div className="relative z-10 border-t border-white/5 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-widest">Read</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-sm transition-all border border-white/5 hover:border-white/10"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
