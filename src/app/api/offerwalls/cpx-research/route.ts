import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"
import crypto from "crypto"

// Helper to normalize keys
function normalizeKey(key: string): string {
  let clean = key.toLowerCase()
  if (clean.startsWith("amp;")) {
    clean = clean.substring(4)
  }
  return clean
}

// Helper to clean values and discard literal placeholders like {user_id}
function cleanValue(val: string | null | undefined): string | null {
  if (!val) return null
  const trimmed = val.trim()
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return null // Treat literal placeholders as missing
  }
  return trimmed
}

async function handleRequest(req: NextRequest, isPost: boolean) {
  let userId: string | null = null
  let transId: string | null = null
  let amountLocal: string | null = null
  let amountUsd: string | null = null
  let hash: string | null = null

  console.log(`[CPX Research Debug] Incoming ${isPost ? "POST" : "GET"} request:`, req.url)

  // 1. Read query parameters in a case-insensitive, amp-stripped manner
  const queryParams: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((val, key) => {
    queryParams[normalizeKey(key)] = val
  })

  // 2. Read POST body if it is a POST request
  let bodyParams: Record<string, string> = {}
  if (isPost) {
    try {
      const contentType = req.headers.get("content-type") || ""
      console.log("[CPX Research Debug] Content-Type:", contentType)

      if (contentType.includes("application/json")) {
        const body = await req.json()
        Object.keys(body).forEach(k => {
          bodyParams[normalizeKey(k)] = body[k] !== undefined ? String(body[k]) : ""
        })
        console.log("[CPX Research Debug] JSON Body:", JSON.stringify(bodyParams))
      } else if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        const formData = await req.formData()
        formData.forEach((val, key) => {
          bodyParams[normalizeKey(key)] = String(val)
        })
        console.log("[CPX Research Debug] Form Data Body:", JSON.stringify(bodyParams))
      }
    } catch (e: any) {
      console.warn("[CPX Research Debug] Failed to parse POST body:", e.message)
    }
  }

  // 3. Extract parameters with cleanValue (prioritizing bodyParams, then queryParams)
  userId = cleanValue(bodyParams["user_id"] || bodyParams["ext_user_id"] || bodyParams["uid"] || bodyParams["subid"])
  if (!userId) {
    userId = cleanValue(queryParams["user_id"] || queryParams["ext_user_id"] || queryParams["uid"] || queryParams["subid"])
  }

  transId = cleanValue(bodyParams["trans_id"] || bodyParams["transaction_id"] || bodyParams["transid"] || bodyParams["txid"])
  if (!transId) {
    transId = cleanValue(queryParams["trans_id"] || queryParams["transaction_id"] || queryParams["transid"] || queryParams["txid"])
  }

  amountLocal = cleanValue(bodyParams["amount_local"] || bodyParams["points"] || bodyParams["reward"] || bodyParams["amount"])
  if (!amountLocal) {
    amountLocal = cleanValue(queryParams["amount_local"] || queryParams["points"] || queryParams["reward"] || queryParams["amount"])
  }

  amountUsd = cleanValue(bodyParams["amount_usd"] || bodyParams["payout"] || bodyParams["usd"] || bodyParams["payout_usd"])
  if (!amountUsd) {
    amountUsd = cleanValue(queryParams["amount_usd"] || queryParams["payout"] || queryParams["usd"] || queryParams["payout_usd"])
  }

  hash = cleanValue(bodyParams["hash"] || bodyParams["secure_hash"] || bodyParams["signature"] || bodyParams["sig"])
  if (!hash) {
    hash = cleanValue(queryParams["hash"] || queryParams["secure_hash"] || queryParams["signature"] || queryParams["sig"])
  }

  const status = cleanValue(bodyParams["status"] || queryParams["status"])

  // Default USD payout value to 0 if missing
  amountUsd = amountUsd || "0"

  console.log("[CPX Research Debug] Final values for processing:", { userId, transId, amountLocal, amountUsd, hash, status })

  // 4. Verify that the request includes all required parameters
  if (!userId || !transId || !amountLocal || !hash) {
    console.warn("[CPX Research Debug] Blocked: Missing required parameters")
    return new NextResponse("ERROR: Missing required parameters", { status: 400 })
  }

  // 5. Validate the secret key configured on the server
  const secretKey = process.env.CPX_RESEARCH_SECRET_KEY
  if (!secretKey) {
    console.error("[CPX Research Debug] Blocked: CPX_RESEARCH_SECRET_KEY is not configured in .env.local")
    return new NextResponse("ERROR: CPX Research integration is disabled on this server", { status: 500 })
  }

  // 6. Verify CPX Research signature: md5(trans_id + "-" + secretKey)
  const dataToHash = `${transId}-${secretKey}`
  const computedHash = crypto.createHash("md5").update(dataToHash).digest("hex")

  console.log("[CPX Research Debug] Hash verification details:", {
    dataToHash,
    receivedHash: hash,
    computedHash
  })

  if (computedHash !== hash.toLowerCase()) {
    console.warn(`[CPX Research Debug] Blocked: Hash mismatch. Received: ${hash}, Computed: ${computedHash}`)
    return new NextResponse("ERROR: Hash mismatch", { status: 400 })
  }

  // 7. Validate UUID format for userId (user ID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    console.warn(`[CPX Research Debug] Blocked: Invalid UUID format for userId: ${userId}`)
    return new NextResponse("ERROR: Invalid user_id format", { status: 400 })
  }

  // 7b. Check status or type for cancellation (status = "2" or type = "canceled")
  const reqType = req.nextUrl.searchParams.get("type") || ""
  const isCanceled = (status === "2") || (reqType === "canceled")

  if (isCanceled) {
    try {
      const supabase = await getServerSupabase()
      const { data, error: rpcError } = await supabase.rpc("process_offerwall_cancellation", {
        p_user_id: userId,
        p_provider: "cpx-research",
        p_transaction_id: transId,
        p_reward_points: parseInt(amountLocal, 10),
        p_payout_usd: parseFloat(amountUsd)
      })

      if (rpcError) {
        console.error("[CPX Research Debug] process_offerwall_cancellation RPC error:", rpcError)
        return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
      }

      console.log(`[CPX Research Debug] Cancellation Processed: Deducted ${amountLocal} points from user ${userId}. Transaction: ${transId}`)
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    } catch (error: any) {
      console.error("[CPX Research Debug] Cancellation execution crash:", error)
      return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
    }
  }

  // 7c. Ignore other non-completed status (e.g. status !== "1")
  if (status && status !== "1") {
    console.log(`[CPX Research Debug] Ignored status: ${status} for transaction: ${transId}`)
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  }

  try {
    const supabase = await getServerSupabase()

    // 8. Call RPC to safely complete the claim and credit the user
    const { data, error: rpcError } = await supabase.rpc("process_offerwall_completion", {
      p_user_id: userId,
      p_provider: "cpx-research",
      p_transaction_id: transId,
      p_reward_points: parseInt(amountLocal, 10),
      p_payout_usd: parseFloat(amountUsd)
    })

    if (rpcError) {
      console.error("[CPX Research Debug] process_offerwall_completion RPC error:", rpcError)
      return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
    }

    const result = data as { success: boolean; message?: string; new_balance?: number }

    if (!result.success) {
      console.warn("[CPX Research Debug] process_offerwall_completion declined claim:", result.message)
      // Return HTTP 200 "ok" even on duplicate transaction so CPX Research stops retrying
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    }

    console.log(`[CPX Research Debug] Success: Credited ${amountLocal} points to user ${userId}. Transaction: ${transId}`)
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  } catch (error: any) {
    console.error("[CPX Research Debug] Route execution crash:", error)
    return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req, false)
}

export async function POST(req: NextRequest) {
  return handleRequest(req, true)
}
