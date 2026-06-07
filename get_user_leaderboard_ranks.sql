-- ====================================================================
-- SKRIP LEADERBOARD RANK USER
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_user_leaderboard_ranks(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle public.leaderboard_cycles;
  v_shortlink_rank INT := NULL;
  v_faucet_rank INT := NULL;
  v_referral_rank INT := NULL;
  v_shortlink_points INT := 0;
  v_faucet_points INT := 0;
  v_referral_count INT := 0;
BEGIN
  -- Dapatkan atau inisialisasi siklus aktif
  v_cycle := public.get_or_create_active_leaderboard_cycle();

  -- 1. Hitung peringkat Shortlink untuk user ini
  SELECT rank, total_points INTO v_shortlink_rank, v_shortlink_points
  FROM (
    SELECT 
      c.user_id,
      COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank
    FROM public.shortlink_claims c
    WHERE c.status = 'completed'
      AND c.completed_at >= v_cycle.start_at
      AND c.completed_at <= v_cycle.end_at
    GROUP BY c.user_id
  ) t
  WHERE t.user_id = p_user_id;

  -- 2. Hitung peringkat Faucet untuk user ini
  SELECT rank, total_points INTO v_faucet_rank, v_faucet_points
  FROM (
    SELECT 
      c.user_id,
      COALESCE(SUM(c.amount), 0)::INT AS total_points,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.amount), 0) DESC, MAX(c.claimed_at) ASC)::INT AS rank
    FROM public.faucet_claims c
    WHERE c.claimed_at >= v_cycle.start_at
      AND c.claimed_at <= v_cycle.end_at
    GROUP BY c.user_id
  ) t
  WHERE t.user_id = p_user_id;

  -- 3. Hitung peringkat Referral untuk user ini
  SELECT rank, total_referrals INTO v_referral_rank, v_referral_count
  FROM (
    SELECT 
      ref.referred_by_id AS user_id,
      COUNT(ref.id)::INT AS total_referrals,
      ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT AS rank
    FROM public.profiles ref
    WHERE ref.referred_by_id IS NOT NULL
      AND ref.created_at >= v_cycle.start_at
      AND ref.created_at <= v_cycle.end_at
      AND ref.xp >= 100
    GROUP BY ref.referred_by_id
  ) t
  WHERE t.user_id = p_user_id;

  RETURN json_build_object(
    'shortlink_rank', v_shortlink_rank,
    'shortlink_points', COALESCE(v_shortlink_points, 0),
    'faucet_rank', v_faucet_rank,
    'faucet_points', COALESCE(v_faucet_points, 0),
    'referral_rank', v_referral_rank,
    'referral_count', COALESCE(v_referral_count, 0)
  );
END;
$$;
