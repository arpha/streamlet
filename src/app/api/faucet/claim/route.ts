import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  try {
    const { turnstileToken, hcaptchaToken } = await req.json()

    // 1. Verify User Session
    const supabase = await getServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Please log in first." },
        { status: 401 }
      )
    }

    // 2. Validate Captcha Inputs
    if (!turnstileToken) {
      return NextResponse.json(
        { success: false, message: "Cloudflare Turnstile token is required." },
        { status: 400 }
      )
    }

    if (!hcaptchaToken) {
      return NextResponse.json(
        { success: false, message: "hCaptcha token is required." },
        { status: 400 }
      )
    }

    // 3. Verify Cloudflare Turnstile Token
    const turnstileSecret = process.env.CF_TURNSTILE_SECRET_KEY || "1x00000000000000000000000000000000"
    const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(turnstileSecret)}&response=${encodeURIComponent(turnstileToken)}`,
    })

    const turnstileData = await turnstileRes.json()
    if (!turnstileData.success) {
      return NextResponse.json(
        { success: false, message: "Cloudflare Turnstile verification failed. Please try again." },
        { status: 400 }
      )
    }

    // 4. Verify hCaptcha Token
    const hcaptchaSecret = process.env.HCAPTCHA_SECRET_KEY || "0x0000000000000000000000000000000000000000"
    const hcaptchaRes = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(hcaptchaSecret)}&response=${encodeURIComponent(hcaptchaToken)}`,
    })

    const hcaptchaData = await hcaptchaRes.json()
    if (!hcaptchaData.success) {
      return NextResponse.json(
        { success: false, message: "hCaptcha verification failed. Please try again." },
        { status: 400 }
      )
    }

    // 5. Call Supabase claim_faucet RPC
    const cooldownMinutes = 5
    const rewardXp = 10

    const { data, error: rpcError } = await supabase.rpc("claim_faucet", {
      u_id: user.id,
      reward_xp_val: rewardXp,
      cooldown_sec: cooldownMinutes * 60,
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
