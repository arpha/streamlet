-- ====================================================================
-- SKRIP SETUP DATABASE LEADERBOARD FAUCET & PENYESUAIAN REWARD
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Perbarui check constraint pada leaderboard_winners agar mengizinkan tipe 'faucet'
ALTER TABLE public.leaderboard_winners DROP CONSTRAINT IF EXISTS leaderboard_winners_leaderboard_type_check;
ALTER TABLE public.leaderboard_winners ADD CONSTRAINT leaderboard_winners_leaderboard_type_check CHECK (leaderboard_type IN ('shortlink', 'referral', 'faucet'));

-- 2. Perbarui fungsi reward untuk mendukung peringkat 1-20
CREATE OR REPLACE FUNCTION public.get_leaderboard_rank_reward(p_rank INT)
RETURNS INT
IMMUTABLE
SECURITY DEFINER
AS $$
BEGIN
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
END;
$$ LANGUAGE plpgsql;

-- 3. Perbarui fungsi RPC untuk mengelola siklus aktif & pengarsipan pemenang otomatis saat reset
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

  -- Jika belum ada siklus sama sekali, buat siklus pertama
  IF v_active_cycle.id IS NULL THEN
    INSERT INTO public.leaderboard_cycles (start_at, end_at, status)
    VALUES (v_now, v_now + INTERVAL '30 days', 'active')
    RETURNING * INTO v_active_cycle;
    
  -- Jika waktu siklus aktif saat ini sudah melewati batas akhir, tutup & arsipkan pemenang
  ELSIF v_now > v_active_cycle.end_at THEN
    -- A. Tandai siklus lama selesai
    UPDATE public.leaderboard_cycles
    SET status = 'completed'
    WHERE id = v_active_cycle.id;

    -- B. Arsipkan pemenang shortlink Top 10
    INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
    SELECT 
      v_active_cycle.id,
      'shortlink',
      p.id,
      p.username,
      t.total_points,
      t.rank,
      public.get_leaderboard_rank_reward(t.rank)
    FROM (
      SELECT 
        c.user_id,
        COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank
      FROM public.shortlink_claims c
      WHERE c.status = 'completed'
        AND c.completed_at >= v_active_cycle.start_at
        AND c.completed_at <= v_active_cycle.end_at
      GROUP BY c.user_id
      HAVING SUM(c.points_reward) > 0
    ) t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE t.rank <= 10;

    -- C. Arsipkan pemenang referral Top 10
    INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
    SELECT 
      v_active_cycle.id,
      'referral',
      p.id,
      p.username,
      t.total_referrals,
      t.rank,
      public.get_leaderboard_rank_reward(t.rank)
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

    -- D. Arsipkan pemenang faucet Top 20
    INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
    SELECT 
      v_active_cycle.id,
      'faucet',
      p.id,
      p.username,
      t.total_points,
      t.rank,
      public.get_leaderboard_rank_reward(t.rank)
    FROM (
      SELECT 
        c.user_id,
        COALESCE(SUM(c.amount), 0)::INT AS total_points,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.amount), 0) DESC, MAX(c.claimed_at) ASC)::INT AS rank
      FROM public.faucet_claims c
      WHERE c.claimed_at >= v_active_cycle.start_at
        AND c.claimed_at <= v_active_cycle.end_at
      GROUP BY c.user_id
      HAVING SUM(c.amount) > 0
    ) t
    JOIN public.profiles p ON t.user_id = p.id
    WHERE t.rank <= 20;

    -- E. Buat siklus baru mulai dari sekarang untuk 30 hari ke depan
    INSERT INTO public.leaderboard_cycles (start_at, end_at, status)
    VALUES (v_now, v_now + INTERVAL '30 days', 'active')
    RETURNING * INTO v_active_cycle;
  END IF;

  RETURN v_active_cycle;
END;
$$;

-- 4. Perbarui fungsi RPC utama untuk memuat data Leaderboard (Aktif & Riwayat)
CREATE OR REPLACE FUNCTION public.get_leaderboards()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle public.leaderboard_cycles;
  v_shortlink_leaderboard JSON;
  v_referral_leaderboard JSON;
  v_faucet_leaderboard JSON;
  v_past_cycles JSON;
  v_past_winners JSON;
