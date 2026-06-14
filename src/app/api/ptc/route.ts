import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      )
    }

    // 1. Fetch local active PTC campaigns
    const { data: localCampaigns, error: dbError } = await supabase.rpc("get_active_ptc_campaigns", {
      p_user_id: user.id,
    })

    if (dbError) {
      return NextResponse.json(
        { success: false, message: dbError.message || "Failed to retrieve local ad list." },
        { status: 500 }
      )
    }

    const campaignsList = [...(localCampaigns || [])]

    // 2. Fetch BitcoTasks PTC campaigns if API key and Bearer token are configured
    const bitcoApiKey = process.env.NEXT_PUBLIC_BITCOTASKS_API_KEY
    const bitcoBearerToken = process.env.BITCOTASKS_BEARER_TOKEN

    console.log("[PTC Debug] apiKey:", bitcoApiKey ? "configured" : "NOT configured", "bearerToken:", bitcoBearerToken ? "configured" : "NOT configured")

    if (bitcoApiKey && bitcoBearerToken) {
      try {
        // Retrieve client IP address
        const forwardedFor = req.headers.get("x-forwarded-for")
        const realIp = req.headers.get("x-real-ip")
        let clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : (realIp || "127.0.0.1")
        
        // Fallback for localhost or IPv6 to a valid public IPv4 address so BitcoTasks works
        if (clientIp.includes(":") || clientIp === "127.0.0.1" || clientIp === "localhost") {
          clientIp = "103.120.244.1" // A public IP address
        }

        const bitcoUrl = `https://bitcotasks.com/api/${bitcoApiKey}/${user.id}/${clientIp}`
        console.log("[PTC Debug] Fetching BitcoTasks URL:", bitcoUrl)
        
        const response = await fetch(bitcoUrl, {
          headers: {
            "Authorization": `Bearer ${bitcoBearerToken}`,
            "User-Agent": req.headers.get("user-agent") || "Mozilla/5.0",
          },
          // Short revalidation cache to prevent rate-limiting on fast page reloads
          next: { revalidate: 15 },
        })

        console.log("[PTC Debug] BitcoTasks API status:", response.status)

        if (response.ok) {
          const resData = await response.json()
          console.log("[PTC Debug] BitcoTasks response:", JSON.stringify(resData))
          if (resData && resData.success && Array.isArray(resData.data)) {
            const parsedBitcoAds = resData.data.map((item: any) => ({
              id: `bitco_${item.id || Math.random().toString(36).substr(2, 9)}`,
              title: item.name || item.title || "BitcoTasks PTC Ad",
              description: item.description || "Visit website to earn reward points.",
              url: item.url || item.click_url,
              reward_per_view: Number(item.reward || item.points || 0),
              duration: Number(item.time || item.duration || 10),
              provider: "bitcotasks",
            }))
            campaignsList.push(...parsedBitcoAds)
          } else {
            console.warn("[BitcoTasks PTC API] Unexpected response format:", resData)
          }
        } else {
          const errText = await response.text()
          console.error(`[BitcoTasks PTC API] Error fetching: ${response.status} - ${errText}`)
        }
      } catch (bitcoErr: any) {
        console.error("[BitcoTasks PTC API] Request failed:", bitcoErr.message)
      }
    } else {
      console.log("[PTC Debug] Skipping BitcoTasks fetch because credentials are missing")
    }

    return NextResponse.json({
      success: true,
      campaigns: campaignsList,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "An error occurred." },
      { status: 500 }
    )
  }
}
