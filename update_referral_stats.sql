-- ====================================================================
-- UPDATE REFERRAL STATS FUNCTION TO INCLUDE SHORTLINK COMMISSIONS
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

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

  -- 3. Hitung referral yang aktif hari ini (klaim faucet atau shortlink dalam 24 jam terakhir)
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

  v_total_commissions := v_faucet_commissions + v_shortlink_commissions;

  RETURN json_build_object(
    'referral_code', COALESCE(v_referral_code, ''),
    'total_referrals', v_total_referrals,
    'active_today', v_active_today,
    'total_commissions', v_total_commissions
  );
END;
$$;
