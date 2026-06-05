"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { 
  ArrowLeft, 
  Save, 
  BookOpen, 
  FileText, 
  Image, 
  Link2, 
  Eye, 
  Loader2 
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"

export default function NewBlogPostPage() {
  const router = useRouter()
  const { isAdmin, id: userId } = useStore()
  const [checkingAuth, setCheckingAuth] = useState<boolean>(true)
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

  // Automatically update slug from title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setTitle(value)
    
    // Convert to slug format (lowercase, replace space/special chars with hyphens)
    const generatedSlug = value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove non-alphanumeric/spaces/hyphens
      .replace(/[\s_]+/g, "-")   // Replace spaces/underscores with hyphens
      .replace(/^-+|-+$/g, "")   // Remove leading/trailing hyphens
    
    setSlug(generatedSlug)
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
        .insert({
          title: title.trim(),
          slug: slug.trim(),
          excerpt: excerpt.trim() || null,
          cover_image: coverImage.trim() || null,
          content: content.trim(),
          published,
          author_id: userId
        })

      if (error) {
        if (error.code === "23505") {
          throw new Error("Slug must be unique. This slug is already taken.")
        }
        throw error
      }

      toast.success("Blog post created successfully!")
      router.push("/admin/blog")
    } catch (err: any) {
      console.error(err)
      toast.error(err.message || "Failed to create article")
    } finally {
      setSaving(false)
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
          New Article
        </span>
      </div>

      {/* Main form card */}
      <div className="glass border-white/10 rounded-[2.5rem] shadow-xl overflow-hidden relative">
        <div className="p-8 border-b border-white/5 flex items-center gap-3 bg-white/[0.01]">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center border border-purple-500/20 shadow-md">
            <FileText className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-black uppercase text-white tracking-wide">Write New Post</h3>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Use markdown syntax inside the content body</p>
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
            <p className="text-[10px] text-white/30">Your article will be located at: `/blog/{slug || "[slug]"}`</p>
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
              placeholder="## Section Heading&#10;Write your post body here. You can use **bold** text and [links](url).&#10;&#10;- Bullet point list item 1&#10;- Bullet point list item 2"
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
              Publish Live Immediately
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
                  Save Article
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
