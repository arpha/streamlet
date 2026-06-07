import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const userId = searchParams.get("userId")
  const transactionId = searchParams.get("transactionId")
  const rewardValue = searchParams.get("rewardValue")
  const payout = searchParams.get("payout")
  const status = searchParams.get("status") // 1 = credited/valid, 2 = chargeback
  const secretKey = searchParams.get("secretKey")

  // 1. Verify that the request includes all required parameters
  if (!userId || !transactionId || !rewardValue || !status || !secretKey) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
  }

  // 2. Validate the secret key to ensure the request is from Monlix
  const configuredSecret = process.env.MONLIX_SECRET_KEY
  if (!configuredSecret) {
    console.error("Monlix secret key not configured on server.")
    return NextResponse.json({ error: "Monlix integration is disabled on this server" }, { status: 500 })
  }

  if (secretKey !== configuredSecret) {
    console.warn(`[Monlix Postback Blocked] Invalid secret key: ${secretKey}`)
    return NextResponse.json({ error: "Unauthorized secret key" }, { status: 401 })
  }

  // 3. Check status (only process credits for status '1')
  if (status !== "1") {
    // If status is 2 (chargeback), we just return 200 to acknowledge but don't credit.
    // In the future, this can be expanded to deduct balance if needed.
    return NextResponse.json({ status: "ignored", message: "Only completed offers (status 1) are credited" })
  }

  // 4. Validate UUID format for userId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    return NextResponse.json({ error: "Invalid userId format" }, { status: 400 })
  }

  try {
    const supabase = await getServerSupabase()

    // 5. Call RPC to safely complete the offerwall claim and credit user
    const { data, error: rpcError } = await supabase.rpc("process_offerwall_completion", {
      p_user_id: userId,
      p_provider: "monlix",
      p_transaction_id: transactionId,
      p_reward_points: parseInt(rewardValue, 10),
      p_payout_usd: parseFloat(payout || "0")
    })

    if (rpcError) {
      console.error("process_offerwall_completion RPC error:", rpcError)
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    const result = data as { success: boolean; message?: string; new_balance?: number }

    if (!result.success) {
      console.warn("process_offerwall_completion failed:", result.message)
      // Return 200 even on duplicate transactions so Monlix doesn't keep retrying
      return NextResponse.json({ status: "ignored", message: result.message })
    }

    console.log(`[Monlix Postback Success] Credited ${rewardValue} points to user ${userId}. Transaction: ${transactionId}`)
    return NextResponse.json({ status: "success", new_balance: result.new_balance })
  } catch (error: any) {
    console.error("Monlix postback route error:", error)
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 })
  }
}
