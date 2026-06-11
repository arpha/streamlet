import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("user_id")
    if (!userId) {
      return NextResponse.json({ surveys_available: false })
    }

    const appId = process.env.NEXT_PUBLIC_CPX_RESEARCH_APP_ID || ""
    const secretKey = process.env.CPX_RESEARCH_SECRET_KEY || ""

    if (!appId || !secretKey) {
      return NextResponse.json({ surveys_available: false })
    }

    // Generate secure hash: md5(ext_user_id + "-" + secret_key)
    const secureHash = crypto
      .createHash("md5")
      .update(`${userId}-${secretKey}`)
      .digest("hex")

    // Get user IP and user agent from request headers
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || request.headers.get("x-real-ip") 
      || "0.0.0.0"
    const userAgent = request.headers.get("user-agent") || ""

    const url = new URL("https://live-api.cpx-research.com/api/get-surveys.php")
    url.searchParams.set("app_id", appId)
    url.searchParams.set("ext_user_id", userId)
    url.searchParams.set("secure_hash", secureHash)
    url.searchParams.set("output_method", "api")
    url.searchParams.set("ip_user", ip)
    url.searchParams.set("user_agent", userAgent)
    url.searchParams.set("limit", "1") // We just need to know if any survey exists

    const response = await fetch(url.toString(), {
      headers: { "Accept": "application/json" },
      next: { revalidate: 300 }, // Cache for 5 minutes
    })

    if (!response.ok) {
      return NextResponse.json({ surveys_available: false })
    }

    const data = await response.json()

    // CPX returns surveys in data.surveys array
    const cpxSurveys = data?.surveys || []
    const cpxAvailable = Array.isArray(cpxSurveys) && cpxSurveys.length > 0

    let topSurvey = null
    if (cpxAvailable) {
      // Sort by payout descending to get highest paying survey
      const sortedSurveys = [...cpxSurveys].sort((a, b) => Number(b.payout) - Number(a.payout))
      topSurvey = {
        provider: "CPX Research",
        reward: Number(sortedSurveys[0].payout),
        href: sortedSurveys[0].href_new || sortedSurveys[0].href
      }
    }

    return NextResponse.json({
      surveys_available: cpxAvailable,
      cpx_count: cpxSurveys.length,
      top_survey: topSurvey
    })
  } catch (error) {
    console.error("Error checking survey availability:", error)
    return NextResponse.json({ surveys_available: false })
  }
}
