import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import { normalizeEmail } from "@/lib/email"

export async function POST(req: NextRequest) {
  try {
    const { email, password, turnstileToken } = await req.json()
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

    // 2. Perform SignIn via Supabase Server Client
    const supabase = await getServerSupabase()
    let loginRes = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    })

    // Fallback to original email if normalized email login fails
    // and it is different from the normalized email.
    if (loginRes.error && normalizedEmail !== email.trim().toLowerCase()) {
      loginRes = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })
    }

    if (loginRes.error) {
      return NextResponse.json(
        { success: false, message: loginRes.error.message || "Invalid email or password" },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Login successful",
      user: loginRes.data.user,
    })
  } catch (error: any) {
    console.error("Login API error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "An unexpected error occurred." },
      { status: 500 }
    )
  }
}
