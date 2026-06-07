import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const subId = searchParams.get("subId")
  const transId = searchParams.get("transId")
  const reward = searchParams.get("reward")
  const payout = searchParams.get("payout") || "0"
  const signature = searchParams.get("signature")

  // 1. Verify that the request includes all required parameters
  if (!subId || !transId || !reward || !signature) {
    return new NextResponse("ERROR: Missing required parameters", { status: 400 })
  }

  // 2. Validate the secret key configured on the server
  const secretKey = process.env.BITCOTASKS_SECRET_KEY
  if (!secretKey) {
    console.error("BitcoTasks secret key not configured on server.")
    return new NextResponse("ERROR: BitcoTasks integration is disabled on this server", { status: 500 })
  }

  // 3. Verify the MD5 signature: md5(subId . transId . reward . secretKey)
  const dataToHash = `${subId}${transId}${reward}${secretKey}`
  const computedSignature = crypto.createHash("md5").update(dataToHash).digest("hex")

  if (computedSignature !== signature.toLowerCase()) {
    console.warn(`[BitcoTasks Postback Blocked] Signature mismatch. Received: ${signature}, Computed: ${computedSignature}`)
    return new NextResponse("ERROR: Signature mismatch", { status: 400 })
  }

  // 4. Validate UUID format for subId (user ID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(subId)) {
    return new NextResponse("ERROR: Invalid subId format", { status: 400 })
  }

  try {
    const supabase = await getServerSupabase()

    // 5. Call RPC to safely complete the claim and credit the user
    const { data, error: rpcError } = await supabase.rpc("process_offerwall_completion", {
      p_user_id: subId,
      p_provider: "bitcotasks",
      p_transaction_id: transId,
      p_reward_points: parseInt(reward, 10),
      p_payout_usd: parseFloat(payout)
    })

    if (rpcError) {
      console.error("BitcoTasks process_offerwall_completion RPC error:", rpcError)
      return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
    }

    const result = data as { success: boolean; message?: string; new_balance?: number }

    if (!result.success) {
      console.warn("BitcoTasks process_offerwall_completion failed:", result.message)
      // Return "ok" even on duplicate transaction so BitcoTasks doesn't keep retrying
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    }

    console.log(`[BitcoTasks Postback Success] Credited ${reward} points to user ${subId}. Transaction: ${transId}`)
    
    // BitcoTasks strictly requires "ok" in lowercase without any other text or HTML tags
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  } catch (error: any) {
    console.error("BitcoTasks postback route error:", error)
    return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
  }
}
