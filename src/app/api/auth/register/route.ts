import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { normalizeEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const { email, password, username, referralCode, turnstileToken } = await req.json()
    const normalizedEmail = normalizeEmail(email)

    // 1. Verify Turnstile Token
    if (!turnstileToken) {
      return NextResponse.json(
        { success: false, message: "Security verification token is required." },
        { status: 400 }
      )
    }

    const turnstileSecret = process.env.CF_TURNSTILE_SECRET_KEY || "1x00000000000000000000000000000000"
    const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${encodeURIComponent(turnstileSecret)}&response=${encodeURIComponent(turnstileToken)}`,
    })

    const turnstileData = await turnstileRes.json()
    if (!turnstileData.success) {
      return NextResponse.json(
        { success: false, message: "Security verification failed. Please try again." },
        { status: 400 }
      )
    }

    // 2. Perform SignUp via Supabase Server Client
    const supabase = await getServerSupabase()
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          username,
          referred_by_code: referralCode || undefined,
        },
      },
    })

    if (error) {
      return NextResponse.json(
        { success: false, message: error.message || "Failed to register" },
        { status: 400 }
      )
    }

    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return NextResponse.json(
        { success: false, message: "Email is already registered. Please login or use a different email." },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Registration successful. Please check your email for verification.",
      user: data.user,
    })
  } catch (error: any) {
    console.error("Register API error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
