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

    // 2. Call start_shortlink_visit RPC to validate and insert pending claim
    const { data, error: rpcError } = await supabase.rpc("start_shortlink_visit", {
      p_user_id: user.id,
      p_provider: "shrinkme",
      p_reward: 500 // 500 Points reward
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

    // 3. Shorten the dynamic callback URL using ShrinkMe API
    const apiKey = process.env.SHRINKME_IO_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Shortlink API not configured on server." }, { status: 500 })
    }

    // Callback points to our callback API route
    const callbackUrl = `${req.nextUrl.origin}/api/shortlink/callback?visit_id=${result.visit_id}`
    const apiUrl = `https://shrinkme.io/api?api=${apiKey}&url=${encodeURIComponent(callbackUrl)}&format=json`

    const response = await fetch(apiUrl)
    const shrinkResult = await response.json()

    if (shrinkResult.status === "success" && shrinkResult.shortenedUrl) {
      return NextResponse.json({ shortenedUrl: shrinkResult.shortenedUrl })
    } else {
      console.error("shrinkme.io API returned error status:", shrinkResult)
      return NextResponse.json(
        { error: shrinkResult.message || "Failed to shorten URL using ShrinkMe API." },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error("Shortlink visit API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
