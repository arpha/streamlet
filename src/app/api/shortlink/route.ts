import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  try {
    // 1. Verify User Session
    const supabase = await getServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized. Please log in first." }, { status: 401 })
    }

    // Parse provider from body
    let provider = "shrinkme"
    let fingerprint: string | null = null
    try {
      const body = await req.json()
      if (body?.provider && ["shrinkme", "exeio", "fclc", "shrinkearn"].includes(body.provider)) {
        provider = body.provider
      }
      if (body?.fingerprint) {
        fingerprint = body.fingerprint
      }
    } catch (e) {
      // Ignore if no body provided, fallback to shrinkme
    }

    let apiKey = ""
    let reward = 500

    if (provider === "shrinkme") {
      apiKey = process.env.SHRINKME_IO_API_KEY || ""
      if (!apiKey) {
        return NextResponse.json({ error: "ShrinkMe API key not configured on server." }, { status: 500 })
      }
      reward = 100
    } else if (provider === "exeio") {
      apiKey = process.env.EXEIO_API_KEY || ""
      if (!apiKey) {
        return NextResponse.json({ error: "Exe.io API key not configured on server. Please add EXEIO_API_KEY to your environment." }, { status: 500 })
      }
      reward = 100
    } else if (provider === "fclc") {
      apiKey = process.env.FCLC_API_KEY || ""
      if (!apiKey) {
        return NextResponse.json({ error: "FC.LC API key not configured on server. Please add FCLC_API_KEY to your environment." }, { status: 500 })
      }
      reward = 100
    } else if (provider === "shrinkearn") {
      apiKey = process.env.SHRINKEARN_API_KEY || ""
      if (!apiKey) {
        return NextResponse.json({ error: "ShrinkEarn API key not configured on server. Please add SHRINKEARN_API_KEY to your environment." }, { status: 500 })
      }
      reward = 100
    }

    // 2. Call start_shortlink_visit RPC to validate and insert pending claim
    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip") || "127.0.0.1"
    const userAgent = req.headers.get("user-agent") || ""
    const { data, error: rpcError } = await supabase.rpc("start_shortlink_visit", {
      p_user_id: user.id,
      p_provider: provider,
      p_reward: reward,
      p_ip_address: clientIp,
      p_user_agent: userAgent,
      p_device_fingerprint: fingerprint || null
    })

    if (rpcError) {
      console.error("Supabase RPC start_shortlink_visit error:", rpcError)
      return NextResponse.json(
        { error: rpcError.message || "Failed to validate shortlink transaction in database." },
        { status: 500 }
      )
    }

    const result = data as { success: boolean; message?: string; visit_id?: string }

    if (!result.success || !result.visit_id) {
      return NextResponse.json(
        { error: result.message || "Database validation failed." },
        { status: 400 }
      )
    }

    // Callback points to our callback API route
    let origin = req.nextUrl.origin
    if (origin.includes("localhost") || origin.includes("127.0.0.1")) {
      origin = "https://streamlet.fun"
    }
    const callbackUrl = `${origin}/api/shortlink/callback?visit_id=${result.visit_id}`
    let shortenedUrl = ""
    let shrinkResult: any = null

    let apiUrl = ""
    if (provider === "shrinkme") {
      apiUrl = `https://shrinkme.io/api?api=${apiKey}&url=${encodeURIComponent(callbackUrl)}&format=json`
    } else if (provider === "exeio") {
      apiUrl = `https://exe.io/api?api=${apiKey}&url=${encodeURIComponent(callbackUrl)}&format=json`
    } else if (provider === "fclc") {
      apiUrl = `https://fc.lc/api?api=${apiKey}&url=${encodeURIComponent(callbackUrl)}&format=json`
    } else if (provider === "shrinkearn") {
      apiUrl = `https://shrinkearn.com/api?api=${apiKey}&url=${encodeURIComponent(callbackUrl)}&format=json`
    }

    const response = await fetch(apiUrl)
    shrinkResult = await response.json()
    shortenedUrl = shrinkResult.shortenedUrl || shrinkResult.short_url || shrinkResult.url || shrinkResult.short || shrinkResult.shortened;

    if (shortenedUrl && (shrinkResult.success === true || shrinkResult.status === "success" || !shrinkResult.status || shrinkResult.status === "ok")) {
      return NextResponse.json({ shortenedUrl })
    } else {
      console.error(`${provider} API returned error status:`, shrinkResult)
      return NextResponse.json(
        { error: shrinkResult?.message || `Failed to shorten URL using ${provider} API.` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Shortlink visit API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const bitcoApiKey = process.env.NEXT_PUBLIC_BITCOTASKS_API_KEY
    const bitcoBearerToken = process.env.BITCOTASKS_BEARER_TOKEN

    let bitcoShortlinks: any[] = []

    if (bitcoApiKey && bitcoBearerToken) {
      try {
        const forwardedFor = req.headers.get("x-forwarded-for")
        const realIp = req.headers.get("x-real-ip")
        let clientIp = forwardedFor ? forwardedFor.split(",")[0].trim() : (realIp || "127.0.0.1")

        if (clientIp.includes(":") || clientIp === "127.0.0.1" || clientIp === "localhost") {
          clientIp = "103.120.244.1" // A public IP address (Indonesia)
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
            bitcoShortlinks = resData.data.map((item: any) => ({
              id: `bitco_${item.id}`,
              name: item.title || "BitcoTasks Shortlink",
              tag: "Offerwall",
              description: `Powered by BitcoTasks. Complete the shortlink to earn points.`,
              cooldown: "Daily",
              points: Number(item.reward || 0),
              gradient: "from-cyan-500 to-blue-600",
              limit: Number(item.limit || 1),
              completed: Number(item.limit || 1) - Number(item.available || 0),
              cooldownRemaining: 0,
              tagColor: "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20",
              url: item.url,
              provider: "bitcotasks"
            }))
          }
        }
      } catch (err: any) {
        console.error("[BitcoTasks Shortlinks API] Fetch failed:", err.message)
      }
    }

    return NextResponse.json({
      success: true,
      shortlinks: bitcoShortlinks,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "An error occurred." },
      { status: 500 }
    )
  }
}
