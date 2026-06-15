import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

export interface OfferwallTask {
  id: string
  provider: "cpx" | "notik"
  title: string
  description: string
  reward: number
  url: string
  image?: string
  duration?: string
  type: "survey" | "offer"
  os?: string[]
  devices?: string[]
  description_long?: string
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("user_id")
    if (!userId) {
      return NextResponse.json({ success: false, error: "Missing user_id" }, { status: 400 })
    }

    // Get user IP and user agent from request headers
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || request.headers.get("x-real-ip") 
      || "0.0.0.0"
    const userAgent = request.headers.get("user-agent") || ""

    // Get user country from Cloudflare header or fall back to GeoIP lookup
    const cfCountry = request.headers.get("cf-ipcountry")
    let userCountry = cfCountry ? cfCountry.toUpperCase() : null

    if (!userCountry && ip && ip !== "127.0.0.1" && ip !== "::1" && ip !== "0.0.0.0") {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ip}?fields=countryCode`)
        if (geoRes.ok) {
          const geoData = await geoRes.json()
          if (geoData?.countryCode) {
            userCountry = geoData.countryCode.toUpperCase()
          }
        }
      } catch (err) {
        console.error("GeoIP lookup failed:", err)
      }
    }

    // 1. Fetch CPX Research Surveys in parallel
    const cpxPromise = (async () => {
      const appId = process.env.NEXT_PUBLIC_CPX_RESEARCH_APP_ID || ""
      const secretKey = process.env.CPX_RESEARCH_SECRET_KEY || ""

      if (!appId || !secretKey || appId === "0") {
        return []
      }

      const secureHash = crypto
        .createHash("md5")
        .update(`${userId}-${secretKey}`)
        .digest("hex")

      const url = new URL("https://live-api.cpx-research.com/api/get-surveys.php")
      url.searchParams.set("app_id", appId)
      url.searchParams.set("ext_user_id", userId)
      url.searchParams.set("secure_hash", secureHash)
      url.searchParams.set("output_method", "api")
      url.searchParams.set("ip_user", ip)
      url.searchParams.set("user_agent", userAgent)

      const response = await fetch(url.toString(), {
        headers: { "Accept": "application/json" },
        next: { revalidate: 60 }, // Cache for 1 minute
      })

      if (!response.ok) return []
      const data = await response.json()
      const surveys = data?.surveys || []

      if (!Array.isArray(surveys)) return []

      return surveys.map((survey: any) => ({
        id: `cpx_${survey.id}`,
        provider: "cpx" as const,
        title: `Survei CPX Research`,
        description: `Selesaikan survei berdurasi ${survey.lo} menit. Rating: ${survey.stars} bintang.`,
        reward: Number(survey.payout),
        url: survey.href_new || survey.href,
        image: undefined,
        duration: `${survey.lo} menit`,
        type: "survey" as const,
        os: ["android", "ios", "windows", "mac os x"],
        devices: ["mobile", "tablet", "desktop"],
        description_long: `Dapatkan koin dengan menyelesaikan survei ini secara jujur.\nDurasi: ${survey.lo} menit.\nRating Survei: ${survey.stars} / 5 bintang.`
      }))
    })()

    // 2. Fetch Notik.me Offers in parallel
    const notikPromise = (async () => {
      const apiKey = process.env.NEXT_PUBLIC_NOTIK_API_KEY || ""
      const pubId = process.env.NEXT_PUBLIC_NOTIK_PUB_ID || ""
      const appId = process.env.NEXT_PUBLIC_NOTIK_APP_ID || ""

      if (!apiKey || !pubId || !appId) {
        return []
      }

      const url = `https://notik.me/api/v2/get-offers/all?api_key=${apiKey}&pub_id=${pubId}&app_id=${appId}&user_id=${userId}`
      
      const response = await fetch(url, {
        headers: { "Accept": "application/json" },
        next: { revalidate: 120 }, // Cache for 2 minutes
      })

      if (!response.ok) return []
      const data = await response.json()
      const offersList = data?.offers?.data || data?.offers || []

      if (!Array.isArray(offersList)) return []

      // Filter offers by country targeting
      const filteredOffers = offersList.filter((offer: any) => {
        if (Array.isArray(offer.country_code) && offer.country_code.length > 0) {
          if (offer.country_code.some((c: string) => c.toUpperCase() === "ALL")) return true
          if (!userCountry) return true
          return offer.country_code.map((c: string) => c.toUpperCase()).includes(userCountry)
        }
        return true
      })

      return filteredOffers.map((offer: any) => {
        // Convert USD payout to Streamlet Points: $1 USD = 200,000 Pts
        const rewardPoints = Math.floor(Number(offer.payout || 0) * 200000)

        // Replace the [user_id] placeholder in the click_url
        const clickUrl = (offer.click_url || "").replace(/\[user_id\]/gi, userId)

        // Compile descriptions
        const descList = [offer.description1, offer.description2, offer.description3]
          .filter(Boolean)
          .map(d => d.trim())
        
        const shortDesc = offer.description1 || "Unduh dan selesaikan petunjuk untuk mendapatkan koin."
        const longDesc = descList.length > 0 
          ? descList.join("\n\n") 
          : "Selesaikan instruksi penawaran ini dengan sukses untuk mendapatkan reward poin."

        return {
          id: `notik_${offer.offer_id}`,
          provider: "notik" as const,
          title: offer.name || "Penawaran Aplikasi",
          description: shortDesc,
          reward: rewardPoints,
          url: clickUrl,
          image: offer.image_url,
          duration: undefined,
          type: "offer" as const,
          os: Array.isArray(offer.os) ? offer.os : [],
          devices: Array.isArray(offer.devices) ? offer.devices : [],
          description_long: longDesc
        }
      })
    })()

    // 3. Resolve all promises
    const [cpxResults, notikResults] = await Promise.allSettled([cpxPromise, notikPromise])
    
    const tasks: OfferwallTask[] = []
    
    if (cpxResults.status === "fulfilled") {
      tasks.push(...cpxResults.value)
    } else {
      console.error("Failed to fetch CPX Research surveys:", cpxResults.reason)
    }

    if (notikResults.status === "fulfilled") {
      tasks.push(...notikResults.value)
    } else {
      console.error("Failed to fetch Notik.me offers:", notikResults.reason)
    }

    // Sort tasks: highest reward first
    tasks.sort((a, b) => b.reward - a.reward)

    return NextResponse.json({
      success: true,
      tasks
    })
  } catch (error: any) {
    console.error("Error fetching offerwall tasks:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
