-- ====================================================================
-- SKRIP SETUP DATABASE SHORTLINKS (SHRINKME.IO)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Membuat tabel shortlink_claims jika belum ada
CREATE TABLE IF NOT EXISTS public.shortlink_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'shrinkme',
  points_reward INTEGER NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, completed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 2. Indeks untuk performa query
CREATE INDEX IF NOT EXISTS idx_shortlink_claims_user_id ON public.shortlink_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_shortlink_claims_status ON public.shortlink_claims(status);
CREATE INDEX IF NOT EXISTS idx_shortlink_claims_completed_at ON public.shortlink_claims(completed_at DESC);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.shortlink_claims ENABLE ROW LEVEL SECURITY;

-- 4. Hak akses (GRANT) ke role authenticated (user yang login)
GRANT SELECT, INSERT, UPDATE ON public.shortlink_claims TO authenticated;

-- 5. Kebijakan RLS
DROP POLICY IF EXISTS "Users can view their own shortlink claims" ON public.shortlink_claims;
CREATE POLICY "Users can view their own shortlink claims" ON public.shortlink_claims
  FOR SELECT USING (auth.uid() = user_id);

-- 6. Fungsi RPC start_shortlink_visit
CREATE OR REPLACE FUNCTION public.start_shortlink_visit(
  p_user_id UUID,
  p_provider TEXT,
  p_reward INT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_completed_today INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_visit_id UUID;
BEGIN
  -- 1. Hitung jumlah klaim yang diselesaikan dalam 24 jam terakhir
  SELECT COUNT(*) INTO v_completed_today
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  IF v_completed_today >= 5 THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached (Max 5 shortlinks per 24 hours)');
  END IF;

  -- 2. Periksa cooldown 30 menit sejak klaim terakhir diselesaikan
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'Cooldown in progress. Please wait 30 minutes between shortlinks.'
    );
  END IF;

  -- 3. Hapus visit pending lama milik user ini untuk mencegah spamming link pending
  DELETE FROM public.shortlink_claims
  WHERE user_id = p_user_id 
    AND status = 'pending'
    AND created_at < (now() - interval '1 hour');

  -- 4. Masukkan kunjungan pending baru
  INSERT INTO public.shortlink_claims (user_id, provider, points_reward, status)
  VALUES (p_user_id, p_provider, p_reward, 'pending')
  RETURNING id INTO v_visit_id;

  RETURN json_build_object(
    'success', true,
    'visit_id', v_visit_id
  );
END;
$$;


-- 7. Fungsi RPC complete_shortlink_visit
CREATE OR REPLACE FUNCTION public.complete_shortlink_visit(
  p_visit_id UUID
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_reward INT;
  v_status TEXT;
  v_completed_today INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_new_balance NUMERIC;
  v_ref_id UUID;
  v_ref_commission INT;
BEGIN
  -- 1. Ambil info visit
  SELECT user_id, points_reward, status INTO v_user_id, v_reward, v_status
  FROM public.shortlink_claims
  WHERE id = p_visit_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Shortlink visit not found');
  END IF;

  IF v_status = 'completed' THEN
    RETURN json_build_object('success', false, 'message', 'This shortlink visit has already been claimed');
  END IF;

  -- 2. Validasi Batas Harian (Double-check)
  SELECT COUNT(*) INTO v_completed_today
  FROM public.shortlink_claims
  WHERE user_id = v_user_id
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  IF v_completed_today >= 5 THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached (Max 5 shortlinks per 24 hours)');
  END IF;

  -- 3. Validasi Cooldown 30 Menit (Double-check)
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = v_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
    RETURN json_build_object('success', false, 'message', 'Cooldown active. Please wait 30 minutes.');
  END IF;

  -- 4. Tandai visit sebagai completed
  UPDATE public.shortlink_claims
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_visit_id;

  -- 5. Berikan Poin & XP (10 XP) ke pengguna
  UPDATE public.profiles
  SET balance = balance + v_reward,
      xp = xp + 10
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- 6. Berikan komisi 10% ke pengundang jika ada
  SELECT referred_by_id INTO v_ref_id
  FROM public.profiles
  WHERE id = v_user_id
  LIMIT 1;

  IF v_ref_id IS NOT NULL THEN
    v_ref_commission := FLOOR(v_reward * 0.10);
    IF v_ref_commission > 0 THEN
      UPDATE public.profiles
      SET balance = balance + v_ref_commission
      WHERE id = v_ref_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully claimed 500 Points & 10 XP!',
    'new_balance', v_new_balance,
    'reward_given', v_reward
  );
END;
$$;


-- 8. Fungsi RPC get_user_shortlink_stats
CREATE OR REPLACE FUNCTION public.get_user_shortlink_stats(
  p_user_id UUID
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_completed_today INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_cooldown_remaining INT := 0;
  v_total_earned BIGINT;
BEGIN
  -- 1. Hitung selesai hari ini
  SELECT COUNT(*) INTO v_completed_today
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  -- 2. Hitung cooldown sisa (detik)
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL THEN
    -- jika jarak waktu kurang dari 30 menit
    IF (now() - v_last_completion) < interval '30 minutes' THEN
      v_cooldown_remaining := EXTRACT(EPOCH FROM (interval '30 minutes' - (now() - v_last_completion)))::INT;
    END IF;
  END IF;

  -- 3. Hitung total earned dari shortlinks
  SELECT COALESCE(SUM(points_reward), 0) INTO v_total_earned
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed';

  RETURN json_build_object(
    'completed_today', v_completed_today,
    'cooldown_remaining', v_cooldown_remaining,
    'total_earned', v_total_earned
  );
END;
$$;
