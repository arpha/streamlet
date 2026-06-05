import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

const SECRET = process.env.CF_TURNSTILE_SECRET_KEY || "fallback_secret_faucet_arpha"

export async function POST(req: NextRequest) {
  try {
    const { captchaType, captchaToken, captchaTimestamp, captchaSignature, fingerprint } = await req.json()

    // 1. Verify User Session
    const supabase = await getServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in first." },
        { status: 401 }
      )
    }

    // 2. Validate Captcha Inputs & Signature
    if (!captchaType || !['turnstile', 'hcaptcha'].includes(captchaType)) {
      return NextResponse.json(
        { success: false, message: "Invalid or missing captcha type." },
        { status: 400 }
      )
    }

    if (!captchaToken) {
      return NextResponse.json(
        { success: false, message: "Security verification token is required." },
        { status: 400 }
      )
    }

    if (!captchaTimestamp || !captchaSignature) {
      return NextResponse.json(
        { success: false, message: "Security signature is required." },
        { status: 400 }
      )
    }

    // Verify Timestamp Expiration (15 minutes)
    const now = Date.now()
    const age = now - Number(captchaTimestamp)
    if (age < 0 || age > 15 * 60 * 1000) {
      return NextResponse.json(
        { success: false, message: "Security verification session expired. Please refresh captcha." },
        { status: 400 }
      )
    }

    // Verify HMAC Signature to ensure client didn't select captcha type
    const expectedSignature = crypto
      .createHmac("sha256", SECRET)
      .update(`${user.id}:${captchaType}:${captchaTimestamp}`)
      .digest("hex")

    try {
      const isSignatureValid = crypto.timingSafeEqual(
        Buffer.from(captchaSignature, "hex"),
        Buffer.from(expectedSignature, "hex")
      )
      if (!isSignatureValid) {
        return NextResponse.json(
          { success: false, message: "Security signature verification failed." },
          { status: 400 }
        )
      }
    } catch (err) {
      return NextResponse.json(
        { success: false, message: "Security signature is invalid." },
        { status: 400 }
      )
    }

    // 3. Verify token with provider
    if (captchaType === 'turnstile') {
      const turnstileSecret = process.env.CF_TURNSTILE_SECRET_KEY || "1x00000000000000000000000000000000"
      const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(turnstileSecret)}&response=${encodeURIComponent(captchaToken)}`,
      })

      const turnstileData = await turnstileRes.json()
      if (!turnstileData.success) {
        return NextResponse.json(
          { success: false, message: "Cloudflare Turnstile verification failed. Please try again." },
          { status: 400 }
        )
      }
    } else {
      const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY || "0x0000000000000000000000000000000000000000"
      const hcaptchaRes = await fetch("https://hcaptcha.com/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(hcaptchaSecret)}&response=${encodeURIComponent(captchaToken)}`,
      })

      const hcaptchaData = await hcaptchaRes.json()
      if (!hcaptchaData.success) {
        return NextResponse.json(
          { success: false, message: "hCaptcha verification failed. Please try again." },
          { status: 400 }
        )
      }
    }

    // 5. Call Supabase claim_faucet RPC
    const cooldownMinutes = 30
    const rewardXp = 10
    const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip") || "127.0.0.1"
    const userAgent = req.headers.get("user-agent") || ""

    const { data, error: rpcError } = await supabase.rpc("claim_faucet", {
      u_id: user.id,
      reward_xp_val: rewardXp,
      cooldown_sec: cooldownMinutes * 60,
      p_ip_address: clientIp,
      p_user_agent: userAgent,
      p_device_fingerprint: fingerprint || null
    })

    if (rpcError) {
      return NextResponse.json(
        { success: false, message: rpcError.message || "Failed to process claim in database." },
        { status: 500 }
      )
    }

    const result = data as { success: boolean; message?: string; new_balance?: number; reward_given?: number }

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || "Failed to claim." },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message || `Successfully claimed ${result.reward_given} Points!`,
      new_balance: result.new_balance,
      reward_given: result.reward_given,
    })
  } catch (error: any) {
    console.error("Faucet claim API error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
