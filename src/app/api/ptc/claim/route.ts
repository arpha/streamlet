import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

const SECRET = process.env.CF_TURNSTILE_SECRET_KEY || "fallback_secret_ptc_arpha"

export async function POST(req: NextRequest) {
  try {
    const { campaignId, captchaType, captchaToken, captchaTimestamp, captchaSignature } = await req.json()

    if (!campaignId) {
      return NextResponse.json(
        { success: false, message: "Campaign ID is required." },
        { status: 400 }
      )
    }

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
    if (!captchaType || !['turnstile', 'hcaptcha', 'streamlet'].includes(captchaType)) {
      return NextResponse.json(
        { success: false, message: "Invalid security verification type." },
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
        { success: false, message: "Security verification session expired. Please refresh." },
        { status: 400 }
      )
    }

    // Verify HMAC Signature
    const expectedSignature = captchaType === "streamlet"
      ? crypto
          .createHmac("sha256", SECRET)
          .update(`${user.id}:streamlet:${captchaTimestamp}:${captchaToken}`)
          .digest("hex")
      : crypto
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
          { success: false, message: "Security signature verification failed. Make sure you clicked the correct icon." },
          { status: 400 }
        )
      }
    } catch (err) {
      return NextResponse.json(
        { success: false, message: "Invalid security signature." },
        { status: 400 }
      )
    }

    // 3. Verify token with provider
    if (captchaType === 'turnstile') {
      const turnstileSecret = process.env.CF_TURNSTILE_SECRET_KEY || "1x00000000000000000000AA"
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
    } else if (captchaType === 'hcaptcha') {
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

    // 4. Call database RPC
    const { data: rpcData, error: rpcError } = await supabase.rpc("claim_ptc_view", {
      p_user_id: user.id,
      p_campaign_id: campaignId,
    })

    if (rpcError) {
      return NextResponse.json(
        { success: false, message: rpcError.message || "Failed to process ad claim." },
        { status: 500 }
      )
    }

    const result = rpcData as { success: boolean; message?: string; new_balance?: number; new_xp?: number }

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message || "Failed to claim ad reward." },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      new_balance: result.new_balance,
      new_xp: result.new_xp,
    })
  } catch (error: any) {
    console.error("PTC claim error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "An error occurred." },
      { status: 500 }
    )
  }
}
