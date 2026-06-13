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

function getNotikHashVariations(
  params: {
    event_id: string;
    user_id: string;
    amount: string;
    payout: string;
  },
  secretKey: string
) {
  const { event_id, user_id, amount, payout } = params
  const variations: { type: string; rawString: string; hash: string }[] = []

  const addSha256 = (name: string, str: string) => {
    try {
      const hash = crypto.createHash("sha256").update(str).digest("hex")
      variations.push({ type: `sha256(${name})`, rawString: str, hash })
    } catch (e) {}
  }

  const addHmacSha256 = (name: string, str: string) => {
    try {
      const hash = crypto.createHmac("sha256", secretKey).update(str).digest("hex")
      variations.push({ type: `hmac_sha256(${name})`, rawString: str, hash })
    } catch (e) {}
  }

  const addMd5 = (name: string, str: string) => {
    try {
      const hash = crypto.createHash("md5").update(str).digest("hex")
      variations.push({ type: `md5(${name})`, rawString: str, hash })
    } catch (e) {}
  }

  const addHmacSha1 = (name: string, str: string) => {
    try {
      const hash = crypto.createHmac("sha1", secretKey).update(str).digest("hex")
      variations.push({ type: `hmac_sha1(${name})`, rawString: str, hash })
    } catch (e) {}
  }

  const patterns = [
    { name: "event:user:amount:secret", str: `${event_id}:${user_id}:${amount}:${secretKey}` },
    { name: "event:user:payout:secret", str: `${event_id}:${user_id}:${payout}:${secretKey}` },
    { name: "event:user:amount", str: `${event_id}:${user_id}:${amount}` },
    { name: "event:user:payout", str: `${event_id}:${user_id}:${payout}` },
    { name: "event+user+amount+secret", str: `${event_id}${user_id}${amount}${secretKey}` },
    { name: "event+user+payout+secret", str: `${event_id}${user_id}${payout}${secretKey}` },
    { name: "event+user+amount", str: `${event_id}${user_id}${amount}` },
    { name: "event+user+payout", str: `${event_id}${user_id}${payout}` },
    { name: "secret+event+user+amount", str: `${secretKey}${event_id}${user_id}${amount}` },
    { name: "secret+event+user+payout", str: `${secretKey}${event_id}${user_id}${payout}` },
    { name: "user+event+amount+secret", str: `${user_id}${event_id}${amount}${secretKey}` },
    { name: "user+event+payout+secret", str: `${user_id}${event_id}${payout}${secretKey}` },
    { name: "user:event:amount", str: `${user_id}:${event_id}:${amount}` },
    { name: "user+event+amount", str: `${user_id}${event_id}${amount}` },
    { name: "event-secret", str: `${event_id}-${secretKey}` },
    { name: "event+secret", str: `${event_id}${secretKey}` },
  ]

  for (const p of patterns) {
    addSha256(p.name, p.str)
    addHmacSha256(p.name, p.str)
    addMd5(p.name, p.str)
    addHmacSha1(p.name, p.str)
  }

  return variations
}

