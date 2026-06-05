"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft, 
  Save, 
  FileText, 
  Image, 
  Link2, 
  Loader2 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"

export default function EditBlogPostPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string
  const { isAdmin, id: userId } = useStore()
  
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const supabase = createClient()

  // Form states
  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [coverImage, setCoverImage] = useState("")
  const [content, setContent] = useState("")
  const [published, setPublished] = useState(false)

  // Authorization check
  useEffect(() => {
    if (userId === undefined) return
    if (!userId || !isAdmin) {
      toast.error("Access Denied.")
      router.push("/")
      return
    }
    setCheckingAuth(false)
  }, [userId, isAdmin, router])

  // Load existing post data
  useEffect(() => {
    if (!id || checkingAuth) return

    async function loadPost() {
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("*")
          .eq("id", id)
          .single()

        if (error) throw error
        if (data) {
          setTitle(data.title)
          setSlug(data.slug)
          setExcerpt(data.excerpt || "")
          setCoverImage(data.cover_image || "")
          setContent(data.content)
          setPublished(data.published)
        }
      } catch (err: any) {
        console.error(err)
        toast.error("Failed to load post data")
        router.push("/admin/blog")
      } finally {
        setLoading(false)
      }
    }

    loadPost()
  }, [id, checkingAuth, supabase, router])

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTitle(value)
    
    // Automatically regenerate slug if it wasn't manually customized yet,
    // or just let them update it. For edits, it is usually safer to not auto-update slug 
    // unless they clear the slug input or choose to. Let's just update the title state here.
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim() || !slug.trim() || !content.trim()) {
      toast.error("Please fill in the title, slug, and content fields.")
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from("blog_posts")
        .update({
          title: title.trim(),
          slug: slug.trim(),
          excerpt: excerpt.trim() || null,
          cover_image: coverImage.trim() || null,
          content: content.trim(),
          published,
          updated_at: new Date().toISOString()
        })
        .eq("id", id)

      if (error) {
        if (error.code === "23505") {
          throw new Error("Slug must be unique. This slug is already taken.")
        }
        throw error
      }

      toast.success("Blog post updated successfully!")
      router.push("/admin/blog")
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to update article")
    } finally {
      setSaving(false)
    }
  }

  if (checkingAuth || loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin mb-4" />
        <p className="text-white/40 font-bold uppercase tracking-wider text-xs">Loading data...</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Back Header */}
      <div className="flex items-center justify-between relative z-10">
        <Link 
          href="/admin/blog" 
          className="inline-flex items-center gap-2 text-xs font-bold text-white/40 hover:text-white transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Articles
        </Link>
        <span className="text-xs font-black text-purple-400 uppercase tracking-widest">
          Edit Article
        </span>
      </div>

      {/* Main form card */}
      <div className="glass border-white/10 rounded-[2.5rem] shadow-xl overflow-hidden relative">
        <div className="p-8 border-b border-white/5 flex items-center gap-3 bg-white/[0.01]">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/20 shadow-md">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-white tracking-wide">Modify Post</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Update your article details below</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {/* Title input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Article Title</label>
            <Input
              type="text"
              placeholder="e.g., Faucet Rewards Increased by 50%!"
              value={title}
              onChange={handleTitleChange}
              className="bg-white/5 border-white/10 text-white rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 h-12 font-bold"
              required
            />
          </div>

          {/* Slug input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">URL Slug</label>
            <div className="relative">
              <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                type="text"
                placeholder="faucet-rewards-increased"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                className="bg-white/5 border-white/10 text-white rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 h-12 pl-12 font-mono text-sm"
                required
              />
            </div>
            <p className="text-[10px] text-white/30">Your article is located at: `/blog/{slug || "[slug]"}`</p>
          </div>

          {/* Excerpt input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Excerpt / Summary</label>
            <Textarea
              placeholder="Provide a short description that will appear on the blog catalog list cards..."
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              className="bg-white/5 border-white/10 text-white rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 h-20 font-medium"
            />
          </div>

          {/* Cover image input */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Cover Image URL</label>
            <div className="relative">
              <Image className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <Input
                type="url"
                placeholder="https://images.unsplash.com/photo-..."
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="bg-white/5 border-white/10 text-white rounded-xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 h-12 pl-12 font-medium"
              />
            </div>
          </div>

          {/* Content markdown editor */}
          <div className="space-y-2">
            <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] block">Content (Markdown)</label>
            <Textarea
              placeholder="Write your post body here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="bg-white/5 border-white/10 text-white rounded-2xl focus:border-purple-500 focus:ring-1 focus:ring-purple-500 min-h-[300px] font-mono text-sm leading-relaxed p-4"
              required
            />
          </div>

          {/* Status publishing */}
          <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <input
              type="checkbox"
              id="published"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600 bg-white/5 border-white/10 focus:ring-purple-500 focus:ring-opacity-50"
            />
            <label htmlFor="published" className="text-xs font-black text-white uppercase tracking-widest cursor-pointer select-none">
              Publish Live
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs uppercase tracking-widest gap-2 shadow-lg shadow-purple-650/20"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Update Article
                </>
              )}
            </Button>
            
            <Link href="/admin/blog" className="flex-1">
              <Button type="button" variant="ghost" className="w-full h-12 rounded-2xl border border-white/10 text-white hover:bg-white/5 font-black text-xs uppercase tracking-widest">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
