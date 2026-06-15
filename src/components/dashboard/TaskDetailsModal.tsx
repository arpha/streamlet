"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { 
  Coins, 
  Smartphone, 
  Monitor, 
  Tablet, 
  FileText, 
  Play,
  CheckCircle,
  AlertCircle
} from "lucide-react"

export interface OfferwallTaskEvent {
  id: string
  name: string
  payout: number
  reward: number
}

export interface OfferwallTask {
  id: string
  provider: "cpx" | "notik"
  title: string
  description: string
  reward: number
  url: string
  image?: string
  duration?: string
  type: "survey" | "offer"
  os?: string[]
  devices?: string[]
  description_long?: string
  events?: OfferwallTaskEvent[]
}

interface TaskDetailsModalProps {
  task: OfferwallTask | null
  isOpen: boolean
  onClose: () => void
}

export function TaskDetailsModal({ task, isOpen, onClose }: TaskDetailsModalProps) {
  if (!task) return null

  const handleStartTask = () => {
    window.open(task.url, "_blank", "noopener,noreferrer")
    onClose()
  }

  // Helper to render platform icons
  const renderPlatforms = () => {
    const badges: React.ReactNode[] = []
    
    const osList = task.os || []
    const deviceList = task.devices || []

    const isAndroid = osList.some(o => o.toLowerCase().includes("android"))
    const isIOS = osList.some(o => o.toLowerCase().includes("ios") || o.toLowerCase().includes("iphone") || o.toLowerCase().includes("ipad"))
    const isWindows = osList.some(o => o.toLowerCase().includes("windows"))
    const isMobile = deviceList.some(d => d.toLowerCase().includes("mobile") || d.toLowerCase().includes("phone"))
    const isTablet = deviceList.some(d => d.toLowerCase().includes("tablet"))

    if (isAndroid) {
      badges.push(
        <span key="android" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold">
          <Smartphone className="w-3 h-3" /> Android
        </span>
      )
    }
    if (isIOS) {
      badges.push(
        <span key="ios" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold">
          <Smartphone className="w-3 h-3" /> iOS
        </span>
      )
    }
    if (isWindows) {
      badges.push(
        <span key="windows" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold">
          <Monitor className="w-3 h-3" /> Windows
        </span>
      )
    }
    if (badges.length === 0) {
      if (isMobile) {
        badges.push(
          <span key="mobile" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold">
            <Smartphone className="w-3 h-3" /> Mobile
          </span>
        )
      }
      if (isTablet) {
        badges.push(
          <span key="tablet" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold">
            <Tablet className="w-3 h-3" /> Tablet
          </span>
        )
      }
    }

    if (badges.length === 0) {
      badges.push(
        <span key="all" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-bold">
          <Monitor className="w-3 h-3" /> All Devices
        </span>
      )
    }

    return badges
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="glass border-white/10 sm:max-w-lg rounded-[2rem] overflow-hidden bg-[#020617]/95 backdrop-blur-2xl p-6 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-[0.02] pointer-events-none">
          <Coins className="w-40 h-40 text-white" />
        </div>

        <DialogHeader className="relative z-10 space-y-4">
          <div className="flex items-start gap-4">
            {/* App/Task Image */}
            <div className="w-16 h-16 rounded-2xl bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center shrink-0 shadow-lg">
              {task.image ? (
                <img 
                  src={task.image} 
                  alt={task.title} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback if image fails to load
                    (e.target as any).src = ""
                    ;(e.target as any).classList.add("hidden")
                  }}
                />
              ) : null}
              {/* Fallback Icon */}
              {!task.image || task.provider === "cpx" ? (
                <div className="w-full h-full flex items-center justify-center bg-purple-500/10 text-purple-400">
                  <FileText className="w-8 h-8" />
                </div>
              ) : null}
            </div>

            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  task.type === "survey" 
                    ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                    : "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                }`}>
                  {task.type === "survey" ? "Survey" : "Offer"}
                </span>
                <span className="text-[10px] font-black uppercase text-white/40 tracking-widest font-mono">
                  {task.provider === "cpx" ? "CPX Research" : "Notik"}
                </span>
              </div>
              
              <DialogTitle className="text-lg font-black text-white leading-tight truncate">
                {task.title}
              </DialogTitle>
              
              <div className="flex flex-wrap gap-1.5 pt-1">
                {renderPlatforms()}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Task Rewards Card */}
        <div className="relative z-10 my-4 bg-gradient-to-r from-purple-500/10 to-fuchsia-500/10 border border-white/5 rounded-2xl p-4 flex items-center justify-between shadow-inner">
          <div className="space-y-0.5">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest block">Task Reward</span>
            <span className="text-2xl font-black font-mono text-amber-400 flex items-center gap-1.5 animate-pulse">
              +{task.reward.toLocaleString()} <span className="text-sm font-bold text-white/60">Pts</span>
            </span>
          </div>
          <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Coins className="w-5 h-5" />
          </div>
        </div>

        {/* Long Instructions */}
        <div className="relative z-10 py-2 space-y-3">
          <h4 className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Completion Instructions</h4>
          <div className="bg-black/40 border border-white/5 rounded-2xl p-4 max-h-[30vh] overflow-y-auto custom-scrollbar">
            <div className="text-white/80 text-xs leading-relaxed whitespace-pre-wrap font-medium">
              {task.description_long || task.description || "Complete this task to earn coins."}
            </div>
          </div>
        </div>

        {/* Task Milestones & Rewards */}
        {task.events && task.events.length > 0 && (
          <div className="relative z-10 py-2 space-y-3">
            <h4 className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">Task Milestones & Rewards</h4>
            <div className="bg-black/40 border border-white/5 rounded-2xl p-4 max-h-[25vh] overflow-y-auto custom-scrollbar space-y-2">
              {task.events.map((event) => (
                <div key={event.id} className="flex items-center justify-between text-xs py-1.5 border-b border-white/[0.03] last:border-0 last:pb-0">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0"></div>
                    <span className="text-white/80 font-medium">
                      {event.name
                        .replace(/[_-]/g, " ")
                        .replace(/\b\w/g, c => c.toUpperCase())}
                    </span>
                  </div>
                  <div className="text-amber-400 font-bold font-mono shrink-0">
                    +{event.reward.toLocaleString()} Pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Verification Info */}
        <div className="relative z-10 py-3 flex items-start gap-2 text-white/40">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-purple-400" />
          <p className="text-[10px] font-semibold leading-relaxed">
            Points will be credited automatically once successful completion is reported by the provider. Please ensure you meet all requirements listed above.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="relative z-10 border-t border-white/5 pt-4 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all border border-white/5 hover:border-white/10 uppercase tracking-wider"
          >
            Cancel
          </button>
          
          <button
            onClick={handleStartTask}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-purple-500/20 uppercase tracking-widest"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Start Task
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
