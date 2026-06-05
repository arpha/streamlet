-- ====================================================================
-- SKRIP SETUP DATABASE BLOG & ADMINTISTRASI
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Tambahkan kolom is_admin ke tabel profiles jika belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

-- 2. Buat tabel blog_posts jika belum ada
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  content TEXT NOT NULL,
  excerpt TEXT,
  cover_image TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  is_card BOOLEAN NOT NULL DEFAULT false,
  author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Pastikan kolom is_card ada jika tabel sudah terbuat sebelumnya
ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS is_card BOOLEAN NOT NULL DEFAULT false;

-- 3. Buat indeks untuk performa query
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON public.blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON public.blog_posts(published);
CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON public.blog_posts(created_at DESC);

-- 4. Aktifkan Row Level Security (RLS)
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

-- 5. Berikan hak akses ke role authenticated dan anon (publik)
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;

-- 6. Buat kebijakan RLS

-- Kebijakan A: Semua orang (bahkan tanpa login) bisa melihat post yang sudah berstatus 'published'
DROP POLICY IF EXISTS "Anyone can view published posts" ON public.blog_posts;
CREATE POLICY "Anyone can view published posts" ON public.blog_posts
  FOR SELECT USING (published = true);

-- Kebijakan B: Admin memiliki kontrol penuh atas seluruh postingan (draf, delete, dll)
DROP POLICY IF EXISTS "Admins have full access to posts" ON public.blog_posts;
CREATE POLICY "Admins have full access to posts" ON public.blog_posts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );


-- ====================================================================
-- SETUP STORAGE BUCKET UNTUK COVER IMAGE BLOG
-- ====================================================================

-- 1. Buat bucket baru bernama 'blog-images' jika belum ada
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog-images', 'blog-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Kebijakan akses untuk storage.objects
-- Kebijakan A: Semua orang (bahkan anonim) dapat mengunduh/melihat gambar cover
DROP POLICY IF EXISTS "Public can view blog images" ON storage.objects;
CREATE POLICY "Public can view blog images" ON storage.objects
  FOR SELECT USING (bucket_id = 'blog-images');

-- Kebijakan B: Hanya Admin yang dapat mengunggah, memperbarui, dan menghapus gambar
DROP POLICY IF EXISTS "Admins can manage blog images" ON storage.objects;
CREATE POLICY "Admins can manage blog images" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'blog-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    bucket_id = 'blog-images' AND
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_admin = true
    )
  );

