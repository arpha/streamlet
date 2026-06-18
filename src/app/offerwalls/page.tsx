"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  Gamepad2, 
  Coins, 
  HelpCircle, 
  Info, 
  CheckCircle2, 
  ShieldCheck,
  MousePointer2,
  FileText,
  Smartphone,
  Monitor,
  Tablet,
  Play,
  ArrowRight,
  Loader2,
  Sparkles,
  Ticket,
  Zap,
  Calendar,
  AlertCircle,
  Timer
} from "lucide-react"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import { useAuth } from "@/components/providers/AuthProvider"
import { TaskDetailsModal, OfferwallTask } from "@/components/dashboard/TaskDetailsModal"
import { toast } from "sonner"


// Subcomponent to handle CPX Research lifecycle
function CPXWidget({ userId }: { userId: string }) {
  const appId = process.env.NEXT_PUBLIC_CPX_RESEARCH_APP_ID || ""

  useEffect(() => {
    if (!userId || !appId || appId === "0") return

    // Configure CPX parameters globally on window
    ;(window as any).config = {
      general_config: {
        app_id: parseInt(appId, 10),
        ext_user_id: userId,
        email: "",
        username: "",
        secure_hash: "",
        subid_1: "",
        subid_2: ""
      },
      style_config: {
        text_color: "#ffffff",
        survey_box: {
          topbar_background_color: "#a855f7", // purple-500
          box_background_color: "#18181b", // zinc-900
          rounded_borders: true,
          stars_filled: "#fbbf24" // amber-400
        }
      },
      script_config: [
        {
          div_id: "cpx-fullscreen",
          theme_style: 1, // Full Content Widget
          order_by: 2,
          limit_surveys: 12
        }
      ],
      debug: false,
      useIFrame: true
    }

    // Append script tag dynamically
    const script = document.createElement("script")
    script.src = "https://cdn.cpx-research.com/assets/js/script_tag_v2.0.js"
    script.async = true
    document.body.appendChild(script)

    return () => {
      // Cleanup script & config on unmount
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
      delete (window as any).config
      const container = document.getElementById("cpx-fullscreen")
      if (container) {
        container.innerHTML = ""
      }
    }
  }, [userId, appId])

  if (!appId || appId === "0") {
    return (
      <Card className="glass border-white/10 rounded-[2rem] p-8 space-y-6">
        <div className="space-y-4 text-center max-w-2xl mx-auto">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white uppercase tracking-tight">CPX Research Configuration Needed</h3>
          <p className="text-white/60 text-sm">
            CPX Research App ID has not been configured in the environment variables yet.
          </p>
          
          <div className="text-left bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-xs text-white/80 space-y-2">
            <p className="text-purple-400 font-bold"># How to enable CPX Research Offerwall:</p>
            <p>1. Get your **App ID** and **Secure Hash** from your CPX Research Publisher dashboard.</p>
            <p>2. Add the following variables to your <code className="text-cyan-400">.env.local</code> file:</p>
            <pre className="bg-black/60 p-3 rounded-lg mt-2 text-emerald-400">
{`NEXT_PUBLIC_CPX_RESEARCH_APP_ID=your_cpx_app_id
CPX_RESEARCH_SECRET_KEY=your_cpx_secret_key`}
            </pre>
            <p className="mt-2 text-white/40">3. Restart your dev server to apply the env changes.</p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center px-4">
        <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          CPX Research Offerwall Loaded
        </span>
        <span className="text-xs text-white/40 font-mono">User: {userId.substring(0, 8)}...</span>
      </div>
      
      <div className="glass border border-white/10 rounded-[2rem] p-6 bg-black/20 shadow-2xl relative min-h-[500px]">
        {/* CPX Research Container */}
        <div id="cpx-fullscreen" className="w-full min-h-[400px]"></div>
      </div>
    </div>
  )
}

export default function OfferwallsPage() {
  const router = useRouter()
  const { id: userId, eventTickets, balance, setEventTickets, setBalance } = useStore()
  const { user, loading: authLoading } = useAuth()
  const [apiKey, setApiKey] = useState<string>("")
  const [theoremreachApiKey, setTheoremreachApiKey] = useState<string>("")
  const [bitlabsApiKey, setBitlabsApiKey] = useState<string>("")
  const [notikApiKey, setNotikApiKey] = useState<string>("")
  const [notikPubId, setNotikPubId] = useState<string>("")
  const [notikAppId, setNotikAppId] = useState<string>("")
  const [loading, setLoading] = useState<boolean>(true)
  const [activeTab, setActiveTab] = useState<"home" | "bitcotasks" | "cpx" | "theoremreach" | "bitlabs" | "notik" | "booster_history">("home")
  const [bitcotasksEarnings, setBitcotasksEarnings] = useState<number>(0)
  const [cpxEarnings, setCpxEarnings] = useState<number>(0)
  const [theoremreachEarnings, setTheoremreachEarnings] = useState<number>(0)
  const [bitlabsEarnings, setBitlabsEarnings] = useState<number>(0)
  const [notikEarnings, setNotikEarnings] = useState<number>(0)

  // Home tasks state
  const [homeTasks, setHomeTasks] = useState<OfferwallTask[]>([])
  const [tasksLoading, setTasksLoading] = useState<boolean>(true)
  const [selectedTask, setSelectedTask] = useState<OfferwallTask | null>(null)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [deviceFilter, setDeviceFilter] = useState<"all" | "android" | "ios" | "desktop">("all")
  const [taskTypeFilter, setTaskTypeFilter] = useState<"all" | "survey" | "offer">("all")

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login")
    }
  }, [user, authLoading, router])

  useEffect(() => {
    // Load the public BitcoTasks API Key from env
    const key = process.env.NEXT_PUBLIC_BITCOTASKS_API_KEY || ""
    setApiKey(key)

    // Load the public TheoremReach API Key from env
    const trKey = process.env.NEXT_PUBLIC_THEOREMREACH_API_KEY || ""
    setTheoremreachApiKey(trKey)

    // Load the public BitLabs App Token from env
    const blKey = process.env.NEXT_PUBLIC_BITLABS_APP_TOKEN || ""
    setBitlabsApiKey(blKey)

    // Load Notik.me details from env
    const nKey = process.env.NEXT_PUBLIC_NOTIK_API_KEY || ""
    const nPub = process.env.NEXT_PUBLIC_NOTIK_PUB_ID || ""
    const nApp = process.env.NEXT_PUBLIC_NOTIK_APP_ID || ""
    setNotikApiKey(nKey)
    setNotikPubId(nPub)
    setNotikAppId(nApp)

    setLoading(false)
  }, [])

  useEffect(() => {
    if (!userId) return

    async function fetchEarnings() {
      const supabase = createClient()
      
      // Fetch BitcoTasks earnings
      const { data: bitcoData, error: bitcoErr } = await supabase
        .from("offerwall_claims")
        .select("points_reward")
        .eq("user_id", userId)
        .eq("provider", "bitcotasks")
        .eq("status", "completed")

      if (!bitcoErr && bitcoData) {
        const total = bitcoData.reduce((sum, item) => sum + (item.points_reward || 0), 0)
        setBitcotasksEarnings(total)
      }

      // Fetch CPX Research earnings
      const { data: cpxData, error: cpxErr } = await supabase
        .from("offerwall_claims")
        .select("points_reward")
        .eq("user_id", userId)
        .eq("provider", "cpx-research")
        .eq("status", "completed")

      if (!cpxErr && cpxData) {
        const total = cpxData.reduce((sum, item) => sum + (item.points_reward || 0), 0)
        setCpxEarnings(total)
      }

      // Fetch TheoremReach earnings
      const { data: trData, error: trErr } = await supabase
        .from("offerwall_claims")
        .select("points_reward")
        .eq("user_id", userId)
        .eq("provider", "theoremreach")
        .eq("status", "completed")

      if (!trErr && trData) {
        const total = trData.reduce((sum, item) => sum + (item.points_reward || 0), 0)
        setTheoremreachEarnings(total)
      }

      // Fetch BitLabs earnings
      const { data: blData, error: blErr } = await supabase
        .from("offerwall_claims")
        .select("points_reward")
        .eq("user_id", userId)
        .eq("provider", "bitlabs")
        .eq("status", "completed")

      if (!blErr && blData) {
        const total = blData.reduce((sum, item) => sum + (item.points_reward || 0), 0)
        setBitlabsEarnings(total)
      }

      // Fetch Notik earnings
      const { data: notikData, error: notikErr } = await supabase
        .from("offerwall_claims")
        .select("points_reward")
        .eq("user_id", userId)
        .eq("provider", "notik")
        .eq("status", "completed")

      if (!notikErr && notikData) {
        const total = notikData.reduce((sum, item) => sum + (item.points_reward || 0), 0)
        setNotikEarnings(total)
      }
    }

    fetchEarnings()
  }, [userId])

  // Fetch unified home tasks (CPX Research & Notik)
  useEffect(() => {
    if (!userId) return

    async function fetchHomeTasks() {
      setTasksLoading(true)
      try {
        const res = await fetch(`/api/offerwalls/tasks?user_id=${userId}`)
        const data = await res.json()
        if (data.success) {
          setHomeTasks(data.tasks || [])
        }
      } catch (err) {
        console.error("Error fetching home tasks:", err)
      } finally {
        setTasksLoading(false)
      }
    }

    fetchHomeTasks()
  }, [userId])

  // Booster History states and actions
  const [completedClaims, setCompletedClaims] = useState<any[]>([])
  const [claimsLoading, setClaimsLoading] = useState<boolean>(false)
  const [boostingId, setBoostingId] = useState<string | null>(null)

  const fetchCompletedClaims = async () => {
    if (!userId) return
    setClaimsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("offerwall_claims")
        .select("id, provider, transaction_id, points_reward, status, is_boosted, boost_points_added, completed_at")
        .eq("user_id", userId)
        .eq("status", "completed")
        .order("completed_at", { ascending: false })

      if (error) throw error
      setCompletedClaims(data || [])
    } catch (err) {
      console.error("Error fetching completed claims:", err)
      toast.error("Failed to load completed tasks.")
    } finally {
      setClaimsLoading(false)
    }
  }

  const handleApplyBooster = async (claimId: string) => {
    if (!userId) return
    if (eventTickets < 1) {
      toast.error("You don't have any Event Tickets left!")
      return
    }
    setBoostingId(claimId)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc("apply_offerwall_booster", {
        p_claim_id: claimId
      })
      if (error) throw error
      
      const result = data as any
      if (result.success) {
        toast.success(result.message || "Booster applied successfully!", {
          icon: <Sparkles className="w-5 h-5 text-purple-400" />
        })
        if (result.new_balance !== undefined) setBalance(Number(result.new_balance))
        if (result.new_tickets !== undefined) setEventTickets(Number(result.new_tickets))
        
        await fetchCompletedClaims()
      } else {
        toast.error(result.message || "Failed to apply booster.")
      }
    } catch (err: any) {
      console.error("Error applying booster:", err)
      toast.error(err.message || "Failed to apply booster.")
    } finally {
      setBoostingId(null)
    }
  }

  useEffect(() => {
    if (activeTab === "booster_history" && userId) {
      fetchCompletedClaims()
    }
  }, [activeTab, userId])

  const handleLoginRedirect = () => {
    router.push("/auth/login")
  }

  if (authLoading || !user || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* HEADER */}
      <div className="text-center md:text-left relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest mb-4">
          <Gamepad2 className="w-3.5 h-3.5" />
          Offerwalls Wall
        </div>
        <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 italic uppercase">OFFERWALLS</h2>
        <p className="text-white/60 font-medium italic">Complete surveys, install apps, and complete online tasks to earn massive points!</p>
      </div>

      {/* PROVIDER SWITCHER TABS */}
      <div className="flex flex-wrap justify-center md:justify-start gap-4 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab("home")}
          className={`px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === "home"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          ⚡ Home / Populer
        </button>
        <button
          onClick={() => setActiveTab("bitcotasks")}
          className={`px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === "bitcotasks"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          BitcoTasks
        </button>
        <button
          onClick={() => setActiveTab("cpx")}
          className={`px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === "cpx"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          CPX Research Surveys
        </button>
        <button
          onClick={() => setActiveTab("theoremreach")}
          className={`px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === "theoremreach"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          TheoremReach Surveys
        </button>
        <button
          onClick={() => setActiveTab("bitlabs")}
          className={`px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === "bitlabs"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          BitLabs Surveys
        </button>
        <button
          onClick={() => setActiveTab("notik")}
          className={`px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === "notik"
              ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          Notik
        </button>
        <button
          onClick={() => setActiveTab("booster_history")}
          className={`px-6 py-2.5 rounded-full font-black uppercase text-xs tracking-wider transition-all duration-300 ${
            activeTab === "booster_history"
              ? "bg-gradient-to-r from-purple-600 to-fuchsia-600 text-white shadow-lg shadow-purple-600/30"
              : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          🎫 Booster & History
        </button>
      </div>



      {/* USER & CONFIG INTEGRATION */}
      {!userId ? (
        <Card className="glass border-white/10 rounded-[2rem] p-8 text-center space-y-6">
          <div className="max-w-md mx-auto space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Info className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white uppercase tracking-tight">Authentication Required</h3>
            <p className="text-white/60 text-sm">
              Please sign in to your account to access offerwalls. Your user ID is required to credit points to your balance upon offer completion.
            </p>
            <Button 
              onClick={handleLoginRedirect}
              className="bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-bold rounded-2xl px-8 py-6 h-auto shadow-lg shadow-purple-500/20 uppercase tracking-wider"
            >
              Sign In Now
            </Button>
          </div>
        </Card>
      ) : activeTab === "home" ? (
        <div className="space-y-6">
          {/* Header & Filter */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                Recommended Popular Tasks
              </h3>
              <p className="text-white/40 text-xs mt-1">Complete surveys or offers below to earn points instantly.</p>
            </div>
            
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 shrink-0 self-start md:self-auto">
              {/* Category Filter */}
              <div className="flex flex-wrap items-center gap-1 bg-black/40 border border-white/5 p-1 rounded-2xl">
                {(["all", "survey", "offer"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setTaskTypeFilter(filter)}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      taskTypeFilter === filter
                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {filter === "all" ? "All" : filter === "survey" ? "Surveys" : "Apps"}
                  </button>
                ))}
              </div>

              {/* Device Filter */}
              <div className="flex flex-wrap items-center gap-1 bg-black/40 border border-white/5 p-1 rounded-2xl">
                {(["all", "android", "ios", "desktop"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setDeviceFilter(filter)}
                    className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                      deviceFilter === filter
                        ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                        : "text-white/40 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {filter === "all" ? "All Devices" : filter === "android" ? "Android" : filter === "ios" ? "iOS" : "Desktop"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Tasks Loading State */}
          {tasksLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="glass border border-white/5 rounded-[2rem] p-6 space-y-4 animate-pulse bg-white/[0.02] h-64 flex flex-col justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-white/5 rounded-2xl shrink-0"></div>
                    <div className="space-y-2 flex-1 pt-1">
                      <div className="h-3 bg-white/10 rounded w-16"></div>
                      <div className="h-4 bg-white/10 rounded w-32"></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-white/5 rounded w-full"></div>
                    <div className="h-3 bg-white/5 rounded w-5/6"></div>
                  </div>
                  <div className="h-10 bg-white/10 rounded-2xl w-full"></div>
                </div>
              ))}
            </div>
          ) : (
            (() => {
              // Filter home tasks based on deviceFilter and taskTypeFilter
              const filtered = homeTasks.filter(t => {
                // Filter by task type
                if (taskTypeFilter !== "all" && t.type !== taskTypeFilter) {
                  return false
                }

                // Filter by device
                if (deviceFilter === "all") return true
                const osList = t.os || []
                const deviceList = t.devices || []
                
                if (deviceFilter === "android") {
                  return osList.some(o => o.toLowerCase().includes("android"))
                }
                if (deviceFilter === "ios") {
                  return osList.some(o => o.toLowerCase().includes("ios") || o.toLowerCase().includes("iphone") || o.toLowerCase().includes("ipad"))
                }
                if (deviceFilter === "desktop") {
                  return osList.some(o => o.toLowerCase().includes("windows") || o.toLowerCase().includes("mac os")) || deviceList.some(d => d.toLowerCase().includes("desktop"))
                }
                return true
              })

              if (filtered.length === 0) {
                return (
                  <Card className="glass border-white/10 rounded-[2rem] p-12 text-center">
                    <div className="max-w-md mx-auto space-y-4">
                      <div className="w-16 h-16 mx-auto rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                        <Info className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-bold text-white uppercase tracking-tight">
                        No {taskTypeFilter === "survey" ? "Surveys" : taskTypeFilter === "offer" ? "App Tasks" : "Tasks"} Available
                      </h3>
                      <p className="text-white/60 text-xs leading-relaxed">
                        Currently, there are no {taskTypeFilter === "survey" ? "surveys" : taskTypeFilter === "offer" ? "app offers" : "surveys or offers"} matching your filter criteria. Please try another filter or visit the provider tab directly.
                      </p>
                    </div>
                  </Card>
                )
              }

              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filtered.map((task) => (
                    <div 
                      key={task.id} 
                      className="glass border border-white/10 rounded-[2rem] overflow-hidden hover:border-white/20 transition-all duration-300 relative group flex flex-col justify-between h-full bg-[#090d16]/30 p-6"
                    >
                      <div className="space-y-4">
                        <div className="flex items-start gap-4">
                          {/* Image Thumbnail */}
                          <div className="w-14 h-14 rounded-2xl bg-zinc-800 border border-white/5 overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                            {task.image ? (
                              <img 
                                src={task.image} 
                                alt={task.title} 
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as any).src = ""
                                  ;(e.target as any).classList.add("hidden")
                                }}
                              />
                            ) : null}
                            {!task.image || task.provider === "cpx" ? (
                              <div className="w-full h-full flex items-center justify-center bg-purple-500/10 text-purple-400">
                                <FileText className="w-6 h-6" />
                              </div>
                            ) : null}
                          </div>

                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                task.type === "survey" 
                                  ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" 
                                  : "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/30"
                              }`}>
                                {task.type === "survey" ? "Survey" : "Offer"}
                              </span>
                              <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest font-mono">
                                {task.provider === "cpx" ? "CPX" : "Notik"}
                              </span>
                            </div>
                            <h4 className="text-sm font-black text-white truncate leading-tight mt-1">
                              {task.title}
                            </h4>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-white/60 text-xs font-medium line-clamp-2 leading-relaxed">
                            {task.description}
                          </p>
                          
                          {/* Reward points */}
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 font-mono text-sm font-black">
                            <Coins className="w-4 h-4" />
                            +{task.reward.toLocaleString()} <span className="text-[10px] font-bold text-white/50">Pts</span>
                          </div>
                        </div>
                      </div>

                      {/* Card Actions */}
                      <div className="flex items-center gap-2 pt-6 mt-auto">
                        {task.provider === "notik" && (
                          <button
                            onClick={() => {
                              setSelectedTask(task)
                              setIsModalOpen(true)
                            }}
                            className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs transition-all border border-white/5 hover:border-white/10 uppercase tracking-wider text-center"
                          >
                            Detail
                          </button>
                        )}
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-[2] px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-purple-500/10 uppercase tracking-widest text-center"
                        >
                          START <ArrowRight className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()
          )}
        </div>
      ) : activeTab === "bitcotasks" ? (
        !apiKey ? (
          // Guide to setup when BitcoTasks API key is missing
          <Card className="glass border-white/10 rounded-[2rem] p-8 space-y-6">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Offerwall Configuration Needed</h3>
              <p className="text-white/60 text-sm">
                BitcoTasks API key has not been configured in the environment variables yet.
              </p>
              
              <div className="text-left bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-xs text-white/80 space-y-2">
                <p className="text-purple-400 font-bold"># How to enable BitcoTasks Offerwall:</p>
                <p>1. Get your **API Key** (Website Key) and **Secret Key** from your BitcoTasks Publisher dashboard.</p>
                <p>2. Add the following variables to your <code className="text-cyan-400">.env.local</code> file:</p>
                <pre className="bg-black/60 p-3 rounded-lg mt-2 text-emerald-400">
{`NEXT_PUBLIC_BITCOTASKS_API_KEY=your_bitcotasks_api_key
BITCOTASKS_SECRET_KEY=your_bitcotasks_secret_key`}
                </pre>
                <p className="mt-2 text-white/40">3. Restart your dev server to apply the env changes.</p>
              </div>
            </div>
          </Card>
        ) : (
          // IFRAME INTEGRATION
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                BitcoTasks Offerwall Loaded
              </span>
              <span className="text-xs text-white/40 font-mono">User: {userId.substring(0, 8)}...</span>
            </div>
            
            <div className="glass border border-white/10 rounded-[2rem] overflow-hidden bg-black/20 shadow-2xl relative">
              <iframe 
                src={`https://bitcotasks.com/offerwall/${apiKey}/${userId}`}
                style={{ width: "100%", height: "800px", border: "none" }}
                title="BitcoTasks Offerwall"
                className="w-full"
                scrolling="yes"
              />
            </div>
          </div>
        )
      ) : activeTab === "theoremreach" ? (
        !theoremreachApiKey ? (
          // Guide to setup when TheoremReach API key is missing
          <Card className="glass border-white/10 rounded-[2rem] p-8 space-y-6">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Offerwall Configuration Needed</h3>
              <p className="text-white/60 text-sm">
                TheoremReach API key has not been configured in the environment variables yet.
              </p>
              
              <div className="text-left bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-xs text-white/80 space-y-2">
                <p className="text-purple-400 font-bold"># How to enable TheoremReach Offerwall:</p>
                <p>1. Get your **API Key** (App API Key) and **Secret Key** from your TheoremReach Publisher dashboard.</p>
                <p>2. Add the following variables to your <code className="text-cyan-400">.env.local</code> file:</p>
                <pre className="bg-black/60 p-3 rounded-lg mt-2 text-emerald-400">
{`NEXT_PUBLIC_THEOREMREACH_API_KEY=your_theoremreach_api_key
THEOREMREACH_SECRET_KEY=your_theoremreach_secret_key`}
                </pre>
                <p className="mt-2 text-white/40">3. Restart your dev server to apply the env changes.</p>
              </div>
            </div>
          </Card>
        ) : (
          // IFRAME INTEGRATION
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                TheoremReach Offerwall Loaded
              </span>
              <span className="text-xs text-white/40 font-mono">User: {userId.substring(0, 8)}...</span>
            </div>
            
            <div className="glass border border-white/10 rounded-[2rem] overflow-hidden bg-black/20 shadow-2xl relative">
              <iframe 
                src={`https://theoremreach.com/respondent_entry/direct?api_key=${theoremreachApiKey}&user_id=${userId}`}
                style={{ width: "100%", height: "800px", border: "none" }}
                title="TheoremReach Offerwall"
                className="w-full"
                scrolling="yes"
              />
            </div>
          </div>
        )
      ) : activeTab === "bitlabs" ? (
        !bitlabsApiKey ? (
          // Guide to setup when BitLabs API key is missing
          <Card className="glass border-white/10 rounded-[2rem] p-8 space-y-6">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Offerwall Configuration Needed</h3>
              <p className="text-white/60 text-sm">
                BitLabs App Token has not been configured in the environment variables yet.
              </p>
              
              <div className="text-left bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-xs text-white/80 space-y-2">
                <p className="text-purple-400 font-bold"># How to enable BitLabs Offerwall:</p>
                <p>1. Get your **App/API Token** and **Secret Key** from your BitLabs Publisher dashboard.</p>
                <p>2. Add the following variables to your <code className="text-cyan-400">.env.local</code> file:</p>
                <pre className="bg-black/60 p-3 rounded-lg mt-2 text-emerald-400">
{`NEXT_PUBLIC_BITLABS_APP_TOKEN=your_bitlabs_app_token
BITLABS_SECRET_KEY=your_bitlabs_secret_key`}
                </pre>
                <p className="mt-2 text-white/40">3. Restart your dev server to apply the env changes.</p>
              </div>
            </div>
          </Card>
        ) : (
          // IFRAME INTEGRATION
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                BitLabs Offerwall Loaded
              </span>
              <span className="text-xs text-white/40 font-mono">User: {userId.substring(0, 8)}...</span>
            </div>
            
            <div className="glass border border-white/10 rounded-[2rem] overflow-hidden bg-black/20 shadow-2xl relative">
              <iframe 
                src={`https://web.bitlabs.ai/?uid=${userId}&token=${bitlabsApiKey}&theme=DARK`}
                style={{ width: "100%", height: "800px", border: "none" }}
                title="BitLabs Offerwall"
                className="w-full"
                scrolling="yes"
              />
            </div>
          </div>
        )
      ) : activeTab === "notik" ? (
        !notikApiKey || !notikPubId || !notikAppId ? (
          // Guide to setup when Notik credentials are missing
          <Card className="glass border-white/10 rounded-[2rem] p-8 space-y-6">
            <div className="space-y-4 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-tight">Offerwall Configuration Needed</h3>
              <p className="text-white/60 text-sm">
                Notik API key, Publisher ID, or App ID has not been configured in the environment variables yet.
              </p>
              
              <div className="text-left bg-black/40 border border-white/5 p-5 rounded-2xl font-mono text-xs text-white/80 space-y-2">
                <p className="text-purple-400 font-bold"># How to enable Notik Offerwall:</p>
                <p>1. Get your **API Key**, **Publisher ID**, and **App ID** from your Notik Publisher dashboard.</p>
                <p>2. Add the following variables to your <code className="text-cyan-400">.env.local</code> file:</p>
                <pre className="bg-black/60 p-3 rounded-lg mt-2 text-emerald-400">
{`NEXT_PUBLIC_NOTIK_API_KEY=your_notik_api_key
NEXT_PUBLIC_NOTIK_PUB_ID=your_notik_pub_id
NEXT_PUBLIC_NOTIK_APP_ID=your_notik_app_id
NOTIK_SECRET_KEY=your_notik_secret_key`}
                </pre>
                <p className="mt-2 text-white/40">3. Restart your dev server to apply the env changes.</p>
              </div>
            </div>
          </Card>
        ) : (
          // IFRAME INTEGRATION
          <div className="space-y-4">
            <div className="flex justify-between items-center px-4">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Notik Offerwall Loaded
              </span>
              <span className="text-xs text-white/40 font-mono">User: {userId.substring(0, 8)}...</span>
            </div>
            
            <div className="glass border border-white/10 rounded-[2rem] overflow-hidden bg-black/20 shadow-2xl relative">
              <iframe 
                src={`https://notik.me/coins?api_key=${notikApiKey}&pub_id=${notikPubId}&app_id=${notikAppId}&user_id=${userId}`}
                style={{ width: "100%", height: "800px", border: "none" }}
                title="Notik Offerwall"
                className="w-full"
                scrolling="yes"
              />
            </div>
          </div>
        )
      ) : activeTab === "cpx" ? (
        // CPX Research dynamic widget
        <CPXWidget userId={userId} />
      ) : activeTab === "booster_history" ? (
        // Booster & History View
        <BoosterHistoryView 
          eventTickets={eventTickets}
          completedClaims={completedClaims}
          claimsLoading={claimsLoading}
          boostingId={boostingId}
          onApplyBoost={handleApplyBooster}
        />
      ) : null}

      {/* FOOTER RULES */}
      <Card className="glass border-white/10 rounded-[2rem] overflow-hidden relative group">
        <div className="p-6 md:p-8 space-y-4">
          <h4 className="text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-400" />
            Offerwalls Rules & Guidelines
          </h4>
          <ul className="grid gap-3 text-xs md:text-sm text-white/60 font-medium">
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Use real and honest information when completing surveys. Random or fake answers will result in reward rejection by providers.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Using VPNs, Proxies, or other location spoofing tools is strictly prohibited. Violations will result in a permanent account suspension.</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>Point rewards may take anywhere from a few minutes up to 24 hours to process depending on the task type (e.g. game installations require level completion verification).</span>
            </li>
            <li className="flex gap-2.5 items-start">
              <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
              <span>If you experience issues with points not being credited after completing a task, please click the support/help button directly inside the offerwall widget.</span>
            </li>
          </ul>
        </div>
      </Card>

      {/* Task details modal */}
      <TaskDetailsModal 
        task={selectedTask}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setSelectedTask(null)
        }}
      />
    </div>
  )
}

