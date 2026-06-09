"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { ArrowLeft, Calendar, User, Clock, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface BlogPost {
  id: string
  title: string
  content: string
  cover_image: string
  created_at: string
  author: {
    username: string
  }
}

export default function SinglePostPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params?.slug as string
  const [post, setPost] = useState<BlogPost | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const supabase = createClient()

  useEffect(() => {
    if (!slug) return

    async function fetchPost() {
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id, title, content, cover_image, created_at, author:author_id(username)")
          .eq("slug", slug)
          .eq("published", true)
          .single()

        if (error) throw error
        setPost(data as any)
      } catch (err) {
        console.error("Failed to fetch blog post:", err)
        router.push("/blog")
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [slug, supabase, router])

  // Simple Markdown parser to safely render basic styling without npm dependencies
  const renderContent = (content: string) => {
    if (!content) return null

    const lines = content.split("\n")
    return lines.map((line, idx) => {
      const trimmed = line.trim()
      
      if (trimmed.startsWith("### ")) {
        return <h4 key={idx} className="text-lg font-black text-white mt-6 mb-2 uppercase tracking-tight">{trimmed.substring(4)}</h4>
      }
      if (trimmed.startsWith("## ")) {
        return <h3 key={idx} className="text-xl font-black text-white mt-8 mb-3 uppercase tracking-tight border-b border-white/5 pb-2">{trimmed.substring(3)}</h3>
      }
      if (trimmed.startsWith("# ")) {
        return <h2 key={idx} className="text-2xl font-black text-white mt-10 mb-4 uppercase tracking-tight">{trimmed.substring(2)}</h2>
      }
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        return (
          <li key={idx} className="list-disc list-inside text-white/70 ml-4 mb-2 font-medium">
            {parseInlineStyles(trimmed.substring(2))}
          </li>
        )
      }
      if (trimmed === "") {
        return <div key={idx} className="h-4" />
      }

      return (
        <p key={idx} className="text-white/75 font-medium leading-relaxed mb-4">
          {parseInlineStyles(line)}
        </p>
      )
    })
  }

  // Parse **bold**, [link](url), and raw URLs
  const parseInlineStyles = (text: string) => {
    const boldRegex = /\*\*(.*?)\*\*/g
    const linkRegex = /\[(.*?)\]\((.*?)\)/g
    
    // Replace markdown formatting first
    let html = text
      .replace(boldRegex, '<strong class="text-white font-bold">$1</strong>')
      .replace(linkRegex, 'LINK_PLACEHOLDER_START$2LINK_PLACEHOLDER_MIDDLE$1LINK_PLACEHOLDER_END')

    // Find raw URLs (e.g., http/https links)
    const rawUrlRegex = /(https?:\/\/[^\s<]+)/g
    html = html.replace(rawUrlRegex, (url) => {
      if (url.includes('LINK_PLACEHOLDER')) return url
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-purple-400 hover:underline font-bold">${url}</a>`
    })

    // Restore markdown links
    html = html.replace(/LINK_PLACEHOLDER_START(.*?)LINK_PLACEHOLDER_MIDDLE(.*?)LINK_PLACEHOLDER_END/g, 
      '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-purple-400 hover:underline font-bold">$2</a>')

    return <span dangerouslySetInnerHTML={{ __html: html }} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-white/40 font-bold uppercase tracking-wider text-xs">Loading article...</p>
      </div>
    )
  }

  if (!post) return null

  return (
    <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden flex flex-col justify-between">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="w-full max-w-4xl mx-auto px-6 pt-10 pb-6 relative z-10 flex items-center justify-between">
        <Link 
          href="/blog" 
          className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Blog
        </Link>
        <div className="flex items-center gap-2 text-white/20 uppercase font-black text-[10px] tracking-[0.2em]">
          <BookOpen className="w-3.5 h-3.5" />
          Reading Article
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-4xl mx-auto px-6 py-8 relative z-10 flex-grow">
        <motion.article
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass border-white/10 rounded-[2.5rem] shadow-2xl relative overflow-hidden"
        >
          {/* Cover Image */}
          {post.cover_image && (
            <div className="w-full h-64 md:h-96 relative bg-purple-950/20 border-b border-white/5 overflow-hidden">
              <img 
                src={post.cover_image} 
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div className="p-8 md:p-12 space-y-8">
            {/* Metadata */}
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-6 text-xs text-white/40 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  {new Date(post.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                <span className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-purple-400" />
                  Written by {post.author?.username || "Admin"}
                </span>
              </div>

              <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white leading-tight italic">
                {post.title}
              </h1>
            </div>

            <DropdownMenuSeparator className="bg-white/10" />

            {/* Ad Banner */}
            <div className="w-full py-4 border-b border-white/5">
              <div style={{ width: '100%', margin: 'auto', position: 'relative', zIndex: 10 }}>
                <iframe 
                  data-aa='2441223' 
                  src='//acceptable.a-ads.com/2441223/?size=Adaptive'
                  style={{ border: 0, padding: 0, width: '70%', height: 'auto', overflow: 'hidden', display: 'block', margin: 'auto' }}
                />
              </div>
            </div>

            {/* Content Body */}
            <div className="article-body">
              {renderContent(post.content)}
            </div>
          </div>
        </motion.article>
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 px-6 mt-12 relative z-10">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/30 font-bold uppercase tracking-wider">
          <p>© 2026 Streamlet Development. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

// Stub separator to avoid errors
function DropdownMenuSeparator({ className }: { className?: string }) {
  return <div className={`h-[1px] ${className}`} />
}
