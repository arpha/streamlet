import { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    // FaucetPay sends IPN callbacks as form data
    const formData = await req.formData()
    const token = formData.get("token") as string
    const custom = formData.get("custom") as string

    if (!token || !custom) {
      return new Response("Missing parameters", { status: 400 })
    }

    const apiKey = process.env.FAUCETPAY_API_KEY
    const isSandbox = process.env.NEXT_PUBLIC_FAUCETPAY_SANDBOX === "true" || !apiKey

    let verified = false
    let verifiedCustom = custom

    if (isSandbox) {
      console.log(`[FAUCETPAY DEPOSIT CALLBACK SANDBOX] Simulating success for token: ${token}`)
      verified = true
    } else {
      // Call FaucetPay Merchant Verification API
      const verifyFormData = new FormData()
      verifyFormData.append("api_key", apiKey!)
      verifyFormData.append("token", token)

      const verifyRes = await fetch("https://faucetpay.io/api/v1/merchant/verify", {
        method: "POST",
        body: verifyFormData,
      })

      if (verifyRes.ok) {
        const verifyData = await verifyRes.json()
        if (verifyData.status === 200) {
          verified = true
          verifiedCustom = verifyData.custom || custom
        } else {
          console.error("FaucetPay merchant verification failed:", verifyData.message)
        }
      } else {
        console.error("FaucetPay merchant verification connection error")
      }
    }

    if (!verified) {
      return new Response("Invalid transaction token", { status: 400 })
    }

    // Parse custom field: "userId:tokens"
    const [userId, tokensStr] = verifiedCustom.split(":")
    const tokensAmount = parseInt(tokensStr)

    if (!userId || isNaN(tokensAmount) || tokensAmount <= 0) {
      return new Response("Invalid custom payload", { status: 400 })
    }

    // Initialize anon client (fine because RPC is SECURITY DEFINER)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Call RPC to atomically credit user's advertiser tokens
    const { data: rpcData, error: rpcError } = await supabase.rpc("deposit_advertiser_tokens", {
      p_user_id: userId,
      p_tokens: tokensAmount,
    })

    if (rpcError) {
      console.error("Failed to run deposit_advertiser_tokens RPC:", rpcError)
      return new Response("Database RPC failed", { status: 500 })
    }

    const result = rpcData as { success: boolean; new_tokens?: number }
    console.log(`Successfully credited ${tokensAmount} tokens to user ${userId}. New total: ${result.new_tokens}`)

    return new Response("*OK*", { status: 200 }) // FaucetPay expects *OK* for successful IPN
  } catch (error: any) {
    console.error("Deposit callback error:", error)
    return new Response("Error processing callback", { status: 500 })
  }
}
