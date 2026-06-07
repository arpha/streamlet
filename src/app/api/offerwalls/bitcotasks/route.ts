import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

async function handleRequest(req: NextRequest, isPost: boolean) {
  let subId: string | null = null
  let transId: string | null = null
  let reward: string | null = null
  let payout: string | null = null
  let signature: string | null = null

  console.log(`[BitcoTasks Debug] Incoming ${isPost ? "POST" : "GET"} request:`, req.url)

  // Log headers
  const headersObj: Record<string, string> = {}
  req.headers.forEach((val, key) => {
    headersObj[key] = val
  })
  console.log("[BitcoTasks Debug] Headers:", JSON.stringify(headersObj))

  // 1. Try reading parameters from the query string
  const { searchParams } = req.nextUrl
  subId = searchParams.get("subId")
  transId = searchParams.get("transId")
  reward = searchParams.get("reward")
  payout = searchParams.get("payout")
  signature = searchParams.get("signature")

  console.log("[BitcoTasks Debug] Query params extracted:", { subId, transId, reward, payout, signature })

  // 2. If it is a POST request and we are missing parameters, read them from the request body
  if (isPost) {
    try {
      const contentType = req.headers.get("content-type") || ""
      console.log("[BitcoTasks Debug] Content-Type:", contentType)

      if (contentType.includes("application/json")) {
        const body = await req.json()
        console.log("[BitcoTasks Debug] JSON Body:", JSON.stringify(body))
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
        const formObj: Record<string, string> = {}
        formData.forEach((val, key) => {
          formObj[key] = String(val)
        })
        console.log("[BitcoTasks Debug] Form Data Body:", JSON.stringify(formObj))

        subId = subId || formObj.subId
        transId = transId || formObj.transId
        reward = reward || formObj.reward
        payout = payout || formObj.payout
        signature = signature || formObj.signature
      }
    } catch (e: any) {
      console.warn("[BitcoTasks Debug] Failed to parse POST body:", e.message)
    }
  }

  // Set default payout value to 0 if not provided
  payout = payout || "0"

  console.log("[BitcoTasks Debug] Final values for processing:", { subId, transId, reward, payout, signature })

  // 3. Verify that the request includes all required parameters
  if (!subId || !transId || !reward || !signature) {
    console.warn("[BitcoTasks Debug] Blocked: Missing required parameters")
    return new NextResponse("ERROR: Missing required parameters", { status: 400 })
  }

  // 4. Validate the secret key configured on the server
  const secretKey = process.env.BITCOTASKS_SECRET_KEY
  if (!secretKey) {
    console.error("[BitcoTasks Debug] Blocked: BITCOTASKS_SECRET_KEY is not configured in .env.local")
    return new NextResponse("ERROR: BitcoTasks integration is disabled on this server", { status: 500 })
  }

  // 5. Verify the MD5 signature: md5(subId . transId . reward . secretKey)
  const dataToHash = `${subId}${transId}${reward}${secretKey}`
  const computedSignature = crypto.createHash("md5").update(dataToHash).digest("hex")

  console.log("[BitcoTasks Debug] Signature verification details:", {
    dataToHash,
    receivedSignature: signature,
    computedSignature
  })

  if (computedSignature !== signature.toLowerCase()) {
    console.warn(`[BitcoTasks Debug] Blocked: Signature mismatch. Received: ${signature}, Computed: ${computedSignature}`)
    return new NextResponse("ERROR: Signature mismatch", { status: 400 })
  }

  // 6. Validate UUID format for subId (user ID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(subId)) {
    console.warn(`[BitcoTasks Debug] Blocked: Invalid UUID format for subId: ${subId}`)
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
      console.error("[BitcoTasks Debug] process_offerwall_completion RPC error:", rpcError)
      return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
    }

    const result = data as { success: boolean; message?: string; new_balance?: number }

    if (!result.success) {
      console.warn("[BitcoTasks Debug] process_offerwall_completion declined claim:", result.message)
      // Return "ok" even on duplicate transaction so BitcoTasks doesn't keep retrying
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    }

    console.log(`[BitcoTasks Debug] Success: Credited ${reward} points to user ${subId}. Transaction: ${transId}`)
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  } catch (error: any) {
    console.error("[BitcoTasks Debug] Route execution crash:", error)
    return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req, false)
}

export async function POST(req: NextRequest) {
  return handleRequest(req, true)
}
