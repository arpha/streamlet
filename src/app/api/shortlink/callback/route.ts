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

    // Call complete_shortlink_visit RPC
    const callbackIp = req.headers.get("x-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip") || "127.0.0.1"
    const { data, error: rpcError } = await supabase.rpc("complete_shortlink_visit", {
      p_visit_id: visitId,
      p_callback_ip: callbackIp
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
