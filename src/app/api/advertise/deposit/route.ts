import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

const TOKEN_TO_USD_RATE = 0.000005 // 1 Token = $0.000005 USD

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json()
    const tokensAmount = parseInt(amount)

    if (isNaN(tokensAmount) || tokensAmount < 1000) {
      return NextResponse.json(
        { success: false, message: "Minimum deposit is 1,000 Tokens." },
        { status: 400 }
      )
    }

    const supabase = await getServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      )
    }

    const merchantUsername = process.env.FAUCETPAY_MERCHANT_USERNAME || "arpha"
    const usdAmount = tokensAmount * TOKEN_TO_USD_RATE
    
    // We get the origin for callback and redirect URLs
    const origin = req.nextUrl.origin

    // FaucetPay Merchant API details
    const payParams = {
      merchant_username: merchantUsername,
      amount: usdAmount.toFixed(6),
      item_name: `Buy ${tokensAmount.toLocaleString()} Advertiser Tokens`,
      custom: `${user.id}:${tokensAmount}`, // store user ID and token amount in custom field
      callback_url: `${origin}/api/advertise/deposit/callback`,
      success_url: `${origin}/advertise?deposit=success`,
      cancel_url: `${origin}/advertise?deposit=cancel`,
    }

    return NextResponse.json({
      success: true,
      action: "https://faucetpay.io/merchant/pay",
      fields: payParams,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "An error occurred." },
      { status: 500 }
    )
  }
}
