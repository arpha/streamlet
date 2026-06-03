"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

export default function RefPage() {
  const params = useParams()
  const router = useRouter()
  const code = params?.code as string

  useEffect(() => {
    if (code) {
      // Simpan kode referral dalam cookie selama 30 hari
      const maxAge = 30 * 24 * 60 * 60 // 30 hari dalam detik
      document.cookie = `referred_by_code=${encodeURIComponent(code)}; max-age=${maxAge}; path=/; SameSite=Lax`

      // Simpan di localStorage sebagai cadangan
      try {
        localStorage.setItem("referred_by_code", code)
      } catch (e) {
        console.error("Local storage error:", e)
      }
    }

    // Alihkan ke halaman registrasi
    router.push("/auth/register")
  }, [code, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#020617] text-white">
      <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
      <p className="text-sm font-bold uppercase tracking-widest text-white/60">Memproses link referral...</p>
    </div>
  )
}