function BoosterHistoryView({ 
  eventTickets, 
  completedClaims, 
  claimsLoading, 
  boostingId, 
  onApplyBoost 
}: { 
  eventTickets: number
  completedClaims: any[]
  claimsLoading: boolean
  boostingId: string | null
  onApplyBoost: (claimId: string) => void
}) {
  return (
    <div className="space-y-6">
      {/* Ticket Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="glass border-white/10 rounded-[2rem] p-6 col-span-1 md:col-span-1 bg-gradient-to-br from-purple-500/10 to-fuchsia-500/10 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Ticket className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white/60 uppercase tracking-widest">Available Tickets</h3>
              <p className="text-4xl font-black font-mono text-white mt-1">{eventTickets} 🎫</p>
            </div>
          </div>
          <p className="text-[10px] text-white/40 mt-4 leading-relaxed font-medium">
            *Earn Event Tickets by keeping up your Daily Check-in streak (Claim on Day 7).
          </p>
        </Card>

        <Card className="glass border-white/10 rounded-[2rem] p-6 col-span-1 md:col-span-2 space-y-4">
          <h3 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            How does it work?
          </h3>
          <div className="grid gap-4 text-xs md:text-sm text-white/70 font-medium">
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold font-mono">1</span>
              <p>Complete any offerwall task (CPX, Notik, BitLabs, etc.) to get points.</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold font-mono">2</span>
              <p>Spend <strong>1 Event Ticket</strong> to boost the rewards of that task by <strong>50%</strong>.</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="w-6 h-6 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 font-bold font-mono">3</span>
              <p>The extra points are credited directly to your balance and added to your offerwall leaderboard score.</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Completed Tasks List */}
      <Card className="glass border-white/10 rounded-[2rem] overflow-hidden">
        <div className="px-6 py-5 border-b border-white/5 flex justify-between items-center">
          <h3 className="text-sm font-black uppercase tracking-wider text-white">
            Completed Offerwall Tasks
          </h3>
        </div>
        
        {claimsLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="w-6 h-6 text-purple-500 animate-spin" />
          </div>
        ) : completedClaims.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm font-medium">
            No completed offerwall tasks found. Complete some tasks first!
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {completedClaims.map((claim) => {
              const timeSinceCompletion = Date.now() - new Date(claim.completed_at).getTime()
              const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000
              const timeRemaining = sevenDaysInMs - timeSinceCompletion
              const isExpired = timeRemaining <= 0

              const daysLeft = Math.floor(timeRemaining / (24 * 60 * 60 * 1000))
              const hoursLeft = Math.floor((timeRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
              const timeLabel = daysLeft > 0 ? `${daysLeft}d ${hoursLeft}h left` : `${hoursLeft}h left`

              return (
                <div key={claim.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-6 gap-4 hover:bg-white/[0.02] transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="px-2.5 py-0.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-black uppercase text-purple-400 tracking-wider">
                        {claim.provider}
                      </span>
                      <span className="text-xs font-mono text-white/40">
                        TX: {claim.transaction_id.substring(0, 12)}...
                      </span>
                    </div>
                    <div className="text-sm font-bold text-white flex items-center gap-2">
                      Points Earned: <span className="font-mono text-purple-400 font-black">{claim.points_reward.toLocaleString()} Pts</span>
                    </div>
                    <div className="text-[10px] text-white/40 font-medium flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(claim.completed_at).toLocaleString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end sm:self-center">
                    {claim.is_boosted ? (
                      <div className="flex flex-col items-end">
                        <span className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black text-xs px-3 py-1 rounded-xl">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Boosted (+50%)
                        </span>
                        <span className="text-[10px] font-mono text-emerald-400/80 font-bold mt-1">
                          +{claim.boost_points_added.toLocaleString()} Pts added
                        </span>
                      </div>
                    ) : isExpired ? (
                      <span className="flex items-center gap-1 bg-white/5 border border-white/10 text-white/30 font-black text-xs px-3 py-1 rounded-xl cursor-not-allowed">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Expired
                      </span>
                    ) : (
                      <div className="flex flex-col sm:items-end gap-1.5">
                        <Button
                          size="sm"
                          disabled={eventTickets < 1 || boostingId !== null}
                          onClick={() => onApplyBoost(claim.id)}
                          className="bg-gradient-to-r from-purple-500 to-fuchsia-600 hover:from-purple-600 hover:to-fuchsia-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-purple-500/10"
                        >
                          {boostingId === claim.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              Boost +50%
                            </>
                          )}
                        </Button>
                        <span className="text-[10px] text-amber-400/80 font-bold flex items-center gap-1">
                          <Timer className="w-3 h-3 animate-pulse" />
                          {timeLabel}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
