import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

async function handleRequest(req: NextRequest, isPost: boolean) {
  let subId: string | null = null
  let transId: string | null = null
  let reward: string | null = null
  let payout: string | null = null
  let signature: string | null = null

  // 1. First, try reading parameters from the query string (GET/POST query params)
  const { searchParams } = req.nextUrl
  subId = searchParams.get("subId")
  transId = searchParams.get("transId")
  reward = searchParams.get("reward")
  payout = searchParams.get("payout")
  signature = searchParams.get("signature")

  // 2. If it is a POST request and we are missing parameters, read them from the request body
  if (isPost && (!subId || !transId || !reward || !signature)) {
    try {
      const contentType = req.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const body = await req.json()
        subId = subId || body.subId
        transId = transId || body.transId
        reward = reward || (body.reward !== undefined ? String(body.reward) : null)
        payout = payout || (body.payout !== undefined ? String(body.payout) : null)
        signature = signature || body.signature
      } else if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        const formData = await req.formData()
        subId = subId || (formData.get("subId") as string)
        transId = transId || (formData.get("transId") as string)
        reward = reward || (formData.get("reward") as string)
        payout = payout || (formData.get("payout") as string)
        signature = signature || (formData.get("signature") as string)
      }
    } catch (e) {
      console.warn("Failed to parse POST body in BitcoTasks postback:", e)
    }
  }

  // Set default payout value to 0 if not provided
  payout = payout || "0"

  // 3. Verify that the request includes all required parameters
  if (!subId || !transId || !reward || !signature) {
    return new NextResponse("ERROR: Missing required parameters", { status: 400 })
  }

  // 4. Validate the secret key configured on the server
  const secretKey = process.env.BITCOTASKS_SECRET_KEY
  if (!secretKey) {
    console.error("BitcoTasks secret key not configured on server.")
    return new NextResponse("ERROR: BitcoTasks integration is disabled on this server", { status: 500 })
  }

  // 5. Verify the MD5 signature: md5(subId . transId . reward . secretKey)
  const dataToHash = `${subId}${transId}${reward}${secretKey}`
  const computedSignature = crypto.createHash("md5").update(dataToHash).digest("hex")

  if (computedSignature !== signature.toLowerCase()) {
    console.warn(`[BitcoTasks Postback Blocked] Signature mismatch. Received: ${signature}, Computed: ${computedSignature}`)
    return new NextResponse("ERROR: Signature mismatch", { status: 400 })
  }

  // 6. Validate UUID format for subId (user ID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(subId)) {
    return new NextResponse("ERROR: Invalid subId format", { status: 400 })
  }

  try {
    const supabase = await getServerSupabase()

    // 7. Call RPC to safely complete the claim and credit the user
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

export async function GET(req: NextRequest) {
  return handleRequest(req, false)
}

export async function POST(req: NextRequest) {
  return handleRequest(req, true)
}
