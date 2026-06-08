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

// Helper to clean values and discard literal placeholders
function cleanValue(val: string | null | undefined): string | null {
  if (!val) return null
  const trimmed = val.trim()
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return null
  }
  if (trimmed.startsWith("%") && trimmed.endsWith("%")) {
    return null
  }
  return trimmed
}

// Verify signature supporting HMAC-SHA1 (base64url as per TheoremReach docs)
function verifyTheoremReachSignature(
  url: string,
  secretKey: string,
  receivedSignature: string
): boolean {
  try {
    // 1. Generate variations of the URL to cover encoding discrepancies
    const urlVariations = [
      url,
      url.replace(/%25/g, "%"),
      decodeURIComponent(url)
    ]
    
    // 2. Generate variations to cover www vs non-www host discrepancies
    const hostSwappedVariations: string[] = []
    for (const currentUrl of urlVariations) {
      if (currentUrl.includes("://www.streamlet.fun")) {
        hostSwappedVariations.push(currentUrl.replace("://www.streamlet.fun", "://streamlet.fun"))
      } else if (currentUrl.includes("://streamlet.fun")) {
        hostSwappedVariations.push(currentUrl.replace("://streamlet.fun", "://www.streamlet.fun"))
      }
    }
    urlVariations.push(...hostSwappedVariations)

    // 3. Find the parameter key that has the receivedSignature value
    let sigParamName = "hash" // default fallback
    try {
      const urlObj = new URL(url)
      for (const [key, value] of urlObj.searchParams.entries()) {
        if (value === receivedSignature) {
          sigParamName = key
          break
        }
      }
    } catch(e) {}

    // 4. Test each variation
    for (const currentUrl of urlVariations) {
      // ONLY strip the detected signature parameter (e.g. hash)
      const regex = new RegExp(`[?&]${sigParamName}=[^&]*`, "i")
      let urlWithoutSig = currentUrl.replace(regex, "")
      urlWithoutSig = urlWithoutSig.replace(/\?&/, "?").replace(/\?$/, "")

      // Compute RFC 2104 HMAC-SHA1 Base64url
      const hmacBase64 = crypto
        .createHmac("sha1", secretKey)
        .update(urlWithoutSig)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "")

      if (hmacBase64 === receivedSignature) {
        console.log("[TheoremReach Debug] Signature verified using HMAC-SHA1 Base64url with URL:", urlWithoutSig)
        return true
      }

      // Compute RFC 2104 HMAC-SHA1 Hex fallback
      const hmacHex = crypto
        .createHmac("sha1", secretKey)
        .update(urlWithoutSig)
        .digest("hex")

      if (hmacHex.toLowerCase() === receivedSignature.toLowerCase()) {
        console.log("[TheoremReach Debug] Signature verified using HMAC-SHA1 Hex with URL:", urlWithoutSig)
        return true
      }
    }
  } catch (error: any) {
    console.error("[TheoremReach Debug] Signature verification error:", error)
  }

  return false
}

