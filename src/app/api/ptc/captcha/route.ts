import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

const SECRET = process.env.CF_TURNSTILE_SECRET_KEY || "fallback_secret_ptc_arpha"

export async function GET(req: NextRequest) {
  try {
    const supabase = await getServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      )
    }

    const captchaType = Math.random() < 0.5 ? "turnstile" : "hcaptcha"
    const timestamp = Date.now()

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
    return NextResponse.json(
      { success: false, message: error.message || "Terjadi kesalahan." },
      { status: 500 }
    )
  }
}
