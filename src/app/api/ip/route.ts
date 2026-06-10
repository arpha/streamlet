import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const clientIp = req.headers.get("x-forwarded-for")?.split(',')[0].trim() || req.headers.get("x-real-ip") || "127.0.0.1"
  const userAgent = req.headers.get("user-agent") || ""

  return NextResponse.json({
    ip: clientIp,
    userAgent: userAgent
  })
}
