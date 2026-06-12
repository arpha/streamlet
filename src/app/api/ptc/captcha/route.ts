import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

const SECRET = process.env.CF_TURNSTILE_SECRET_KEY || "fallback_secret_ptc_arpha"

const CAPTCHA_ICONS = [
  { name: "star", label: "Star" },
  { name: "heart", label: "Heart" },
  { name: "smile", label: "Smile" },
  { name: "bell", label: "Bell" },
  { name: "flag", label: "Flag" },
  { name: "shield", label: "Shield" },
]

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

    // 1. Alternate external captcha type (50/50 turnstile vs hcaptcha)
    const externalCaptchaType = Math.random() < 0.5 ? "turnstile" : "hcaptcha"
    const timestamp = Date.now()

    // Sign external captcha type
    const externalSignature = crypto
      .createHmac("sha256", SECRET)
      .update(`${user.id}:${externalCaptchaType}:${timestamp}`)
      .digest("hex")

    // 2. Generate Streamlet custom captcha challenge
    const targetIndex = Math.floor(Math.random() * CAPTCHA_ICONS.length)
    const target = CAPTCHA_ICONS[targetIndex]
    const options = [...CAPTCHA_ICONS].sort(() => Math.random() - 0.5)

    // Sign custom captcha target
    const streamletSignature = crypto
      .createHmac("sha256", SECRET)
      .update(`${user.id}:streamlet:${timestamp}:${target.name}`)
      .digest("hex")

    return NextResponse.json({
      success: true,
      externalCaptchaType,
      externalSignature,
      streamletSignature,
      timestamp,
      streamletChallenge: {
        prompt: target.label,
        options: options.map(o => o.name),
      }
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "An error occurred." },
      { status: 500 }
    )
  }
}