async function handleRequest(req: NextRequest, isPost: boolean) {
  let userId: string | null = null
  let transId: string | null = null
  let amountLocal: string | null = null
  let amountUsd: string | null = null
  let hash: string | null = null
  let status: string | null = null
  let reversal: string | null = null
  let debug: string | null = null

  console.log(`[TheoremReach Debug] Incoming ${isPost ? "POST" : "GET"} request:`, req.url)

  // 1. Read query parameters case-insensitively
  const queryParams: Record<string, string> = {}
  req.nextUrl.searchParams.forEach((val, key) => {
    queryParams[normalizeKey(key)] = val
  })

  // 2. Read POST body if applicable
  let bodyParams: Record<string, string> = {}
  if (isPost) {
    try {
      const contentType = req.headers.get("content-type") || ""
      if (contentType.includes("application/json")) {
        const body = await req.json()
        Object.keys(body).forEach(k => {
          bodyParams[normalizeKey(k)] = body[k] !== undefined ? String(body[k]) : ""
        })
      } else if (
        contentType.includes("application/x-www-form-urlencoded") ||
        contentType.includes("multipart/form-data")
      ) {
        const formData = await req.formData()
        formData.forEach((val, key) => {
          bodyParams[normalizeKey(key)] = String(val)
        })
      }
    } catch (e: any) {
      console.warn("[TheoremReach Debug] Failed to parse POST body:", e.message)
    }
  }

  // 3. Extract parameters (prioritizing bodyParams, then queryParams)
  userId = cleanValue(bodyParams["user_id"] || bodyParams["ext_user_id"] || bodyParams["uid"] || bodyParams["subid"] || bodyParams["tr_user_id"])
  if (!userId) {
    userId = cleanValue(queryParams["user_id"] || queryParams["ext_user_id"] || queryParams["uid"] || queryParams["subid"] || queryParams["tr_user_id"])
  }

  transId = cleanValue(bodyParams["tx_id"] || bodyParams["trans_id"] || bodyParams["transaction_id"] || bodyParams["transid"] || bodyParams["txid"] || bodyParams["tr_tx_id"])
  if (!transId) {
    transId = cleanValue(queryParams["tx_id"] || queryParams["trans_id"] || queryParams["transaction_id"] || queryParams["transid"] || queryParams["txid"] || queryParams["tr_tx_id"])
  }

  amountLocal = cleanValue(bodyParams["reward"] || bodyParams["amount_local"] || bodyParams["points"] || bodyParams["amount"] || bodyParams["tr_reward"])
  if (!amountLocal) {
    amountLocal = cleanValue(queryParams["reward"] || queryParams["amount_local"] || queryParams["points"] || queryParams["amount"] || queryParams["tr_reward"])
  }

  amountUsd = cleanValue(bodyParams["currency"] || bodyParams["amount_usd"] || bodyParams["payout"] || bodyParams["usd"] || bodyParams["payout_usd"])
  if (!amountUsd) {
    amountUsd = cleanValue(queryParams["currency"] || queryParams["amount_usd"] || queryParams["payout"] || queryParams["usd"] || queryParams["payout_usd"])
  }

  hash = cleanValue(bodyParams["hash"] || bodyParams["signature"] || bodyParams["sig"] || bodyParams["secure_hash"] || bodyParams["enc"])
  if (!hash) {
    hash = cleanValue(queryParams["hash"] || queryParams["signature"] || queryParams["sig"] || queryParams["secure_hash"] || queryParams["enc"])
  }

  status = cleanValue(bodyParams["status"] || queryParams["status"] || bodyParams["tr_status"] || queryParams["tr_status"])
  reversal = cleanValue(bodyParams["reversal"] || queryParams["reversal"])
  debug = cleanValue(bodyParams["debug"] || queryParams["debug"])

  amountUsd = amountUsd || "0"

  console.log("[TheoremReach Debug] Extracted values:", { userId, transId, amountLocal, amountUsd, hash, status, reversal, debug })

  if (!userId || !transId || !amountLocal || !hash) {
    console.warn("[TheoremReach Debug] Blocked: Missing required parameters")
    return new NextResponse("ERROR: Missing required parameters", { status: 400 })
  }

  const secretKey = process.env.THEOREMREACH_SECRET_KEY
  if (!secretKey) {
    console.error("[TheoremReach Debug] Blocked: THEOREMREACH_SECRET_KEY is not configured")
    return new NextResponse("ERROR: TheoremReach integration is disabled on this server", { status: 500 })
  }

  // 5. Verify the signature
  const isSignatureValid = verifyTheoremReachSignature(req.url, secretKey, hash)
  if (!isSignatureValid) {
    console.warn(`[TheoremReach Debug] Blocked: Signature mismatch. Received signature: ${hash}`)
    return new NextResponse("ERROR: Signature mismatch", { status: 400 })
  }

  // 6. Short-circuit if debug = true (TheoremReach test request)
  if (debug === "true" || debug === "1") {
    console.log(`[TheoremReach Debug] Success (DEBUG MODE): Bypassed DB credit for user: ${userId}. Reward: ${amountLocal} Pts. Transaction: ${transId}`)
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  }

  // 7. Validate UUID format for userId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    console.warn(`[TheoremReach Debug] Blocked: Invalid UUID format for userId: ${userId}`)
    return new NextResponse("ERROR: Invalid user_id format", { status: 400 })
  }

  // 8. Check if it's a cancellation/reversal (reversal=true or status=0)
  const isCanceled = (reversal === "true" || reversal === "1" || status === "0")

  if (isCanceled) {
    try {
      const supabase = await getServerSupabase()
      const { error: rpcError } = await supabase.rpc("process_offerwall_cancellation", {
        p_user_id: userId,
        p_provider: "theoremreach",
        p_transaction_id: transId,
        p_reward_points: parseInt(amountLocal, 10),
        p_payout_usd: parseFloat(amountUsd)
      })

      if (rpcError) {
        console.error("[TheoremReach Debug] process_offerwall_cancellation RPC error:", rpcError)
        return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
      }

      console.log(`[TheoremReach Debug] Cancellation Processed: Deducted ${amountLocal} points from user ${userId}. Transaction: ${transId}`)
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    } catch (error: any) {
      console.error("[TheoremReach Debug] Cancellation execution crash:", error)
      return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
    }
  }

  // Default transaction completion logic
  try {
    const supabase = await getServerSupabase()
    const { data, error: rpcError } = await supabase.rpc("process_offerwall_completion", {
      p_user_id: userId,
      p_provider: "theoremreach",
      p_transaction_id: transId,
      p_reward_points: parseInt(amountLocal, 10),
      p_payout_usd: parseFloat(amountUsd)
    })

    if (rpcError) {
      console.error("[TheoremReach Debug] process_offerwall_completion RPC error:", rpcError)
      return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
    }

    const result = data as { success: boolean; message?: string; new_balance?: number }

    if (!result.success) {
      console.warn("[TheoremReach Debug] process_offerwall_completion declined claim:", result.message)
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    }

    console.log(`[TheoremReach Debug] Success: Credited ${amountLocal} points to user ${userId}. Transaction: ${transId}`)
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  } catch (error: any) {
    console.error("[TheoremReach Debug] Route execution crash:", error)
    return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req, false)
}

export async function POST(req: NextRequest) {
  return handleRequest(req, true)
}
