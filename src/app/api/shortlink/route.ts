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
      if (body?.provider && ["shrinkme", "exeio", "fclc"].includes(body.provider)) {
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
      reward = 250
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
    let apiUrl = ""
    if (provider === "shrinkme") {
      apiUrl = `https://shrinkme.io/api?api=${apiKey}&url=${encodeURIComponent(callbackUrl)}&format=json`
    } else if (provider === "exeio") {
      apiUrl = `https://exe.io/api?api=${apiKey}&url=${encodeURIComponent(callbackUrl)}&format=json`
    } else if (provider === "fclc") {
      apiUrl = `https://fc.lc/api?api=${apiKey}&url=${encodeURIComponent(callbackUrl)}&format=json`
    }

    const response = await fetch(apiUrl)
    const shrinkResult = await response.json()

    if (shrinkResult.status === "success" && shrinkResult.shortenedUrl) {
      return NextResponse.json({ shortenedUrl: shrinkResult.shortenedUrl })
    } else {
      console.error(`${provider} API returned error status:`, shrinkResult)
      return NextResponse.json(
        { error: shrinkResult.message || `Failed to shorten URL using ${provider} API.` },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Shortlink visit API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
