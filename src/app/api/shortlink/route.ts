import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const { destinationUrl } = await req.json()

    if (!destinationUrl) {
      return NextResponse.json({ error: "Missing destination URL" }, { status: 400 })
    }

    const apiKey = process.env.EXE_IO_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Shortlink API not configured" }, { status: 500 })
    }

    const apiUrl = `https://exe.io/api?api=${apiKey}&url=${encodeURIComponent(destinationUrl)}&format=json`

    const response = await fetch(apiUrl)
    const result = await response.json()

    if (result.status === "success" && result.shortenedUrl) {
      return NextResponse.json({ shortenedUrl: result.shortenedUrl })
    } else {
      console.error("exe.io API error:", result)
      return NextResponse.json({ error: result.message || "Failed to create shortlink" }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Shortlink API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
