import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ success: false, localCount: 0, bitcoCount: 0, totalAvailable: 0 }, { status: 401 })
    }

    // 1. Fetch local shortlink stats
    const { data: stats, error: statsError } = await supabase.rpc("get_user_shortlink_stats", {
      p_user_id: user.id
    })

    let localAvailable = 0
    if (!statsError && stats) {
      const providers = [
        { completed: stats.completed_shrinkme || 0, cooldown: stats.cooldown_shrinkme || 0, limit: 2 },
        { completed: stats.completed_exeio || 0, cooldown: stats.cooldown_exeio || 0, limit: 2 },
        { completed: stats.completed_fclc || 0, cooldown: stats.cooldown_fclc || 0, limit: 2 },
        { completed: stats.completed_shrinkearn || 0, cooldown: stats.cooldown_shrinkearn || 0, limit: 2 },
      ]
      
      for (const p of providers) {
        if (p.completed < p.limit && p.cooldown === 0) {
          localAvailable += (p.limit - p.completed)
        }
      }
    }

    // 2. Fetch BitcoTasks shortlinks count
    const bitcoApiKey = process.env.NEXT_PUBLIC_BITCOTASKS_API_KEY
    const bitcoBearerToken = process.env.BITCOTASKS_BEARER_TOKEN
    let bitcoAvailable = 0

    if (bitcoApiKey && bitcoBearerToken) {
      try {
        const forwardedFor = req.headers.get("x-forwarded-for")
        const realIp = req.headers.get("x-real-ip")
        let clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : (realIp || "127.0.0.1")

        if (clientIp.includes(":") || clientIp === "127.0.0.1" || clientIp === "localhost") {
          clientIp = "103.120.244.1"
        }

        const bitcoUrl = `https://bitcotasks.com/sl-api/${bitcoApiKey}/${user.id}/${clientIp}`

        const response = await fetch(bitcoUrl, {
          headers: {
            "Authorization": `Bearer ${bitcoBearerToken}`,
            "User-Agent": req.headers.get("user-agent") || "Mozilla/5.0",
          },
          next: { revalidate: 15 },
        })

        if (response.ok) {
          const resData = await response.json()
          if (resData && (resData.status === "200" || resData.message === "success") && Array.isArray(resData.data)) {
            for (const item of resData.data) {
              const available = Number(item.available || 0)
              if (available > 0) {
                bitcoAvailable += available
              }
            }
          }
        }
      } catch (err: any) {
        console.error("[BitcoTasks Shortlinks check failed]:", err.message)
      }
    }

    return NextResponse.json({
      success: true,
      localCount: localAvailable,
      bitcoCount: bitcoAvailable,
      totalAvailable: localAvailable + bitcoAvailable
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, localCount: 0, bitcoCount: 0, totalAvailable: 0 }, { status: 500 })
  }
}
