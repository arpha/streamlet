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

    const rand = Math.random()
    let captchaType: "turnstile" | "hcaptcha" | "streamlet"
    if (rand < 0.33) {
      captchaType = "turnstile"
    } else if (rand < 0.66) {
      captchaType = "hcaptcha"
    } else {
      captchaType = "streamlet"
    }

    const timestamp = Date.now()

    if (captchaType === "streamlet") {
      // Pick a random target icon
      const targetIndex = Math.floor(Math.random() * CAPTCHA_ICONS.length)
      const target = CAPTCHA_ICONS[targetIndex]

      // Shuffle options
      const options = [...CAPTCHA_ICONS].sort(() => Math.random() - 0.5)

      // Signature includes target name so we verify it later
      const signature = crypto
        .createHmac("sha256", SECRET)
        .update(`${user.id}:streamlet:${timestamp}:${target.name}`)
        .digest("hex")

      return NextResponse.json({
        success: true,
        captchaType,
        timestamp,
        signature,
        challenge: {
          prompt: target.label,
          options: options.map(o => o.name),
        }
      })
    } else {
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
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "An error occurred." },
      { status: 500 }
    )
  }
}
