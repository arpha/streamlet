import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin
  const visitId = req.nextUrl.searchParams.get("visit_id")

  if (!visitId) {
    return NextResponse.redirect(new URL("/shortlinks?status=error&message=Missing visit ID", origin))
  }

  // Regex check to ensure visitId is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(visitId)) {
    return NextResponse.redirect(new URL("/shortlinks?status=error&message=Invalid visit ID format", origin))
  }

  try {
    const supabase = await getServerSupabase()

    // 1. Fetch shortlink claim creation time to verify if it is a scraper or user
    const { data: claim, error: claimError } = await supabase
      .from("shortlink_claims")
      .select("created_at")
      .eq("id", visitId)
      .single()

    if (claimError || !claim) {
      console.error("Failed to fetch shortlink claim:", claimError)
      return NextResponse.redirect(
        new URL(`/shortlinks?status=error&message=${encodeURIComponent("Shortlink claim not found")}`, origin)
      )
    }

    const createdAt = new Date(claim.created_at).getTime()
    const diffSeconds = (Date.now() - createdAt) / 1000

    if (diffSeconds < 8) {
      console.warn(`[Bot Blocked] Scraper callback request for visit ${visitId} arrived in ${diffSeconds}s (threshold 8s). Ignoring db update.`)
      return new NextResponse(
        `<html><head><title>Streamlet Verification</title></head><body>Verification in progress... Please solve the shortlink.</body></html>`,
        { headers: { "Content-Type": "text/html" } }
      )
    }

    const callbackIp = req.headers.get("x-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip") || "127.0.0.1"
    const callbackUserAgent = req.headers.get("user-agent") || ""
    const { data, error: rpcError } = await supabase.rpc("complete_shortlink_visit", {
      p_visit_id: visitId,
      p_callback_ip: callbackIp,
      p_callback_user_agent: callbackUserAgent
    })

    if (rpcError) {
      console.error("complete_shortlink_visit RPC error:", rpcError)
      return NextResponse.redirect(
        new URL(`/shortlinks?status=error&message=${encodeURIComponent(rpcError.message || "Failed to process reward in database")}`, origin)
      )
    }

    const result = data as { success: boolean; message?: string; new_balance?: number; reward_given?: number }

    if (!result.success) {
      return NextResponse.redirect(
        new URL(`/shortlinks?status=error&message=${encodeURIComponent(result.message || "Validation failed")}`, origin)
      )
    }

    // Success! Redirect to shortlinks dashboard with success query parameters
    return NextResponse.redirect(
      new URL(`/shortlinks?status=success&reward=${result.reward_given || 500}`, origin)
    )
  } catch (error: any) {
    console.error("Shortlink callback route error:", error)
    return NextResponse.redirect(
      new URL(`/shortlinks?status=error&message=${encodeURIComponent(error.message || "Internal server error")}`, origin)
    )
  }
}
