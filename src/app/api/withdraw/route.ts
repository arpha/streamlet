import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

// Konversi poin ke USD: 100 poin = $0.0005
const POINTS_TO_USD_RATE = 0.000005 // 1 poin = $0.000005

// CoinGecko API IDs mapping
const COINGECKO_IDS: Record<string, string> = {
  DOGE: "dogecoin",
  POL: "polygon-ecosystem-token",
  BNB: "binancecoin",
}

// FaucetPay currency codes
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
    { next: { revalidate: 60 } } // Cache harga selama 60 detik
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
    console.log(`[FAUCETPAY SANDBOX] Simulating transfer of ${amountSatoshi} satoshis of ${currency} to ${toAddress}`)
    // Simulasi delay jaringan 1.5 detik
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return {
      success: true,
      message: "Sandbox payment simulated successfully.",
      payout_id: Math.floor(Math.random() * 100000000), // Random mock transaction ID
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
    const { amount, coin, address } = await req.json()

    // 1. Verify User Session
    const supabase = await getServerSupabase()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { success: false, message: "Unauthorized. Silakan login terlebih dahulu." },
        { status: 401 }
      )
    }

    // 2. Validate inputs
    const pointsAmount = parseInt(amount)
    if (isNaN(pointsAmount) || pointsAmount < 3000) {
      return NextResponse.json(
        { success: false, message: "Batas penarikan minimal adalah 3000 poin." },
        { status: 400 }
      )
    }

    if (!coin || !["DOGE", "POL", "BNB"].includes(coin)) {
      return NextResponse.json(
        { success: false, message: "Pilih mata uang yang valid: DOGE, POL, atau BNB." },
        { status: 400 }
      )
    }

    if (!address || !address.trim()) {
      return NextResponse.json(
        { success: false, message: "Email FaucetPay wajib diisi." },
        { status: 400 }
      )
    }

    // 3. Call database RPC to validate & deduct balance atomically
    const { data: rpcData, error: rpcError } = await supabase.rpc("request_withdrawal", {
      p_user_id: user.id,
      p_amount: pointsAmount,
      p_coin: coin,
      p_address: address.trim(),
    })

    if (rpcError) {
      return NextResponse.json(
        { success: false, message: rpcError.message || "Gagal memproses penarikan di database." },
        { status: 500 }
      )
    }

    const dbResult = rpcData as {
      success: boolean
      message?: string
      new_balance?: number
      withdrawal_id?: string
    }

    if (!dbResult.success) {
      return NextResponse.json(
        { success: false, message: dbResult.message || "Gagal memproses penarikan." },
        { status: 400 }
      )
    }

    // 4. Convert points to USD
    const usdValue = pointsAmount * POINTS_TO_USD_RATE

    // 5. Get crypto price and calculate satoshi amount
    let cryptoPrice: number
    try {
      cryptoPrice = await getCryptoPrice(coin)
    } catch (err: any) {
      // Refund if we can't get price
      await supabase.rpc("complete_withdrawal", {
        p_withdrawal_id: dbResult.withdrawal_id,
        p_status: "failed",
        p_usd_value: usdValue,
        p_crypto_amount: 0,
        p_tx_hash: null,
        p_error_message: err.message || "Failed to fetch crypto price from CoinGecko"
      })
      return NextResponse.json(
        { success: false, message: "Gagal mengambil harga kripto. Saldo telah dikembalikan." },
        { status: 500 }
      )
    }

    const cryptoAmount = usdValue / cryptoPrice // Jumlah koin
    const satoshiAmount = Math.floor(cryptoAmount * 1e8) // Konversi ke satoshi

    if (satoshiAmount <= 0) {
      await supabase.rpc("complete_withdrawal", {
        p_withdrawal_id: dbResult.withdrawal_id,
        p_status: "failed",
        p_usd_value: usdValue,
        p_crypto_amount: 0,
        p_tx_hash: null,
        p_error_message: "Satoshi amount is 0"
      })
      return NextResponse.json(
        { success: false, message: "Jumlah kripto terlalu kecil untuk dikirim. Saldo telah dikembalikan." },
        { status: 400 }
      )
    }

    // 6. Send payment via FaucetPay API
    const faucetPayCurrency = FAUCETPAY_CURRENCY[coin]
    let paymentResult: Awaited<ReturnType<typeof sendFaucetPayPayment>>

    try {
      paymentResult = await sendFaucetPayPayment(address.trim(), satoshiAmount, faucetPayCurrency)
    } catch (err: any) {
      // Refund on FaucetPay API failure
      await supabase.rpc("complete_withdrawal", {
        p_withdrawal_id: dbResult.withdrawal_id,
        p_status: "failed",
        p_usd_value: usdValue,
        p_crypto_amount: satoshiAmount,
        p_tx_hash: null,
        p_error_message: err.message || "Network/Fetch error on FaucetPay API"
      })
      return NextResponse.json(
        {
          success: false,
          message: `Gagal mengirim pembayaran FaucetPay: ${err.message}. Saldo telah dikembalikan.`,
        },
        { status: 500 }
      )
    }

    if (!paymentResult.success) {
      const errMsg = paymentResult.message || "Unknown FaucetPay error"
      const lower = errMsg.toLowerCase()
      const isInsufficient = lower.includes("insufficient") || lower.includes("funds") || lower.includes("balance") || lower.includes("not enough")

      if (isInsufficient) {
        // Leave status as pending, save the conversion rate & error message, and do NOT refund.
        await supabase.rpc("complete_withdrawal", {
          p_withdrawal_id: dbResult.withdrawal_id,
          p_status: "pending",
          p_usd_value: usdValue,
          p_crypto_amount: satoshiAmount,
          p_tx_hash: null,
          p_error_message: errMsg
        })
        return NextResponse.json({
          success: true,
          message: "Penarikan Anda berstatus PENDING karena saldo faucet kosong, pemrosesan manual maksimal 1 hari kerja.",
          new_balance: dbResult.new_balance,
          isPendingQueue: true
        })
      }

      // Refund on FaucetPay rejection for other reasons (e.g. invalid account)
      await supabase.rpc("complete_withdrawal", {
        p_withdrawal_id: dbResult.withdrawal_id,
        p_status: "failed",
        p_usd_value: usdValue,
        p_crypto_amount: satoshiAmount,
        p_tx_hash: null,
        p_error_message: errMsg
      })
      return NextResponse.json(
        {
          success: false,
          message: `FaucetPay: ${paymentResult.message}. Saldo telah dikembalikan.`,
        },
        { status: 400 }
      )
    }

    // 7. Mark withdrawal as completed
    await supabase.rpc("complete_withdrawal", {
      p_withdrawal_id: dbResult.withdrawal_id,
      p_status: "completed",
      p_usd_value: usdValue,
      p_crypto_amount: satoshiAmount,
      p_tx_hash: paymentResult.payout_id ? String(paymentResult.payout_id) : null,
      p_error_message: null
    })

    return NextResponse.json({
      success: true,
      message: `Berhasil menarik ${pointsAmount} poin ($${usdValue.toFixed(6)}) sebagai ${cryptoAmount.toFixed(8)} ${coin}!`,
      new_balance: dbResult.new_balance,
      usd_value: usdValue,
      crypto_amount: cryptoAmount,
      coin: coin,
    })
  } catch (error: any) {
    console.error("Withdraw API error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Terjadi kesalahan yang tidak terduga." },
      { status: 500 }
    )
  }
}