// Verify Notik.me signature hash (supporting standard combinations of parameters)
function verifyNotikSignature(
  params: {
    event_id: string;
    user_id: string;
    amount: string;
    payout: string;
  },
  secretKey: string,
  receivedHash: string
): boolean {
  try {
    const variations = getNotikHashVariations(params, secretKey)
    for (const v of variations) {
      if (v.hash.toLowerCase() === receivedHash.toLowerCase()) {
        console.log(`[Notik Debug] Hash verified via ${v.type} with raw string: "${v.rawString}"`)
        return true
      }
    }
  } catch (error: any) {
    console.error("[Notik Debug] Signature verification error:", error)
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

  console.log(`[Notik Debug] Incoming ${isPost ? "POST" : "GET"} request:`, req.url)

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
      console.warn("[Notik Debug] Failed to parse POST body:", e.message)
    }
  }

  // Temporary DB logging to inspect parameters sent by Notik
  try {
    const supabase = await getServerSupabase()
    const logData = {
      url: req.url,
      queryParams,
      bodyParams,
      headers: {
        "content-type": req.headers.get("content-type"),
        "user-agent": req.headers.get("user-agent"),
        "x-signature": req.headers.get("x-signature") || req.headers.get("signature") || req.headers.get("hash")
      }
    }
    const { data: firstUser } = await supabase.from("profiles").select("id").limit(1)
    if (firstUser && firstUser.length > 0) {
      await supabase.from("offerwall_claims").insert({
        user_id: firstUser[0].id,
        provider: `NOTIK_DEBUG_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        transaction_id: JSON.stringify(logData),
        points_reward: 0,
        payout_usd: 0,
        status: 'debug'
      })
    }
  } catch (e: any) {
    console.error("[Notik Debug] Failed to log request in DB:", e.message)
  }

  // 3. Extract parameters supporting multiple naming conventions
  userId = cleanValue(bodyParams["user_id"]) ||
           cleanValue(bodyParams["uid"]) ||
           cleanValue(bodyParams["subid"]) ||
           cleanValue(queryParams["user_id"]) ||
           cleanValue(queryParams["uid"]) ||
           cleanValue(queryParams["subid"])

  transId = cleanValue(bodyParams["event_id"]) ||
            cleanValue(bodyParams["txn_id"]) ||
            cleanValue(bodyParams["transaction_id"]) ||
            cleanValue(bodyParams["txid"]) ||
            cleanValue(queryParams["event_id"]) ||
            cleanValue(queryParams["txn_id"]) ||
            cleanValue(queryParams["transaction_id"]) ||
            cleanValue(queryParams["txid"])

  amountLocal = cleanValue(bodyParams["amount"]) ||
                cleanValue(bodyParams["reward"]) ||
                cleanValue(bodyParams["points"]) ||
                cleanValue(queryParams["amount"]) ||
                cleanValue(queryParams["reward"]) ||
                cleanValue(queryParams["points"])

  amountUsd = cleanValue(bodyParams["payout"]) ||
              cleanValue(bodyParams["usd"]) ||
              cleanValue(bodyParams["payout_usd"]) ||
              cleanValue(queryParams["payout"]) ||
              cleanValue(queryParams["usd"]) ||
              cleanValue(queryParams["payout_usd"])

  hash = cleanValue(bodyParams["hash"]) ||
         cleanValue(bodyParams["signature"]) ||
         cleanValue(bodyParams["secure_hash"]) ||
         cleanValue(queryParams["hash"]) ||
         cleanValue(queryParams["signature"]) ||
         cleanValue(queryParams["secure_hash"])

  status = cleanValue(bodyParams["status"]) ||
           cleanValue(queryParams["status"])

  // Default USD payout value to 0 if missing
  amountUsd = amountUsd || "0"

  console.log("[Notik Debug] Extracted values:", { userId, transId, amountLocal, amountUsd, hash, status })

  if (!userId || !transId || !amountLocal || !hash) {
    console.warn("[Notik Debug] Blocked: Missing required parameters")
    return new NextResponse("ERROR: Missing required parameters", { status: 400 })
  }

  const secretKey = process.env.NOTIK_SECRET_KEY
  if (!secretKey) {
    console.error("[Notik Debug] Blocked: NOTIK_SECRET_KEY is not configured")
    return new NextResponse("ERROR: Notik integration is disabled on this server", { status: 500 })
  }

  // 5. Verify signature hash
  const isSignatureValid = verifyNotikSignature(
    { event_id: transId, user_id: userId, amount: amountLocal, payout: amountUsd },
    secretKey,
    hash
  )
  if (!isSignatureValid) {
    const debugInfo = {
      receivedHash: hash,
      secretKeyLength: secretKey.length,
      secretKeyPrefix: secretKey.substring(0, 4) + "...",
      parameters: { event_id: transId, user_id: userId, amount: amountLocal, payout: amountUsd },
      computedHashes: getNotikHashVariations(
        { event_id: transId, user_id: userId, amount: amountLocal, payout: amountUsd },
        secretKey
      ).map(v => ({ type: v.type, hash: v.hash }))
    }
    console.warn(`[Notik Debug] Blocked: Signature mismatch. Received: ${hash}`, debugInfo)
    return new NextResponse(
      JSON.stringify({
        error: "Signature mismatch",
        debug: debugInfo
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    )
  }

  // 6. Validate UUID format for userId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) {
    console.log(`[Notik Debug] Non-UUID user_id "${userId}" detected with valid signature. Treating as a successful test/debug request.`)
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  }

  // Check if this is a cancellation/reversal (status = 2 or negative reward)
  const numericReward = parseInt(amountLocal, 10)
  const isCanceled = (status === "2") || (numericReward < 0)

  if (isCanceled) {
    try {
      const supabase = await getServerSupabase()
      const { error: rpcError } = await supabase.rpc("process_offerwall_cancellation", {
        p_user_id: userId,
        p_provider: "notik",
        p_transaction_id: transId,
        p_reward_points: Math.abs(numericReward),
        p_payout_usd: Math.abs(parseFloat(amountUsd))
      })

      if (rpcError) {
        console.error("[Notik Debug] process_offerwall_cancellation RPC error:", rpcError)
        return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
      }

      console.log(`[Notik Debug] Cancellation Processed: Deducted ${Math.abs(numericReward)} points from user ${userId}. Transaction: ${transId}`)
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    } catch (error: any) {
      console.error("[Notik Debug] Cancellation execution crash:", error)
      return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
    }
  }

  // Standard transaction completion logic
  try {
    const supabase = await getServerSupabase()
    const { data, error: rpcError } = await supabase.rpc("process_offerwall_completion", {
      p_user_id: userId,
      p_provider: "notik",
      p_transaction_id: transId,
      p_reward_points: Math.abs(numericReward),
      p_payout_usd: Math.abs(parseFloat(amountUsd))
    })

    if (rpcError) {
      console.error("[Notik Debug] process_offerwall_completion RPC error:", rpcError)
      return new NextResponse(`ERROR: ${rpcError.message}`, { status: 500 })
    }

    const result = data as { success: boolean; message?: string; new_balance?: number }

    if (!result.success) {
      console.warn("[Notik Debug] process_offerwall_completion declined claim:", result.message)
      return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
    }

    console.log(`[Notik Debug] Success: Credited ${Math.abs(numericReward)} points to user ${userId}. Transaction: ${transId}`)
    return new NextResponse("ok", { headers: { "Content-Type": "text/plain" } })
  } catch (error: any) {
    console.error("[Notik Debug] Route execution crash:", error)
    return new NextResponse(`ERROR: ${error.message || "Internal server error"}`, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  return handleRequest(req, false)
}

export async function POST(req: NextRequest) {
  return handleRequest(req, true)
}
