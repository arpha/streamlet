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
    const urlVariations = [
      url,
      url.replace(/%25/g, "%"),
      decodeURIComponent(url)
    ]

    // Restore percent signs if stripped by gateway/runtime
    const restoredPlaceholderVariations: string[] = []
    for (const currentUrl of urlVariations) {
      let replaced = currentUrl
      replaced = replaced.replace(/user_id=USER_ID/g, "user_id=%USER_ID%")
      replaced = replaced.replace(/reward=REWARD/g, "reward=%REWARD%")
      replaced = replaced.replace(/tx_id=TRANSACTION_ID/g, "tx_id=%TRANSACTION_ID%")
      replaced = replaced.replace(/status=STATUS/g, "status=%STATUS%")
      replaced = replaced.replace(/signature=SIGNATURE/g, "signature=%SIGNATURE%")
      
      if (replaced !== currentUrl) {
        restoredPlaceholderVariations.push(replaced)
      }
    }
    urlVariations.push(...restoredPlaceholderVariations)
    
    const hostSwappedVariations: string[] = []
    for (const currentUrl of urlVariations) {
      if (currentUrl.includes("://www.streamlet.fun")) {
        hostSwappedVariations.push(currentUrl.replace("://www.streamlet.fun", "://streamlet.fun"))
      } else if (currentUrl.includes("://streamlet.fun")) {
        hostSwappedVariations.push(currentUrl.replace("://streamlet.fun", "://www.streamlet.fun"))
      }
    }
    urlVariations.push(...hostSwappedVariations)

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

    for (const currentUrl of urlVariations) {
      const regex = new RegExp(`[?&]${sigParamName}=[^&]*`, "i")
      let urlWithoutSig = currentUrl.replace(regex, "")
      urlWithoutSig = urlWithoutSig.replace(/\?&/, "?").replace(/\?$/, "")

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

  // 3. Extract parameters case-by-case (properly handling fallbacks by cleaning first)
  userId = cleanValue(bodyParams["user_id"]) ||
           cleanValue(bodyParams["ext_user_id"]) ||
           cleanValue(bodyParams["uid"]) ||
           cleanValue(bodyParams["subid"]) ||
           cleanValue(bodyParams["tr_user_id"]) ||
           cleanValue(queryParams["user_id"]) ||
           cleanValue(queryParams["ext_user_id"]) ||
           cleanValue(queryParams["uid"]) ||
           cleanValue(queryParams["subid"]) ||
           cleanValue(queryParams["tr_user_id"])

  transId = cleanValue(bodyParams["tx_id"]) ||
            cleanValue(bodyParams["trans_id"]) ||
            cleanValue(bodyParams["transaction_id"]) ||
            cleanValue(bodyParams["transid"]) ||
            cleanValue(bodyParams["txid"]) ||
            cleanValue(bodyParams["tr_tx_id"]) ||
            cleanValue(queryParams["tx_id"]) ||
            cleanValue(queryParams["trans_id"]) ||
            cleanValue(queryParams["transaction_id"]) ||
            cleanValue(queryParams["transid"]) ||
            cleanValue(queryParams["txid"]) ||
            cleanValue(queryParams["tr_tx_id"])

  amountLocal = cleanValue(bodyParams["reward"]) ||
                cleanValue(bodyParams["amount_local"]) ||
                cleanValue(bodyParams["points"]) ||
                cleanValue(bodyParams["amount"]) ||
                cleanValue(bodyParams["tr_reward"]) ||
                cleanValue(queryParams["reward"]) ||
                cleanValue(queryParams["amount_local"]) ||
                cleanValue(queryParams["points"]) ||
                cleanValue(queryParams["amount"]) ||
                cleanValue(queryParams["tr_reward"])

  amountUsd = cleanValue(bodyParams["currency"]) ||
              cleanValue(bodyParams["amount_usd"]) ||
              cleanValue(bodyParams["payout"]) ||
              cleanValue(bodyParams["usd"]) ||
              cleanValue(bodyParams["payout_usd"]) ||
              cleanValue(queryParams["currency"]) ||
              cleanValue(queryParams["amount_usd"]) ||
              cleanValue(queryParams["payout"]) ||
              cleanValue(queryParams["usd"]) ||
              cleanValue(queryParams["payout_usd"])

  hash = cleanValue(bodyParams["hash"]) ||
         cleanValue(bodyParams["signature"]) ||
         cleanValue(bodyParams["sig"]) ||
         cleanValue(bodyParams["secure_hash"]) ||
         cleanValue(bodyParams["enc"]) ||
         cleanValue(queryParams["hash"]) ||
         cleanValue(queryParams["signature"]) ||
         cleanValue(queryParams["sig"]) ||
         cleanValue(queryParams["secure_hash"]) ||
         cleanValue(queryParams["enc"])

  status = cleanValue(bodyParams["status"]) ||
           cleanValue(queryParams["status"]) ||
           cleanValue(bodyParams["tr_status"]) ||
           cleanValue(queryParams["tr_status"])

  reversal = cleanValue(bodyParams["reversal"]) ||
             cleanValue(queryParams["reversal"])

  debug = cleanValue(bodyParams["debug"]) ||
          cleanValue(queryParams["debug"])

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

  // 5. Verify the signature (using req.nextUrl.toString() to ensure absolute URL)
  const absoluteUrl = req.nextUrl.toString()
  const isSignatureValid = verifyTheoremReachSignature(absoluteUrl, secretKey, hash)
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
