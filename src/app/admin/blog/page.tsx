"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  FileText, 
  ArrowLeft, 
  BookOpen, 
  ShieldAlert,
  Loader2
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"

interface BlogPost {
  id: string
  title: string
  slug: string
  published: boolean
  created_at: string
}

export default function AdminBlogPage() {
  const router = useRouter()
  const { isAdmin, id: userId } = useStore()
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true)
  const supabase = createClient()

  // Authorization check
  useEffect(() => {
    // If not checked yet or still loading
    if (userId === undefined) return
    
    if (!userId || !isAdmin) {
      // Not admin, redirect to home
      const timer = setTimeout(() => {
        toast.error("Access Denied: Admin authorization required.")
        router.push("/")
      }, 1000)
      return () => clearTimeout(timer)
    }
    
    setCheckingAuth(false)
    fetchPosts()
  }, [userId, isAdmin, router])

  async function fetchPosts() {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("id, title, slug, published, created_at")
        .order("created_at", { ascending: false })

      if (error) throw error
      setPosts((data as any) || [])
    } catch (err: any) {
      console.error("Failed to load posts:", err)
      toast.error(err.message || "Failed to load posts")
    } finally {
      setLoading(false)
    }
  }

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({ published: !currentStatus })
        .eq("id", id)

      if (error) throw error
      
      toast.success(currentStatus ? "Post set as Draft" : "Post Published Live!")
      fetchPosts()
    } catch (err: any) {
      toast.error(err.message || "Failed to update status")
    }
  }

  const deletePost = async (id: string) => {
    if (!confirm("Are you sure you want to delete this article? This action is permanent!")) return

    try {
      const { error } = await supabase
        .from("blog_posts")
        .delete()
        .eq("id", id)

      if (error) throw error

      toast.success("Article deleted successfully")
      fetchPosts()
    } catch (err: any) {
      toast.error(err.message || "Failed to delete article")
    }
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-white/40 font-bold uppercase tracking-wider text-xs">Checking authorization...</p>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-black uppercase tracking-widest mb-4">
            <BookOpen className="w-3.5 h-3.5" />
            Admin Panel
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2 italic uppercase">BLOG MANAGEMENT</h2>
          <p className="text-white/60 font-medium italic">Create, edit, and organize articles for the Streamlet community.</p>
        </div>

        <div className="flex gap-3">
          <Link href="/blog">
            <Button variant="ghost" className="rounded-2xl border border-white/10 text-white hover:bg-white/5 font-black text-xs uppercase tracking-widest gap-2">
              <Eye className="w-4 h-4" />
              View Public Blog
            </Button>
          </Link>
          <Link href="/admin/blog/new">
            <Button className="rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-purple-650/20">
              <Plus className="w-4 h-4" />
              New Article
            </Button>
          </Link>
        </div>
      </div>

      {/* TABLE / CONTENT LIST */}
      <div className="glass border-white/10 rounded-[2.5rem] shadow-xl overflow-hidden relative">
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
          <h3 className="text-lg font-black uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Article List ({posts.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-20 text-center flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider text-white/40">Loading articles...</span>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-20 text-center">
              <FileText className="w-12 h-12 text-white/10 mx-auto mb-4" />
              <h4 className="text-lg font-black uppercase text-white/60">No articles created yet</h4>
              <p className="text-white/40 text-xs mt-1">Get started by creating your very first blog post.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-white/[0.02]">
                  <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Title</th>
                  <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Slug</th>
                  <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider">Date Created</th>
                  <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">Status</th>
                  <th className="p-5 text-[10px] font-black text-white/40 uppercase tracking-wider text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 font-medium text-sm">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-white/[0.01] transition-colors">
                    <td className="p-5 text-white font-bold">{post.title}</td>
                    <td className="p-5 text-white/60 font-mono text-xs">{post.slug}</td>
                    <td className="p-5 text-white/40 font-mono text-xs">
                      {new Date(post.created_at).toLocaleString("id-ID")}
                    </td>
                    <td className="p-5 text-center">
                      <Button
                        onClick={() => togglePublish(post.id, post.published)}
                        variant="ghost"
                        size="sm"
                        className={`rounded-full px-4 py-1 text-[10px] font-black uppercase tracking-wider border gap-1.5 transition-all
                          ${post.published 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20" 
                            : "bg-white/5 text-white/40 border-white/10 hover:bg-white/10"
                          }`}
                      >
                        {post.published ? (
                          <>
                            <Eye className="w-3.5 h-3.5" />
                            Published
                          </>
                        ) : (
                          <>
                            <EyeOff className="w-3.5 h-3.5" />
                            Draft
                          </>
                        )}
                      </Button>
                    </td>
                    <td className="p-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link href={`/admin/blog/edit/${post.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border border-white/5 text-white/60 hover:text-white hover:bg-white/5">
                            <Edit className="w-4 h-4" />
                          </Button>
                        </Link>
                        <Button
                          onClick={() => deletePost(post.id)}
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg border border-rose-500/10 text-rose-400/60 hover:text-rose-400 hover:bg-rose-500/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
