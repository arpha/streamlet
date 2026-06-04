import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

const SECRET = process.env.CF_TURNSTILE_SECRET_KEY || "fallback_secret_faucet_arpha"

export async function GET(req: NextRequest) {
  try {
    // 1. Verify User Session
    const supabase = await getServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in first." },
        { status: 401 }
      )
    }

    // 2. Randomly select captcha type
    const captchaType = Math.random() < 0.5 ? "turnstile" : "hcaptcha"
    const timestamp = Date.now()

    // 3. Generate HMAC signature to prevent tampering
    const signature = crypto
      .createHmac("sha256", SECRET)
      .update(`${user.id}:${captchaType}:${timestamp}`)
      .digest("hex")

    return NextResponse.json({
      success: true,
      captchaType,
      timestamp,
      signature,
    })
  } catch (error: any) {
    console.error("Faucet captcha assignment error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