BEGIN
  -- A. Dapatkan atau inisialisasi siklus aktif
  v_cycle := public.get_or_create_active_leaderboard_cycle();

  -- B. Buat leaderboard shortlink aktif (Top 10)
  SELECT json_agg(t) INTO v_shortlink_leaderboard
  FROM (
    SELECT 
      p.username,
      COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
      COUNT(c.id)::INT AS total_claims,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank,
      public.get_leaderboard_rank_reward(ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT) AS estimated_prize
    FROM public.profiles p
    JOIN public.shortlink_claims c ON p.id = c.user_id
    WHERE c.status = 'completed'
      AND c.completed_at >= v_cycle.start_at
      AND c.completed_at <= v_cycle.end_at
    GROUP BY p.id, p.username
    HAVING SUM(c.points_reward) > 0
    ORDER BY total_points DESC, MAX(c.completed_at) ASC
    LIMIT 10
  ) t;

  -- C. Buat leaderboard referral aktif (Top 10)
  SELECT json_agg(t) INTO v_referral_leaderboard
  FROM (
    SELECT 
      p.username,
      COUNT(ref.id)::INT AS total_referrals,
      ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT AS rank,
      public.get_leaderboard_rank_reward(ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT) AS estimated_prize
    FROM public.profiles p
    JOIN public.profiles ref ON p.id = ref.referred_by_id
    WHERE ref.referred_by_id IS NOT NULL
      AND ref.created_at >= v_cycle.start_at
      AND ref.created_at <= v_cycle.end_at
      AND ref.xp >= 100
    GROUP BY p.id, p.username
    HAVING COUNT(ref.id) > 0
    ORDER BY total_referrals DESC, MAX(ref.created_at) ASC
    LIMIT 10
  ) t;

  -- D. Buat leaderboard faucet aktif (Top 20)
  SELECT json_agg(t) INTO v_faucet_leaderboard
  FROM (
    SELECT 
      p.username,
      COALESCE(SUM(c.amount), 0)::INT AS total_points,
      COUNT(c.id)::INT AS total_claims,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.amount), 0) DESC, MAX(c.claimed_at) ASC)::INT AS rank,
      public.get_leaderboard_rank_reward(ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.amount), 0) DESC, MAX(c.claimed_at) ASC)::INT) AS estimated_prize
    FROM public.profiles p
    JOIN public.faucet_claims c ON p.id = c.user_id
    WHERE c.claimed_at >= v_cycle.start_at
      AND c.claimed_at <= v_cycle.end_at
    GROUP BY p.id, p.username
    HAVING SUM(c.amount) > 0
    ORDER BY total_points DESC, MAX(c.claimed_at) ASC
    LIMIT 20
  ) t;

  -- E. Ambil daftar siklus lama yang sudah diselesaikan
  SELECT json_agg(t) INTO v_past_cycles
  FROM (
    SELECT id, start_at, end_at
    FROM public.leaderboard_cycles
    WHERE status = 'completed'
    ORDER BY end_at DESC
  ) t;

  -- F. Ambil pemenang dari siklus lama
  SELECT json_agg(t) INTO v_past_winners
  FROM (
    SELECT id, cycle_id, leaderboard_type, username, score, rank, reward_points, payout_status
    FROM public.leaderboard_winners
    ORDER BY cycle_id DESC, leaderboard_type ASC, rank ASC
  ) t;

  RETURN json_build_object(
    'success', true,
    'cycle_id', v_cycle.id,
    'start_at', v_cycle.start_at,
    'end_at', v_cycle.end_at,
    'shortlink_leaderboard', COALESCE(v_shortlink_leaderboard, '[]'::JSON),
    'referral_leaderboard', COALESCE(v_referral_leaderboard, '[]'::JSON),
    'faucet_leaderboard', COALESCE(v_faucet_leaderboard, '[]'::JSON),
    'past_cycles', COALESCE(v_past_cycles, '[]'::JSON),
    'past_winners', COALESCE(v_past_winners, '[]'::JSON)
  );
END;
$$;
