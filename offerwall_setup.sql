-- ====================================================================
-- SKRIP SETUP DATABASE OFFERWALLS (MONLIX)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Membuat tabel offerwall_claims jika belum ada
CREATE TABLE IF NOT EXISTS public.offerwall_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'monlix',
  transaction_id TEXT NOT NULL,
  points_reward INTEGER NOT NULL DEFAULT 0,
  payout_usd NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed', -- completed, refunded
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (provider, transaction_id)
);

-- 2. Indeks untuk performa query
CREATE INDEX IF NOT EXISTS idx_offerwall_claims_user_id ON public.offerwall_claims(user_id);
CREATE INDEX IF NOT EXISTS idx_offerwall_claims_provider_tx ON public.offerwall_claims(provider, transaction_id);

-- 3. Aktifkan Row Level Security (RLS)
ALTER TABLE public.offerwall_claims ENABLE ROW LEVEL SECURITY;

-- 4. Hak akses (GRANT)
GRANT SELECT ON public.offerwall_claims TO authenticated;

-- 5. Kebijakan RLS
DROP POLICY IF EXISTS "Users can view their own offerwall claims" ON public.offerwall_claims;
CREATE POLICY "Users can view their own offerwall claims" ON public.offerwall_claims
  FOR SELECT USING (auth.uid() = user_id);

-- 6. Fungsi RPC process_offerwall_completion
CREATE OR REPLACE FUNCTION public.process_offerwall_completion(
  p_user_id UUID,
  p_provider TEXT,
  p_transaction_id TEXT,
  p_reward_points INT,
  p_payout_usd NUMERIC
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_exists INT;
  v_new_balance NUMERIC;
  v_ref_id UUID;
  v_ref_commission INT;
BEGIN
  -- 1. Periksa apakah transaksi sudah pernah diproses sebelumnya
  SELECT COUNT(*) INTO v_exists
  FROM public.offerwall_claims
  WHERE provider = p_provider AND transaction_id = p_transaction_id;

  IF v_exists > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Transaction already processed');
  END IF;

  -- 2. Masukkan record transaksi baru
  INSERT INTO public.offerwall_claims (user_id, provider, transaction_id, points_reward, payout_usd, status)
  VALUES (p_user_id, p_provider, p_transaction_id, p_reward_points, p_payout_usd, 'completed');

  -- 3. Tambahkan poin ke user dan berikan 15 XP
  UPDATE public.profiles
  SET balance = balance + p_reward_points,
      xp = xp + 15
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 4. Berikan komisi referral 10% jika memiliki referrer
  SELECT referred_by_id INTO v_ref_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_ref_id IS NOT NULL THEN
    v_ref_commission := FLOOR(p_reward_points * 0.10);
    IF v_ref_commission > 0 THEN
      UPDATE public.profiles
      SET balance = balance + v_ref_commission
      WHERE id = v_ref_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Offerwall claim completed successfully',
    'new_balance', v_new_balance
  );
END;
$$;


-- 7. Perbarui fungsi get_referral_stats untuk menyertakan komisi Offerwalls
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_referral_code TEXT;
  v_total_referrals INT;
  v_active_today INT;
  v_faucet_commissions NUMERIC;
  v_shortlink_commissions NUMERIC;
  v_offerwall_commissions NUMERIC;
  v_total_commissions NUMERIC;
  v_referred_ids UUID[];
BEGIN
  -- 1. Ambil kode referral pengguna
  SELECT referral_code INTO v_referral_code
  FROM public.profiles
  WHERE id = p_user_id;

  -- 2. Ambil semua ID pengguna yang direferensikan
  SELECT ARRAY_AGG(id) INTO v_referred_ids
  FROM public.profiles
  WHERE referred_by_id = p_user_id;

  v_total_referrals := COALESCE(array_length(v_referred_ids, 1), 0);

  IF v_total_referrals = 0 THEN
    RETURN json_build_object(
      'referral_code', COALESCE(v_referral_code, ''),
      'total_referrals', 0,
      'active_today', 0,
      'total_commissions', 0
    );
  END IF;

  -- 3. Hitung referral yang aktif hari ini
  SELECT COUNT(DISTINCT user_id) INTO v_active_today
  FROM (
    SELECT user_id FROM public.faucet_claims
    WHERE user_id = ANY(v_referred_ids)
      AND claimed_at >= (now() - interval '24 hours')
    UNION
    SELECT user_id FROM public.shortlink_claims
    WHERE user_id = ANY(v_referred_ids)
      AND status = 'completed'
      AND completed_at >= (now() - interval '24 hours')
    UNION
    SELECT user_id FROM public.offerwall_claims
    WHERE user_id = ANY(v_referred_ids)
      AND status = 'completed'
      AND completed_at >= (now() - interval '24 hours')
  ) active_users;

  -- 4. Hitung komisi faucet (25%)
  SELECT COALESCE(FLOOR(SUM(amount) * 0.25), 0) INTO v_faucet_commissions
  FROM public.faucet_claims
  WHERE user_id = ANY(v_referred_ids);

  -- 5. Hitung komisi shortlink (10%)
  SELECT COALESCE(FLOOR(SUM(points_reward) * 0.10), 0) INTO v_shortlink_commissions
  FROM public.shortlink_claims
  WHERE user_id = ANY(v_referred_ids)
    AND status = 'completed';

  -- 6. Hitung komisi offerwall (10%)
  SELECT COALESCE(FLOOR(SUM(points_reward) * 0.10), 0) INTO v_offerwall_commissions
  FROM public.offerwall_claims
  WHERE user_id = ANY(v_referred_ids)
    AND status = 'completed';

  v_total_commissions := v_faucet_commissions + v_shortlink_commissions + v_offerwall_commissions;

  RETURN json_build_object(
    'referral_code', COALESCE(v_referral_code, ''),
    'total_referrals', v_total_referrals,
    'active_today', v_active_today,
    'total_commissions', v_total_commissions
  );
END;
$$;
