-- ====================================================================
-- MAINTENANCE MODE SETUP SCRIPT
-- Run this script in the Supabase Dashboard SQL Editor.
-- ====================================================================

-- 1. Create system_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Grant permissions
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT ALL ON public.system_settings TO authenticated;

-- 4. Create RLS Policies

-- Policy A: Anyone (including anonymous users) can view settings
DROP POLICY IF EXISTS "Anyone can view system settings" ON public.system_settings;
CREATE POLICY "Anyone can view system settings" ON public.system_settings
  FOR SELECT USING (true);

-- Policy B: Only Admins can modify settings
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

-- 5. Seed initial data
INSERT INTO public.system_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false, "message": "We are currently performing scheduled system maintenance. Please check back shortly."}'::jsonb)
ON CONFLICT (key) DO NOTHING;
