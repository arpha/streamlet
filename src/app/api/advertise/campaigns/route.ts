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

    const { data: campaigns, error: dbError } = await supabase
      .from("ptc_campaigns")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (dbError) {
      return NextResponse.json(
        { success: false, message: dbError.message || "Gagal mengambil data kampanye." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      campaigns,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message || "Terjadi kesalahan." },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title, url, duration, totalViews, dailyViewsLimit } = await req.json()

    if (!title || !url || !duration || !totalViews) {
      return NextResponse.json(
        { success: false, message: "Semua kolom wajib diisi." },
        { status: 400 }
      )
    }

    const views = parseInt(totalViews)
    const dur = parseInt(duration)
    const dailyLimit = dailyViewsLimit ? parseInt(dailyViewsLimit) : null

    if (isNaN(views) || views <= 0) {
      return NextResponse.json(
        { success: false, message: "Jumlah tayangan tidak valid." },
        { status: 400 }
      )
    }

    if (dailyLimit !== null && (isNaN(dailyLimit) || dailyLimit <= 0)) {
      return NextResponse.json(
        { success: false, message: "Limit tayangan harian tidak valid." },
        { status: 400 }
      )
    }

    if (dailyLimit !== null && dailyLimit > views) {
      return NextResponse.json(
        { success: false, message: "Limit harian tidak boleh melebihi total tayangan." },
        { status: 400 }
      )
    }

    if (![10, 30, 60, 120].includes(dur)) {
      return NextResponse.json(
        { success: false, message: "Durasi tidak valid." },
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
        { success: false, message: "Unauthorized." },
        { status: 401 }
      )
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc("create_ptc_campaign", {
      p_user_id: user.id,
      p_title: title.trim(),
      p_url: url.trim(),
      p_duration: dur,
      p_total_views: views,
      p_daily_views_limit: dailyLimit,
    })

    if (rpcError) {
      return NextResponse.json(
        { success: false, message: rpcError.message || "Gagal membuat kampanye." },
        { status: 500 }
      )
    }

    const result = rpcData as {
      success: boolean
      message: string
      new_tokens?: number
      campaign_id?: string
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
      new_tokens: result.new_tokens,
      campaign_id: result.campaign_id,
    })
  } catch (error: any) {
    console.error("Create Campaign API error:", error)
    return NextResponse.json(
      { success: false, message: error.message || "Terjadi kesalahan." },
      { status: 500 }
    )
  }
}
