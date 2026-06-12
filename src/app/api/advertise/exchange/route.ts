import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function POST(req: NextRequest) {
  try {
    const { amount } = await req.json()
    const pointsAmount = parseInt(amount)

    if (isNaN(pointsAmount) || pointsAmount <= 0) {
      return NextResponse.json(
        { success: false, message: "Jumlah poin tidak valid." },
        { status: 400 }
      )
    }

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

    const { data: rpcData, error: rpcError } = await supabase.rpc("exchange_points_to_tokens", {
      p_user_id: user.id,
      p_points: pointsAmount,
    })

    if (rpcError) {
      return NextResponse.json(
        { success: false, message: rpcError.message || "Gagal memproses penukaran." },
        { status: 500 }
      )
    }

    const result = rpcData as {
      success: boolean
      message: string
      new_balance?: number
      new_tokens?: number
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: result.message },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      new_balance: result.new_balance,
      new_tokens: result.new_tokens,
    })
  } catch (error: any) {
    console.error("Exchange API error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Terjadi kesalahan yang tidak terduga." },
      { status: 500 }
    )
  }
}
