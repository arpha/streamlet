import { NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

export async function GET() {
  try {
    const supabase = await getServerSupabase()

    let total_users = 0
    let total_earned = 0

    // Coba memanggil fungsi RPC get_public_stats
    const { data, error } = await supabase.rpc("get_public_stats")

    if (error) {
      console.warn("RPC get_public_stats failed, using fallback queries:", error.message)
      
      // Fallback 1: Hitung total user dari profiles
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      total_users = count || 0

      // Fallback 2: Hitung total earned dengan menjumlahkan faucet_claims
      const { data: claimsSum } = await supabase.from('faucet_claims').select('amount')
      if (claimsSum) {
        total_earned = claimsSum.reduce((sum, item) => sum + (item.amount || 0), 0)
      }
    } else {
      total_users = data.total_users || 0
      total_earned = data.total_earned || 0
    }

    // Hitung umur website
    // Diatur peluncuran pada tanggal 15 Mei 2026
    const launchDate = new Date("2026-05-15T00:00:00Z")
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - launchDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return NextResponse.json({
      success: true,
      total_users,
      total_earned,
      website_age_days: diffDays
    })
  } catch (error: any) {
    console.error("Stats API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
