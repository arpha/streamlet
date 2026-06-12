import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

const POINTS_TO_USD_RATE = 0.000005

const COINGECKO_IDS: Record<string, string> = {
  DOGE: "dogecoin",
  POL: "polygon-ecosystem-token",
  BNB: "binancecoin",
}

const FAUCETPAY_CURRENCY: Record<string, string> = {
  DOGE: "DOGE",
  POL: "POL",
  BNB: "BNB",
}

async function getCryptoPrice(coin: string): Promise<number> {
  const geckoId = COINGECKO_IDS[coin]
  if (!geckoId) throw new Error(`Unsupported coin: ${coin}`)

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${geckoId}&vs_currencies=usd`,
    { next: { revalidate: 0 } } // Do not cache prices during retry for maximum accuracy
  )

  if (!res.ok) {
    throw new Error("Failed to fetch crypto price from CoinGecko")
  }

  const data = await res.json()
  const price = data[geckoId]?.usd

  if (!price || price <= 0) {
    throw new Error(`Could not get price for ${coin}`)
  }

  return price
}

async function sendFaucetPayPayment(
  toAddress: string,
  amountSatoshi: number,
  currency: string
): Promise<{ success: boolean; message: string; payout_id?: number; balance?: number }> {
  const apiKey = process.env.FAUCETPAY_API_KEY
  const isSandbox = process.env.NEXT_PUBLIC_FAUCETPAY_SANDBOX === "true" || !apiKey

  if (isSandbox) {
    console.log(`[FAUCETPAY SANDBOX RETRY] Simulating retry transfer of ${amountSatoshi} satoshis of ${currency} to ${toAddress}`)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return {
      success: true,
      message: "Sandbox payment simulated successfully.",
      payout_id: Math.floor(Math.random() * 100000000),
      balance: 12345678,
    }
  }

  const formData = new FormData()
  formData.append("api_key", apiKey)
  formData.append("amount", String(Math.floor(amountSatoshi)))
  formData.append("to", toAddress)
  formData.append("currency", currency)

  const res = await fetch("https://faucetpay.io/api/v1/send", {
    method: "POST",
    body: formData,
  })

  if (!res.ok) {
    throw new Error(`FaucetPay API returned status ${res.status}`)
  }

  const data = await res.json()
  return {
    success: data.status === 200,
    message: data.message || "Unknown response",
    payout_id: data.payout_id,
    balance: data.balance,
  }
}

export async function POST(req: NextRequest) {
  try {
    const { withdrawalId, action } = await req.json()

    if (!withdrawalId || !["retry", "cancel"].includes(action)) {
      return NextResponse.json(
        { success: false, message: "Invalid parameters." },
        { status: 400 }
      )
    }

    // 1. Verify Session & Admin Role
    const supabase = await getServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized." },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single()

    if (!profile || !profile.is_admin) {
      return NextResponse.json(
        { success: false, message: "Forbidden. Admin authorization required." },
        { status: 403 }
      )
    }

    // 2. Fetch withdrawal details
    const { data: withdrawal, error: withdrawError } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawalId)
      .single()

    if (withdrawError || !withdrawal) {
      return NextResponse.json(
        { success: false, message: "Withdrawal request not found." },
        { status: 404 }
      )
    }

    if (withdrawal.status !== "pending") {
      return NextResponse.json(
        { success: false, message: `Withdrawal is already in ${withdrawal.status} status.` },
        { status: 400 }
      )
    }

    const usdValue = withdrawal.amount * POINTS_TO_USD_RATE

    if (action === "cancel") {
      // Complete as failed: This automatically refunds the user's balance in database
      await supabase.rpc("complete_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_status: "failed",
        p_usd_value: usdValue,
        p_crypto_amount: withdrawal.crypto_amount || 0,
        p_tx_hash: null,
        p_error_message: "Dibatalkan dan dikembalikan oleh Administrator."
      })

      return NextResponse.json({
        success: true,
        message: "Penarikan berhasil dibatalkan dan saldo poin pengguna telah dikembalikan.",
      })
    }

    // action === "retry"
    // Fetch fresh price
    let cryptoPrice: number
    try {
      cryptoPrice = await getCryptoPrice(withdrawal.coin)
    } catch (err: any) {
      return NextResponse.json(
        { success: false, message: `Gagal mengambil harga kripto: ${err.message}` },
        { status: 500 }
      )
    }

    const cryptoAmount = usdValue / cryptoPrice
    const satoshiAmount = Math.floor(cryptoAmount * 1e8)

    if (satoshiAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Jumlah kripto terlalu kecil untuk dikirim." },
        { status: 400 }
      )
    }

    // Send payment via FaucetPay
    const faucetPayCurrency = FAUCETPAY_CURRENCY[withdrawal.coin]
    let paymentResult: Awaited<ReturnType<typeof sendFaucetPayPayment>>

    try {
      paymentResult = await sendFaucetPayPayment(withdrawal.address, satoshiAmount, faucetPayCurrency)
    } catch (err: any) {
      // Save error message, keep status as pending
      await supabase.rpc("complete_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_status: "pending",
        p_usd_value: usdValue,
        p_crypto_amount: satoshiAmount,
        p_tx_hash: null,
        p_error_message: err.message || "Network error during payout retry"
      })
      return NextResponse.json(
        { success: false, message: `Gagal mengirim pembayaran FaucetPay: ${err.message}` },
        { status: 500 }
      )
    }

    if (!paymentResult.success) {
      const errMsg = paymentResult.message || "Unknown FaucetPay error"
      // Save error message, keep status as pending
      await supabase.rpc("complete_withdrawal", {
        p_withdrawal_id: withdrawalId,
        p_status: "pending",
        p_usd_value: usdValue,
        p_crypto_amount: satoshiAmount,
        p_tx_hash: null,
        p_error_message: errMsg
      })
      return NextResponse.json(
        { success: false, message: `FaucetPay: ${errMsg}` },
        { status: 400 }
      )
    }

    // Mark withdrawal as completed
    await supabase.rpc("complete_withdrawal", {
      p_withdrawal_id: withdrawalId,
      p_status: "completed",
      p_usd_value: usdValue,
      p_crypto_amount: satoshiAmount,
      p_tx_hash: paymentResult.payout_id ? String(paymentResult.payout_id) : null,
      p_error_message: null
    })

    return NextResponse.json({
      success: true,
      message: `Penarikan berhasil dikirim via FaucetPay! Payout ID: #${paymentResult.payout_id}`,
    })
  } catch (error: any) {
    console.error("Admin Withdraw Action API error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Terjadi kesalahan internal." },
      { status: 500 }
    )
  }
}
