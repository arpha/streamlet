-- ====================================================================
-- SKRIP SETUP MODE PEMELIHARAAN (MAINTENANCE MODE)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Buat tabel system_settings jika belum ada
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Berikan hak akses
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT ALL ON public.system_settings TO authenticated;

-- 4. Buat Kebijakan RLS

-- Kebijakan A: Semua orang (bahkan anonim) dapat membaca data konfigurasi
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Anyone can view system settings" ON public.system_settings
  FOR SELECT USING (true);

-- Kebijakan B: Hanya Admin yang dapat memperbarui pengaturan
DROP POLICY IF EXISTS "Only Admins can modify system settings" ON public.system_settings;
CREATE POLICY "Only Admins can modify system settings" ON public.system_settings
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

-- 5. Masukkan data awal (seed)
INSERT INTO public.system_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false, "message": "Kami sedang melakukan pemeliharaan sistem. Silakan kembali beberapa saat lagi."}'::jsonb)
ON CONFLICT (key) DO NOTHING;
