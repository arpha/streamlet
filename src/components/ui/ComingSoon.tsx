"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Sparkles, ArrowLeft, Clock } from "lucide-react"
import { motion } from "framer-motion"
import Link from "next/link"

interface ComingSoonProps {
  featureName: string
  description?: string
}

export function ComingSoon({ featureName, description }: ComingSoonProps) {
  return (
    <div className="max-w-xl mx-auto py-12 px-4 flex flex-col items-center justify-center min-h-[70vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full"
      >
        <Card className="glass relative overflow-hidden rounded-[2.5rem] border-white/10 shadow-2xl p-8 md:p-12 text-center">
          {/* Decorative Glow */}
          <div className="absolute -top-12 -left-12 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-12 -right-12 w-48 h-48 bg-fuchsia-600/20 rounded-full blur-3xl" />

          <CardContent className="space-y-8 relative z-10 flex flex-col items-center">
            {/* Icon */}
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary to-fuchsia-600 flex items-center justify-center shadow-xl shadow-primary/20 animate-pulse">
              <Clock className="w-10 h-10 text-white" />
            </div>

            {/* Title */}
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-fuchsia-400" />
                <span className="text-xs font-black text-fuchsia-400 uppercase tracking-[0.2em]">Fitur Segera Hadir</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white uppercase italic tracking-tight">
                {featureName}
              </h2>
            </div>

            {/* Description */}
            <p className="text-white/60 text-sm font-medium italic max-w-sm">
              {description || "Kami sedang mengerjakan fitur ini. Pantau terus perkembangan terbaru kami untuk segera memainkannya!"}
            </p>

            <div className="h-px w-full bg-white/10" />

            {/* Action Button */}
            <Link href="/" passHref>
              <Button className="h-12 rounded-2xl px-6 font-bold bg-primary text-white neon-glow transition-all active:scale-95 hover:bg-primary/90 uppercase text-xs tracking-widest gap-2">
                <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
