-- ====================================================================
-- MIGRATION SCRIPT: LEADERBOARD CYCLE TO 7 DAYS & REWARD ADJUSTMENT
-- ====================================================================

-- 1. Perbarui reward rank leaderboard untuk Offerwall dan Referral (Opsi 1: Top 10 Dibagi 4)
CREATE OR REPLACE FUNCTION public.get_leaderboard_rank_reward(p_type TEXT, p_rank INT)
RETURNS INT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_type = 'faucet_shortlink' THEN
    CASE p_rank
      WHEN 1 THEN RETURN 200000;
      WHEN 2 THEN RETURN 150000;
      WHEN 3 THEN RETURN 100000;
      WHEN 4 THEN RETURN 75000;
      WHEN 5 THEN RETURN 60000;
      WHEN 6 THEN RETURN 50000;
      WHEN 7 THEN RETURN 45000;
      WHEN 8 THEN RETURN 40000;
      WHEN 9 THEN RETURN 35000;
      WHEN 10 THEN RETURN 30000;
      WHEN 11 THEN RETURN 20000;
      WHEN 12 THEN RETURN 20000;
      WHEN 13 THEN RETURN 20000;
      WHEN 14 THEN RETURN 20000;
      WHEN 15 THEN RETURN 20000;
      WHEN 16 THEN RETURN 15000;
      WHEN 17 THEN RETURN 15000;
      WHEN 18 THEN RETURN 15000;
      WHEN 19 THEN RETURN 15000;
      WHEN 20 THEN RETURN 15000;
      ELSE RETURN 0;
    END CASE;
  ELSE -- 'offerwall' atau 'referral'
    CASE p_rank
      WHEN 1 THEN RETURN 75000;
      WHEN 2 THEN RETURN 50000;
      WHEN 3 THEN RETURN 37500;
      WHEN 4 THEN RETURN 25000;
      WHEN 5 THEN RETURN 18750;
      WHEN 6 THEN RETURN 12500;
      WHEN 7 THEN RETURN 10000;
      WHEN 8 THEN RETURN 8750;
      WHEN 9 THEN RETURN 7500;
      WHEN 10 THEN RETURN 5000;
      ELSE RETURN 0;
    END CASE;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 2. Perbarui fungsi RPC untuk mengelola siklus aktif & pengarsipan pemenang otomatis saat reset (Siklus 7 Hari)
CREATE OR REPLACE FUNCTION public.get_or_create_active_leaderboard_cycle()
RETURNS public.leaderboard_cycles
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_active_cycle public.leaderboard_cycles;
  v_now TIMESTAMP WITH TIME ZONE;
BEGIN
  v_now := now();

  -- Ambil siklus yang aktif saat ini
  SELECT * INTO v_active_cycle
  FROM public.leaderboard_cycles
  WHERE status = 'active'
  ORDER BY start_at DESC
  LIMIT 1;

  -- Jika belum ada siklus sama sekali, buat siklus pertama (7 hari)
  IF v_active_cycle.id IS NULL THEN
    INSERT INTO public.leaderboard_cycles (start_at, end_at, status)
    VALUES (v_now, v_now + INTERVAL '7 days', 'active')
    RETURNING * INTO v_active_cycle;
    
  -- Jika waktu siklus aktif saat ini sudah melewati batas akhir, tutup & arsipkan pemenang
  ELSIF v_now > v_active_cycle.end_at THEN
    -- A. Tandai siklus lama selesai
    UPDATE public.leaderboard_cycles
    SET status = 'completed'
    WHERE id = v_active_cycle.id;

    -- B. Arsipkan pemenang Faucet & Shortlink Top 20
    INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
    SELECT 
      v_active_cycle.id,
      'faucet_shortlink',
      p.id,
      p.username,
      t.total_points,
      t.rank,
      public.get_leaderboard_rank_reward('faucet_shortlink', t.rank)
    FROM (
      SELECT 
        p.id AS user_id,
        (COALESCE(f.faucet_points, 0) + COALESCE(s.shortlink_points, 0))::INT AS total_points,
        ROW_NUMBER() OVER (
          ORDER BY (COALESCE(f.faucet_points, 0) + COALESCE(s.shortlink_points, 0)) DESC, 
          GREATEST(f.last_claimed_at, s.last_completed_at) ASC
        )::INT AS rank
      FROM public.profiles p
      LEFT JOIN (
        SELECT 
          user_id,
          SUM(amount) AS faucet_points,
          MAX(claimed_at) AS last_claimed_at
        FROM public.faucet_claims
        WHERE claimed_at >= v_active_cycle.start_at
          AND claimed_at <= v_active_cycle.end_at
        GROUP BY user_id
      ) f ON p.id = f.user_id
      LEFT JOIN (
        SELECT 
          user_id,
          SUM(points_reward) AS shortlink_points,
          MAX(completed_at) AS last_completed_at
        FROM public.shortlink_claims
        WHERE status = 'completed'
          AND completed_at >= v_active_cycle.start_at
          AND completed_at <= v_active_cycle.end_at
        GROUP BY user_id
      ) s ON p.id = s.user_id
      WHERE COALESCE(f.faucet_points, 0) > 0 OR COALESCE(s.shortlink_points, 0) > 0
    ) t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE t.rank <= 20;

    -- C. Arsipkan pemenang referral Top 10
    INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
    SELECT 
      v_active_cycle.id,
      'referral',
      p.id,
      p.username,
      t.total_referrals,
      t.rank,
      public.get_leaderboard_rank_reward('referral', t.rank)
    FROM (
      SELECT 
        ref.referred_by_id AS user_id,
        COUNT(ref.id)::INT AS total_referrals,
        ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT AS rank
      FROM public.profiles ref
      WHERE ref.referred_by_id IS NOT NULL
        AND ref.created_at >= v_active_cycle.start_at
        AND ref.created_at <= v_active_cycle.end_at
        AND ref.xp >= 100
      GROUP BY ref.referred_by_id
      HAVING COUNT(ref.id) > 0
    ) t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE t.rank <= 10;

    -- D. Arsipkan pemenang offerwall Top 10
    INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
    SELECT 
      v_active_cycle.id,
      'offerwall',
      p.id,
      p.username,
      t.total_points,
      t.rank,
      public.get_leaderboard_rank_reward('offerwall', t.rank)
    FROM (
      SELECT 
        c.user_id,
        COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank
      FROM public.offerwall_claims c
      WHERE c.status = 'completed'
        AND c.completed_at >= v_active_cycle.start_at
        AND c.completed_at <= v_active_cycle.end_at
      GROUP BY c.user_id
      HAVING SUM(c.points_reward) > 0
    ) t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE t.rank <= 10;

    -- E. Buat siklus baru mulai dari sekarang untuk 7 hari ke depan
    INSERT INTO public.leaderboard_cycles (start_at, end_at, status)
    VALUES (v_now, v_now + INTERVAL '7 days', 'active')
    RETURNING * INTO v_active_cycle;
  END IF;

  RETURN v_active_cycle;
END;
$$;

-- 3. Terapkan Opsi A: Sesuaikan siklus berjalan agar berakhir tepat 7 hari setelah waktu dimulainya
UPDATE public.leaderboard_cycles
SET end_at = start_at + INTERVAL '7 days'
WHERE status = 'active';
