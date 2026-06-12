import { NextRequest, NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function GET(req: NextRequest) {
  try {
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

    const { data: campaigns, error: dbError } = await supabase.rpc("get_active_ptc_campaigns", {
      p_user_id: user.id,
    })

    if (dbError) {
      return NextResponse.json(
        { success: false, message: dbError.message || "Gagal mengambil daftar iklan." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaigns: campaigns || [],
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Terjadi kesalahan." },
      { status: 500 }
    )
  }
}
