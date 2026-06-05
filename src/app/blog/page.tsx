"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { ArrowLeft, BookOpen, Calendar, Clock, User } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface BlogPost {
  id: string
  title: string
  slug: string
  excerpt: string
  cover_image: string
  created_at: string
  author: {
    username: string
  }
}

export default function BlogFeedPage() {
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchPosts() {
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("id, title, slug, excerpt, cover_image, created_at, author:author_id(username)")
          .eq("published", true)
          .order("created_at", { ascending: false })

        if (error) throw error
        setPosts((data as any) || [])
      } catch (err) {
        console.error("Failed to fetch blog posts:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [supabase])

  return (
    <div className="min-h-screen bg-[#020617] text-white relative overflow-hidden flex flex-col justify-between">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-600/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="w-full max-w-6xl mx-auto px-6 pt-10 pb-6 relative z-10 flex items-center justify-between">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>
        <div className="flex items-center gap-2 text-white/20 uppercase font-black text-[10px] tracking-[0.2em]">
          <BookOpen className="w-3.5 h-3.5" />
          Official Community Blog
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full max-w-6xl mx-auto px-6 py-8 relative z-10 flex-grow">
        <div className="text-center md:text-left mb-12">
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 italic uppercase">STREAMLET BLOG</h1>
          <p className="text-white/60 font-medium italic">Latest announcements, tutorials, and ecosystem updates</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div key={n} className="glass border-white/5 rounded-[2rem] h-96 animate-pulse" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="glass border-white/10 rounded-[2rem] p-16 text-center shadow-xl">
            <BookOpen className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <h3 className="text-xl font-black uppercase text-white/80">No articles published yet</h3>
            <p className="text-white/40 text-sm mt-1">Check back later for exciting news!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {posts.map((post, idx) => (
              <motion.article
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.1 }}
                className="glass border-white/10 rounded-[2rem] overflow-hidden flex flex-col justify-between group hover:border-purple-500/30 hover:shadow-2xl transition-all"
              >
                <div>
                  <div className="h-48 overflow-hidden relative bg-purple-950/20 border-b border-white/5">
                    {post.cover_image ? (
                      <img 
                        src={post.cover_image} 
                        alt={post.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-900/40 to-fuchsia-900/40">
                        <BookOpen className="w-10 h-10 text-white/20" />
                      </div>
                    )}
                  </div>
                  
                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-3 text-xs text-white/40 font-bold uppercase tracking-wider">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(post.created_at).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                    <h2 className="text-xl font-black text-white group-hover:text-purple-400 transition-colors uppercase leading-tight line-clamp-2">
                      {post.title}
                    </h2>

                    <p className="text-sm text-white/60 font-medium line-clamp-3">
                      {post.excerpt || "Read full article to view contents."}
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-0 flex items-center justify-between border-t border-white/5 mt-4">
                  <span className="flex items-center gap-1 text-xs font-bold text-white/40 uppercase">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    {post.author?.username || "Admin"}
                  </span>
                  
                  <Link 
                    href={`/blog/${post.slug}`} 
                    className="text-xs font-black uppercase tracking-widest text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    Read More &rarr;
                  </Link>
                </div>
              </motion.article>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-white/5 px-6 mt-12 relative z-10">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-white/30 font-bold uppercase tracking-wider">
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
