import { NextResponse } from "next/server"
import { getServerSupabase } from "@/lib/supabase-server"

function maskEmail(email: string) {
  if (!email) return "hidden"
  const [localPart, domain] = email.split("@")
  if (!domain) {
    if (email.length > 8) {
      return email.substring(0, 4) + "..." + email.substring(email.length - 4)
    }
    return email
  }
  const maskedLocal = localPart.length > 2 
    ? localPart.substring(0, 2) + "***" 
    : localPart.charAt(0) + "***"
  
  const domainParts = domain.split(".")
  const maskedDomain = domainParts[0].length > 2
    ? domainParts[0].substring(0, 2) + "***"
    : domainParts[0].charAt(0) + "***"
    
  return `${maskedLocal}@${maskedDomain}.${domainParts.slice(1).join(".")}`
}

export async function GET() {
  try {
    const supabase = await getServerSupabase()

    let total_users = 0
    let total_earned = 0
    let total_paid_usd = 0
    let recent_withdrawals: any[] = []

    // 1. Ambil statistik utama
    const { data: publicStats, error: statsError } = await supabase.rpc("get_public_stats")

    if (statsError) {
      console.warn("RPC get_public_stats failed, using fallback queries:", statsError.message)
      
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
      total_users = count || 0

      const { data: claimsSum } = await supabase.from('faucet_claims').select('amount')
      if (claimsSum) {
        total_earned = claimsSum.reduce((sum, item) => sum + (item.amount || 0), 0)
      }
    } else if (publicStats) {
      total_users = publicStats.total_users || 0
      total_earned = publicStats.total_earned || 0
      total_paid_usd = publicStats.total_paid_usd || 0
    }

    // 2. Ambil 10 penarikan terbaru
    const { data: withdrawalsData, error: withdrawalsError } = await supabase.rpc("get_recent_withdrawals")
    
    if (withdrawalsError) {
      console.warn("RPC get_recent_withdrawals failed, using empty array:", withdrawalsError.message)
    } else if (withdrawalsData) {
      recent_withdrawals = withdrawalsData.map((w: any) => ({
        coin: w.coin,
        amount: w.amount,
        usd_value: w.usd_value || (w.amount * 0.000005),
        address: maskEmail(w.address),
        status: w.status,
        created_at: w.created_at
      }))
    }

    // Hitung umur website
    const launchDate = new Date("2026-06-04T00:00:00Z")
    const now = new Date()
    const diffTime = Math.max(0, now.getTime() - launchDate.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1

    return NextResponse.json({
      success: true,
      total_users,
      total_earned,
      total_paid_usd,
      website_age_days: diffDays,
      recent_withdrawals
    })
  } catch (error: any) {
    console.error("Stats API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
