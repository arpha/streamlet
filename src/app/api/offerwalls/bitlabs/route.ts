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

// Verify Bitlabs signature hmac-sha1 hex
function verifyBitlabsSignature(
  fullUrl: string,
  secretKey: string,
  receivedHash: string
): boolean {
  try {
    const urlVariations = [
      fullUrl,
      fullUrl.replace(/%25/g, "%"),
      decodeURIComponent(fullUrl)
    ]

    // Restore percent signs if stripped by gateway/runtime
    const restoredPlaceholderVariations: string[] = []
    for (const currentUrl of urlVariations) {
      let replaced = currentUrl
      replaced = replaced.replace(/uid=USER_ID/g, "uid=%USER_ID%")
      replaced = replaced.replace(/val=REWARD/g, "val=%REWARD%")
      replaced = replaced.replace(/tx=TRANSACTION_ID/g, "tx=%TRANSACTION_ID%")
      replaced = replaced.replace(/type=TYPE/g, "type=%TYPE%")
      replaced = replaced.replace(/hash=HASH/g, "hash=%HASH%")
      
      if (replaced !== currentUrl) {
        restoredPlaceholderVariations.push(replaced)
      }
    }
    urlVariations.push(...restoredPlaceholderVariations)

    // Restore host variations
    const hostSwappedVariations: string[] = []
    for (const currentUrl of urlVariations) {
      if (currentUrl.includes("://www.streamlet.fun")) {
        hostSwappedVariations.push(currentUrl.replace("://www.streamlet.fun", "://streamlet.fun"))
      } else if (currentUrl.includes("://streamlet.fun")) {
        hostSwappedVariations.push(currentUrl.replace("://streamlet.fun", "://www.streamlet.fun"))
      }
    }
    urlVariations.push(...hostSwappedVariations)

    for (const currentUrl of urlVariations) {
      const splitUrl = currentUrl.split("&hash=")
      if (splitUrl.length < 2) continue
      const urlWithoutHash = splitUrl[0]

      const hmacHex = crypto
        .createHmac("sha1", secretKey)
        .update(urlWithoutHash)
        .digest("hex")

      if (hmacHex.toLowerCase() === receivedHash.toLowerCase()) {
        console.log("[BitLabs Debug] Signature verified using URL:", urlWithoutHash)
        return true
      }
    }
  } catch (error: any) {
    console.error("[BitLabs Debug] Signature verification error:", error)
  }
  return false
}

