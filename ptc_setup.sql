-- ====================================================================
-- SKRIP SETUP DATABASE PAID-TO-CLICK (PTC) & ADVERTISER SYSTEM
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- Skrip ini sudah mencakup tabel dasar dan migrasi limit tayangan harian.
-- ====================================================================

-- 0. Hapus tabel lama jika ada agar struktur tabel bersih terbuat ulang
DROP TABLE IF EXISTS public.ptc_views CASCADE;
DROP TABLE IF EXISTS public.ptc_campaigns CASCADE;

-- 1. Tambah kolom advertiser_tokens ke tabel profiles jika belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS advertiser_tokens INTEGER DEFAULT 0;

-- 2. Buat tabel ptc_campaigns untuk menyimpan iklan yang dibuat advertiser
CREATE TABLE IF NOT EXISTS public.ptc_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  duration INTEGER NOT NULL CHECK (duration IN (10, 30, 60, 120)),
  cost_per_view INTEGER NOT NULL,
  reward_per_view INTEGER NOT NULL,
  total_views INTEGER NOT NULL CHECK (total_views > 0),
  views_completed INTEGER DEFAULT 0 CHECK (views_completed <= total_views),
  daily_views_limit INTEGER DEFAULT NULL,
  daily_views_completed INTEGER DEFAULT 0,
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tambahkan kolom limit harian secara manual jika tabel sudah dibuat sebelumnya
ALTER TABLE public.ptc_campaigns ADD COLUMN IF NOT EXISTS daily_views_limit INTEGER DEFAULT NULL;
ALTER TABLE public.ptc_campaigns ADD COLUMN IF NOT EXISTS daily_views_completed INTEGER DEFAULT 0;
ALTER TABLE public.ptc_campaigns ADD COLUMN IF NOT EXISTS last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- 3. Buat tabel ptc_views untuk mencatat klaim iklan oleh user (limit 24 jam)
CREATE TABLE IF NOT EXISTS public.ptc_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.ptc_campaigns(id) ON DELETE CASCADE,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indeks performa untuk ptc_views
CREATE INDEX IF NOT EXISTS idx_ptc_views_user_campaign ON public.ptc_views(user_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_ptc_views_viewed_at ON public.ptc_views(viewed_at DESC);

-- Aktifkan Row Level Security (RLS)
ALTER TABLE public.ptc_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptc_views ENABLE ROW LEVEL SECURITY;

-- Berikan hak akses ke role authenticated
GRANT SELECT, INSERT, UPDATE ON public.ptc_campaigns TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.ptc_views TO authenticated;

-- RLS Policies
DROP POLICY IF EXISTS "Advertisers can view their own campaigns" ON public.ptc_campaigns;
CREATE POLICY "Advertisers can view their own campaigns" ON public.ptc_campaigns
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view active campaigns" ON public.ptc_campaigns;
CREATE POLICY "Users can view active campaigns" ON public.ptc_campaigns
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Users can view their own ptc views" ON public.ptc_views;
CREATE POLICY "Users can view their own ptc views" ON public.ptc_views
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Fungsi RPC exchange_points_to_tokens — menukar Poin ke Token (1:1)
CREATE OR REPLACE FUNCTION public.exchange_points_to_tokens(
  p_user_id UUID,
  p_points INT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  v_new_tokens INT;
BEGIN
  IF p_points <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Jumlah poin harus lebih dari 0.');
  END IF;

  -- Lock user row
  SELECT balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Pengguna tidak ditemukan.');
  END IF;

  IF v_current_balance < p_points THEN
    RETURN json_build_object('success', false, 'message', 'Saldo poin tidak mencukupi.');
  END IF;

  -- Potong poin, tambah token
  UPDATE public.profiles
  SET balance = balance - p_points,
      advertiser_tokens = advertiser_tokens + p_points
  WHERE id = p_user_id
  RETURNING balance, advertiser_tokens INTO v_new_balance, v_new_tokens;

  RETURN json_build_object(
    'success', true,
    'message', 'Penukaran poin ke token berhasil.',
    'new_balance', v_new_balance,
    'new_tokens', v_new_tokens
  );
END;
$$;

-- Hapus signature fungsi create_ptc_campaign lama jika ada
DROP FUNCTION IF EXISTS public.create_ptc_campaign(UUID, TEXT, TEXT, INT, INT);
DROP FUNCTION IF EXISTS public.create_ptc_campaign(UUID, TEXT, TEXT, INT, INT, INT);

-- 5. Fungsi RPC create_ptc_campaign — membuat iklan baru dengan memotong token (Mendukung Limit Harian)
CREATE OR REPLACE FUNCTION public.create_ptc_campaign(
  p_user_id UUID,
  p_title TEXT,
  p_url TEXT,
  p_duration INT,
  p_total_views INT,
  p_daily_views_limit INT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cost_per_view INT;
  v_reward_per_view INT;
  v_total_cost INT;
  v_current_tokens INT;
  v_new_tokens INT;
  v_campaign_id UUID;
BEGIN
  -- Validasi durasi & tentukan biaya (cost) dan hadiah (reward)
  IF p_duration = 10 THEN
    v_cost_per_view := 70;
    v_reward_per_view := 40;
  ELSIF p_duration = 30 THEN
    v_cost_per_view := 150;
    v_reward_per_view := 100;
  ELSIF p_duration = 60 THEN
    v_cost_per_view := 250;
    v_reward_per_view := 160;
  ELSIF p_duration = 120 THEN
    v_cost_per_view := 450;
    v_reward_per_view := 300;
  ELSE
    RETURN json_build_object('success', false, 'message', 'Durasi tidak valid. Pilih 10, 30, 60, atau 120 detik.');
  END IF;

  IF p_total_views <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Jumlah tayangan harus lebih dari 0.');
  END IF;

  IF p_daily_views_limit IS NOT NULL AND p_daily_views_limit <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Limit harian harus lebih dari 0.');
  END IF;

  IF p_daily_views_limit IS NOT NULL AND p_daily_views_limit > p_total_views THEN
    RETURN json_build_object('success', false, 'message', 'Limit harian tidak boleh melebihi total tayangan.');
  END IF;

  v_total_cost := v_cost_per_view * p_total_views;

  -- Lock user row
  SELECT advertiser_tokens INTO v_current_tokens
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_tokens IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Pengguna tidak ditemukan.');
  END IF;

  IF v_current_tokens < v_total_cost THEN
    RETURN json_build_object('success', false, 'message', 'Saldo Token tidak mencukupi. Silakan tukar Poin atau Deposit terlebih dahulu.');
  END IF;

  -- Potong token advertiser
  UPDATE public.profiles
  SET advertiser_tokens = advertiser_tokens - v_total_cost
  WHERE id = p_user_id
  RETURNING advertiser_tokens INTO v_new_tokens;

  -- Buat campaign baru
  INSERT INTO public.ptc_campaigns (user_id, title, url, duration, cost_per_view, reward_per_view, total_views, daily_views_limit, status)
  VALUES (p_user_id, p_title, p_url, p_duration, v_cost_per_view, v_reward_per_view, p_total_views, p_daily_views_limit, 'active')
  RETURNING id INTO v_campaign_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Kampanye PTC berhasil dibuat.',
    'new_tokens', v_new_tokens,
    'campaign_id', v_campaign_id
  );
END;
$$;

-- Hapus signature fungsi claim_ptc_view lama jika ada
DROP FUNCTION IF EXISTS public.claim_ptc_view(UUID, UUID);

-- 6. Fungsi RPC claim_ptc_view — mengklaim reward nonton iklan (Mendukung Limit Harian)
CREATE OR REPLACE FUNCTION public.claim_ptc_view(
  p_user_id UUID,
  p_campaign_id UUID
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_campaign public.ptc_campaigns;
  v_already_viewed INT;
  v_new_balance INT;
BEGIN
  -- Reset daily views untuk campaign jika sudah berganti hari (WIB / GMT+7)
  UPDATE public.ptc_campaigns
  SET daily_views_completed = 0,
      last_reset_at = now()
  WHERE id = p_campaign_id
    AND (now() AT TIME ZONE 'Asia/Jakarta')::date > (last_reset_at AT TIME ZONE 'Asia/Jakarta')::date;

  -- Lock campaign row
  SELECT * INTO v_campaign
  FROM public.ptc_campaigns
  WHERE id = p_campaign_id;

  IF v_campaign.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Kampanye iklan tidak ditemukan.');
  END IF;

  IF v_campaign.status != 'active' OR v_campaign.views_completed >= v_campaign.total_views THEN
    RETURN json_build_object('success', false, 'message', 'Iklan ini sudah tidak aktif atau kuota tayangan habis.');
  END IF;

  -- Cek limit tayangan harian
  IF v_campaign.daily_views_limit IS NOT NULL AND v_campaign.daily_views_limit > 0 AND v_campaign.daily_views_completed >= v_campaign.daily_views_limit THEN
    RETURN json_build_object('success', false, 'message', 'Iklan ini sudah mencapai limit tayangan harian hari ini.');
  END IF;

  -- Cek duplikasi menonton dalam 24 jam terakhir
  SELECT COUNT(*) INTO v_already_viewed
  FROM public.ptc_views
  WHERE user_id = p_user_id
    AND campaign_id = p_campaign_id
    AND viewed_at >= now() - INTERVAL '24 hours';

  IF v_already_viewed > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Anda sudah menonton iklan ini dalam 24 jam terakhir.');
  END IF;

  -- Masukkan ke riwayat tontonan
  INSERT INTO public.ptc_views (user_id, campaign_id)
  VALUES (p_user_id, p_campaign_id);

  -- Update jumlah views_completed & daily_views_completed
  UPDATE public.ptc_campaigns
  SET views_completed = views_completed + 1,
      daily_views_completed = daily_views_completed + 1
  WHERE id = p_campaign_id;

  -- Jika kuota habis, tandai completed
  UPDATE public.ptc_campaigns
  SET status = 'completed'
  WHERE id = p_campaign_id AND views_completed >= total_views;

  -- Tambah saldo poin dan 1 XP ke viewer
  UPDATE public.profiles
  SET balance = balance + v_campaign.reward_per_view,
      xp = xp + 1
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  RETURN json_build_object(
    'success', true,
    'message', 'Berhasil mengklaim ' || v_campaign.reward_per_view || ' Poin & 1 XP!',
    'new_balance', v_new_balance
  );
END;
$$;

-- 7. Fungsi RPC deposit_advertiser_tokens — menambahkan token ke advertiser setelah deposit sukses
CREATE OR REPLACE FUNCTION public.deposit_advertiser_tokens(
  p_user_id UUID,
  p_tokens INT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_tokens INT;
BEGIN
  UPDATE public.profiles
  SET advertiser_tokens = advertiser_tokens + p_tokens
  WHERE id = p_user_id
  RETURNING advertiser_tokens INTO v_new_tokens;

  RETURN json_build_object(
    'success', true,
    'new_tokens', v_new_tokens
  );
END;
$$;

-- Hapus signature fungsi get_active_ptc_campaigns lama jika ada
DROP FUNCTION IF EXISTS public.get_active_ptc_campaigns(UUID);

-- 8. Fungsi RPC get_active_ptc_campaigns — mengambil iklan PTC aktif yang belum ditonton user dalam 24 jam terakhir
CREATE OR REPLACE FUNCTION public.get_active_ptc_campaigns(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  title TEXT,
  url TEXT,
  duration INT,
  reward_per_view INT,
  total_views INT,
  views_completed INT,
  daily_views_limit INT,
  daily_views_completed INT
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Reset daily views untuk campaign active yang sudah berganti hari (WIB / GMT+7)
  UPDATE public.ptc_campaigns
  SET daily_views_completed = 0,
      last_reset_at = now()
  WHERE status = 'active'
    AND (now() AT TIME ZONE 'Asia/Jakarta')::date > (last_reset_at AT TIME ZONE 'Asia/Jakarta')::date;

  RETURN QUERY
  SELECT c.id, c.title, c.url, c.duration, c.reward_per_view, c.total_views, c.views_completed, c.daily_views_limit, c.daily_views_completed
  FROM public.ptc_campaigns c
  WHERE c.status = 'active'
    AND c.views_completed < c.total_views
    AND (c.daily_views_limit IS NULL OR c.daily_views_limit = 0 OR c.daily_views_completed < c.daily_views_limit)
    AND NOT EXISTS (
      SELECT 1 
      FROM public.ptc_views v
      WHERE v.user_id = p_user_id
        AND v.campaign_id = c.id
        AND v.viewed_at >= now() - INTERVAL '24 hours'
    );
END;
$$;
