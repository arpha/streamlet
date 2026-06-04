"use client"

import { useEffect } from "react"

interface AdBlockDetectorProps {
  onDetect: (detected: boolean) => void
}

export function AdBlockDetector({ onDetect }: AdBlockDetectorProps) {
  useEffect(() => {
    let isDetected = false

    const checkAdBlock = async () => {
      // Metode 1: Penyisipan Elemen Umpan (DOM Bait)
      const bait = document.createElement("div")
      // Kelas-kelas CSS yang paling umum diblokir oleh ekstensi AdBlocker
      bait.className = "adsbox ad-banner sponsored-ad doubleclick-ad ad-placeholder"
      bait.setAttribute(
        "style",
        "position: absolute; left: -9999px; top: -9999px; width: 1px; height: 1px;"
      )
      document.body.appendChild(bait)

      // Tunggu satu frame browser selesai render untuk melihat apakah disembunyikan
      await new Promise((resolve) => requestAnimationFrame(resolve))

      const style = window.getComputedStyle(bait)
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        bait.offsetHeight === 0 ||
        bait.offsetWidth === 0
      ) {
        isDetected = true
      }

      document.body.removeChild(bait)

      // Metode 2: Percobaan Fetch ke domain iklan A-ADS (bila diblokir browser/klien)
      if (!isDetected) {
        try {
          await fetch(
            "https://acceptable.a-ads.com/2441223/?size=Adaptive",
            { method: "HEAD", mode: "no-cors", cache: "no-store" }
          )
        } catch (err) {
          isDetected = true
        }
      }

      onDetect(isDetected)
    }

    // Jalankan pemeriksaan setelah jeda kecil agar AdBlocker selesai memproses halaman
    const timeoutId = setTimeout(checkAdBlock, 1500)

    return () => clearTimeout(timeoutId)
  }, [onDetect])

  return null
}
