"use client"

import { useEffect, useRef } from "react"

/**
 * NativeBannerAd — renders an EffectiveCPM native banner ad.
 * Each instance creates a unique container ID to avoid DOM collisions.
 */
export function NativeBannerAd() {
  const containerRef = useRef<HTMLDivElement>(null)
  const scriptLoaded = useRef(false)

  useEffect(() => {
    if (!containerRef.current || scriptLoaded.current) return
    scriptLoaded.current = true

    const script = document.createElement("script")
    script.async = true
    script.setAttribute("data-cfasync", "false")
    script.src =
      "https://pl29698488.effectivecpmnetwork.com/ceac1e75d0056bbfc57cc655d2b8315f/invoke.js"

    containerRef.current.appendChild(script)

    return () => {
      // Cleanup on unmount
      if (containerRef.current && script.parentNode === containerRef.current) {
        containerRef.current.removeChild(script)
      }
    }
  }, [])

  return (
    <div className="w-full flex flex-col items-center gap-1.5">
      <span className="text-[9px] font-black uppercase tracking-widest text-white/15 select-none">
        Sponsored
      </span>
      <div
        ref={containerRef}
        className="w-full max-w-4xl mx-auto rounded-2xl overflow-hidden"
      >
        <div id="container-ceac1e75d0056bbfc57cc655d2b8315f" />
      </div>
    </div>
  )
}