async function handleRequest(req: NextRequest, isPost: boolean) {
  let userId: string | null = null
  let transId: string | null = null
  let amountLocal: string | null = null
  let amountUsd: string | null = null
  let hash: string | null = null
  let type: string | null = null

  console.log(`[BitLabs Debug] Incoming ${isPost ? "POST" : "GET"} request:`, req.url)

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
      console.warn("[BitLabs Debug] Failed to parse POST body:", e.message)
    }
  }

  // 3. Extract parameters case-by-case
  userId = cleanValue(bodyParams["uid"]) ||
           cleanValue(bodyParams["user_id"]) ||
           cleanValue(bodyParams["userid"]) ||
           cleanValue(queryParams["uid"]) ||
           cleanValue(queryParams["user_id"]) ||
           cleanValue(queryParams["userid"])

  transId = cleanValue(bodyParams["tx"]) ||
            cleanValue(bodyParams["tx_id"]) ||
            cleanValue(bodyParams["transid"]) ||
            cleanValue(bodyParams["transaction_id"]) ||
            cleanValue(queryParams["tx"]) ||
            cleanValue(queryParams["tx_id"]) ||
            cleanValue(queryParams["transid"]) ||
            cleanValue(queryParams["transaction_id"])

  amountLocal = cleanValue(bodyParams["val"]) ||
                cleanValue(bodyParams["reward"]) ||
                cleanValue(bodyParams["points"]) ||
                cleanValue(queryParams["val"]) ||
                cleanValue(queryParams["reward"]) ||
                cleanValue(queryParams["points"])

  amountUsd = cleanValue(bodyParams["raw"]) ||
              cleanValue(bodyParams["usd"]) ||
              cleanValue(bodyParams["payout"]) ||
              cleanValue(queryParams["raw"]) ||
              cleanValue(queryParams["usd"]) ||
              cleanValue(queryParams["payout"])

  hash = cleanValue(bodyParams["hash"]) ||
         cleanValue(queryParams["hash"])

  type = cleanValue(bodyParams["type"]) ||
         cleanValue(queryParams["type"])

  amountUsd = amountUsd || "0"

  console.log("[BitLabs Debug] Extracted values:", { userId, transId, amountLocal, amountUsd, hash, type })

  if (!userId || !transId || !amountLocal || !hash) {
    console.warn("[BitLabs Debug] Blocked: Missing required parameters")
    return new NextResponse("ERROR: Missing required parameters", { status: 400 })
  }

  const secretKey = process.env.BITLABS_SECRET_KEY
  if (!secretKey) {
    console.error("[BitLabs Debug] Blocked: BITLABS_SECRET_KEY is not configured")
    return new NextResponse("ERROR: BitLabs integration is disabled on this server", { status: 500 })
  }

  // 5. Verify the signature
  const absoluteUrl = req.nextUrl.toString()
  const isSignatureValid = verifyBitlabsSignature(absoluteUrl, secretKey, hash)
  if (!isSignatureValid) {
    console.warn(`[BitLabs Debug] Blocked: Signature mismatch. Received: ${hash}`)
    return new NextResponse("ERROR: Signature mismatch", { status: 400 })
  }

  // 6. Validate UUID format for userId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    console.warn(`[BitLabs Debug] Blocked: Invalid UUID format for userId: ${userId}`)
    return new NextResponse("ERROR: Invalid user_id format", { status: 400 })
  }

  const numericReward = parseInt(amountLocal, 10)
  const isCanceled = (type?.toUpperCase() === "RECONCILED") || (numericReward < 0)

  if (isCanceled) {
    try {
      const supabase = await getServerSupabase()
      const { error: rpcError } = await supabase.rpc("process_offerwall_cancellation", {
        p_user_id: userId,
        p_provider: "bitlabs",
        p_transaction_id: transId,
        p_reward_points: Math.abs(numericReward),
        p_payout_usd: Math.abs(parseFloat(amountUsd))
      })

      if (rpcError) {
        console.error("[BitLabs Debug] process_offerwall_cancellation RPC error:", rpcError)
        return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
      }

      console.log(`[BitLabs Debug] Cancellation Processed: Deducted ${Math.abs(numericReward)} points from user ${userId}. Transaction: ${transId}`)
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    } catch (error: any) {
      console.error("[BitLabs Debug] Cancellation execution crash:", error)
      return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
    }
  }

  // Default transaction completion logic
  try {
    const supabase = await getServerSupabase()
    const { data, error: rpcError } = await supabase.rpc("process_offerwall_completion", {
      p_user_id: userId,
      p_provider: "bitlabs",
      p_transaction_id: transId,
      p_reward_points: Math.abs(numericReward),
      p_payout_usd: Math.abs(parseFloat(amountUsd))
    })

    if (rpcError) {
      console.error("[BitLabs Debug] process_offerwall_completion RPC error:", rpcError)
      return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
    }

    const result = data as { success: boolean; message?: string; new_balance?: number }

    if (!result.success) {
      console.warn("[BitLabs Debug] process_offerwall_completion declined claim:", result.message)
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    }

    console.log(`[BitLabs Debug] Success: Credited ${Math.abs(numericReward)} points to user ${userId}. Transaction: ${transId}`)
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  } catch (error: any) {
    console.error("[BitLabs Debug] Route execution crash:", error)
    return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req, false)
}

export async function POST(req: NextRequest) {
  return handleRequest(req, true)
}
