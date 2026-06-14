-- ====================================================================
-- SKRIP SETUP PENGATURAN LEADERBOARD MANUAL DAN HADIAH DINAMIS
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Buat tabel penyimpanan pengaturan leaderboard
CREATE TABLE IF NOT EXISTS public.leaderboard_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  faucet_shortlink_limit INT NOT NULL DEFAULT 20,
  faucet_shortlink_rewards INT[] NOT NULL DEFAULT '{200000, 150000, 100000, 75000, 60000, 50000, 45000, 40000, 35000, 30000, 20000, 20000, 20000, 20000, 20000, 15000, 15000, 15000, 15000, 15000}',
  referral_limit INT NOT NULL DEFAULT 10,
  referral_rewards INT[] NOT NULL DEFAULT '{300000, 200000, 150000, 100000, 75000, 50000, 40000, 35000, 30000, 20000}',
  offerwall_limit INT NOT NULL DEFAULT 10,
  offerwall_rewards INT[] NOT NULL DEFAULT '{300000, 200000, 150000, 100000, 75000, 50000, 40000, 35000, 30000, 20000}'
);

-- Masukkan data awal jika belum ada
INSERT INTO public.leaderboard_settings (id) 
VALUES (1) 
ON CONFLICT (id) DO NOTHING;

-- 2. Nonaktifkan alur auto-reset pada get_or_create_active_leaderboard_cycle
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

  -- Jika belum ada siklus sama sekali, buat siklus pertama (berlaku 30 hari ke depan)
  IF v_active_cycle.id IS NULL THEN
    INSERT INTO public.leaderboard_cycles (start_at, end_at, status)
    VALUES (v_now, v_now + INTERVAL '30 days', 'active')
    RETURNING * INTO v_active_cycle;
  END IF;

  RETURN v_active_cycle;
END;
$$;

-- 3. Buat RPC fungsi untuk mengupdate pengaturan leaderboard oleh Admin
CREATE OR REPLACE FUNCTION public.update_leaderboard_settings(
  p_admin_id UUID,
  p_faucet_shortlink_limit INT,
  p_faucet_shortlink_rewards INT[],
  p_referral_limit INT,
  p_referral_rewards INT[],
  p_offerwall_limit INT,
  p_offerwall_rewards INT[]
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- 1. Verifikasi hak akses admin
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = p_admin_id LIMIT 1;
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN json_build_object('success', false, 'message', 'Access denied. Admin privileges required.');
  END IF;

  -- 2. Lakukan penyimpanan/update
  INSERT INTO public.leaderboard_settings (
    id,
    faucet_shortlink_limit,
    faucet_shortlink_rewards,
    referral_limit,
    referral_rewards,
    offerwall_limit,
    offerwall_rewards
  )
  VALUES (
    1,
    p_faucet_shortlink_limit,
    p_faucet_shortlink_rewards,
    p_referral_limit,
    p_referral_rewards,
    p_offerwall_limit,
    p_offerwall_rewards
  )
  ON CONFLICT (id) DO UPDATE
  SET faucet_shortlink_limit = EXCLUDED.faucet_shortlink_limit,
      faucet_shortlink_rewards = EXCLUDED.faucet_shortlink_rewards,
      referral_limit = EXCLUDED.referral_limit,
      referral_rewards = EXCLUDED.referral_rewards,
      offerwall_limit = EXCLUDED.offerwall_limit,
      offerwall_rewards = EXCLUDED.offerwall_rewards;

  RETURN json_build_object('success', true, 'message', 'Leaderboard settings updated successfully!');
END;
$$;

-- 4. Buat RPC fungsi untuk melakukan reset siklus secara manual oleh Admin
CREATE OR REPLACE FUNCTION public.admin_reset_leaderboard_cycle(p_admin_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin BOOLEAN := FALSE;
  v_active_cycle public.leaderboard_cycles;
  v_settings public.leaderboard_settings;
  v_now TIMESTAMP WITH TIME ZONE;
  v_new_cycle public.leaderboard_cycles;
BEGIN
  v_now := now();
  
  -- 1. Verifikasi admin
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = p_admin_id LIMIT 1;
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN json_build_object('success', false, 'message', 'Access denied. Admin privileges required.');
  END IF;

  -- 2. Dapatkan siklus aktif saat ini
  SELECT * INTO v_active_cycle
  FROM public.leaderboard_cycles
  WHERE status = 'active'
  ORDER BY start_at DESC
  LIMIT 1;

  IF v_active_cycle.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'No active leaderboard cycle found.');
  END IF;

  -- 3. Ambil setelan leaderboard dari tabel settings
  SELECT * INTO v_settings FROM public.leaderboard_settings WHERE id = 1 LIMIT 1;
  IF v_settings.id IS NULL THEN
    INSERT INTO public.leaderboard_settings (id) VALUES (1) RETURNING * INTO v_settings;
  END IF;

  -- 4. Tandai siklus lama selesai
  UPDATE public.leaderboard_cycles
  SET status = 'completed',
      end_at = v_now
  WHERE id = v_active_cycle.id;

  -- 5. Rekam & arsipkan pemenang Faucet & Shortlink
  INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
  SELECT 
    v_active_cycle.id,
    'faucet_shortlink',
    p.id,
    p.username,
    t.total_points,
    t.rank,
    COALESCE(v_settings.faucet_shortlink_rewards[t.rank], 0)
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
        AND claimed_at <= v_now
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
        AND completed_at <= v_now
      GROUP BY user_id
    ) s ON p.id = s.user_id
    WHERE COALESCE(f.faucet_points, 0) > 0 OR COALESCE(s.shortlink_points, 0) > 0
  ) t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.rank <= v_settings.faucet_shortlink_limit;

  -- 6. Rekam & arsipkan pemenang Referral
  INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
  SELECT 
    v_active_cycle.id,
    'referral',
    p.id,
    p.username,
    t.total_referrals,
    t.rank,
    COALESCE(v_settings.referral_rewards[t.rank], 0)
  FROM (
    SELECT 
      ref.referred_by_id AS user_id,
      COUNT(ref.id)::INT AS total_referrals,
      ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT AS rank
    FROM public.profiles ref
    WHERE ref.referred_by_id IS NOT NULL
      AND ref.created_at >= v_active_cycle.start_at
      AND ref.created_at <= v_now
      AND ref.xp >= 1000
    GROUP BY ref.referred_by_id
    HAVING COUNT(ref.id) > 0
  ) t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.rank <= v_settings.referral_limit;

  -- 7. Rekam & arsipkan pemenang Offerwall
  INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
  SELECT 
    v_active_cycle.id,
    'offerwall',
    p.id,
    p.username,
    t.total_points,
    t.rank,
    COALESCE(v_settings.offerwall_rewards[t.rank], 0)
  FROM (
    SELECT 
      c.user_id,
      COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank
    FROM public.offerwall_claims c
    WHERE c.status = 'completed'
      AND c.completed_at >= v_active_cycle.start_at
      AND c.completed_at <= v_now
    GROUP BY c.user_id
    HAVING SUM(c.points_reward) > 0
  ) t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.rank <= v_settings.offerwall_limit;

  -- 8. Buat siklus baru mulai dari sekarang
  INSERT INTO public.leaderboard_cycles (start_at, end_at, status)
  VALUES (v_now, v_now + INTERVAL '30 days', 'active')
  RETURNING * INTO v_new_cycle;

  RETURN json_build_object(
    'success', true,
    'message', 'Leaderboard cycle successfully reset manually!',
    'old_cycle_id', v_active_cycle.id,
    'new_cycle_id', v_new_cycle.id
  );
END;
$$;

-- 5. Perbarui fungsi RPC utama untuk mengembalikan data Leaderboard beserta Settings aktif
DROP FUNCTION IF EXISTS public.get_leaderboards();

CREATE OR REPLACE FUNCTION public.get_leaderboards(p_user_id UUID DEFAULT NULL)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle public.leaderboard_cycles;
  v_faucet_shortlink_leaderboard JSON;
  v_referral_leaderboard JSON;
  v_offerwall_leaderboard JSON;
  v_past_cycles JSON;
  v_past_winners JSON;
  v_settings JSON;

  -- Stats khusus untuk user yang meminta
  v_user_faucet_shortlink_score INT := 0;
  v_user_faucet_shortlink_claims INT := 0;
  v_user_faucet_shortlink_rank INT := NULL;

  v_user_referral_score INT := 0;
  v_user_referral_rank INT := NULL;

  v_user_offerwall_score INT := 0;
  v_user_offerwall_claims INT := 0;
  v_user_offerwall_rank INT := NULL;
BEGIN
  -- A. Dapatkan atau inisialisasi siklus aktif
  v_cycle := public.get_or_create_active_leaderboard_cycle();

  -- B. Ambil settings aktif
  SELECT row_to_json(s) INTO v_settings FROM public.leaderboard_settings s WHERE id = 1 LIMIT 1;
  IF v_settings IS NULL THEN
    INSERT INTO public.leaderboard_settings (id) VALUES (1);
    SELECT row_to_json(s) INTO v_settings FROM public.leaderboard_settings s WHERE id = 1 LIMIT 1;
  END IF;

  -- C. Buat leaderboard Faucet & Shortlink aktif (Top 20/Sesuai Limit)
  SELECT json_agg(t) INTO v_faucet_shortlink_leaderboard
  FROM (
    SELECT 
      p.username,
      (COALESCE(f.faucet_points, 0) + COALESCE(s.shortlink_points, 0))::INT AS total_points,
      (COALESCE(f.faucet_claims, 0) + COALESCE(s.shortlink_claims, 0))::INT AS total_claims,
      ROW_NUMBER() OVER (
        ORDER BY (COALESCE(f.faucet_points, 0) + COALESCE(s.shortlink_points, 0)) DESC, 
        GREATEST(f.last_claimed_at, s.last_completed_at) ASC
      )::INT AS rank
    FROM public.profiles p
    LEFT JOIN (
      SELECT 
        user_id,
        SUM(amount) AS faucet_points,
        COUNT(id) AS faucet_claims,
        MAX(claimed_at) AS last_claimed_at
      FROM public.faucet_claims
      WHERE claimed_at >= v_cycle.start_at
        AND claimed_at <= v_cycle.end_at
      GROUP BY user_id
    ) f ON p.id = f.user_id
    LEFT JOIN (
      SELECT 
        user_id,
        SUM(points_reward) AS shortlink_points,
        COUNT(id) AS shortlink_claims,
        MAX(completed_at) AS last_completed_at
      FROM public.shortlink_claims
      WHERE status = 'completed'
        AND completed_at >= v_cycle.start_at
        AND completed_at <= v_cycle.end_at
      GROUP BY user_id
    ) s ON p.id = s.user_id
    WHERE COALESCE(f.faucet_points, 0) > 0 OR COALESCE(s.shortlink_points, 0) > 0
    ORDER BY total_points DESC, GREATEST(f.last_claimed_at, s.last_completed_at) ASC
    LIMIT (SELECT faucet_shortlink_limit FROM public.leaderboard_settings WHERE id = 1)
  ) t;

  -- D. Buat leaderboard referral aktif (Top 10/Sesuai Limit)
  SELECT json_agg(t) INTO v_referral_leaderboard
  FROM (
    SELECT 
      p.username,
      COUNT(ref.id)::INT AS total_referrals,
      ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT AS rank
    FROM public.profiles p
    JOIN public.profiles ref ON p.id = ref.referred_by_id
    WHERE ref.referred_by_id IS NOT NULL
      AND ref.created_at >= v_cycle.start_at
      AND ref.created_at <= v_cycle.end_at
      AND ref.xp >= 1000
    GROUP BY p.id, p.username
    HAVING COUNT(ref.id) > 0
    ORDER BY total_referrals DESC, MAX(ref.created_at) ASC
    LIMIT (SELECT referral_limit FROM public.leaderboard_settings WHERE id = 1)
  ) t;

  -- E. Buat leaderboard offerwall aktif (Top 10/Sesuai Limit)
  SELECT json_agg(t) INTO v_offerwall_leaderboard
  FROM (
    SELECT 
      p.username,
      COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
      COUNT(c.id)::INT AS total_claims,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank
    FROM public.profiles p
    JOIN public.offerwall_claims c ON p.id = c.user_id
    WHERE c.status = 'completed'
      AND c.completed_at >= v_cycle.start_at
      AND c.completed_at <= v_cycle.end_at
    GROUP BY p.id, p.username
    HAVING SUM(c.points_reward) > 0
    ORDER BY total_points DESC, MAX(c.completed_at) ASC
    LIMIT (SELECT offerwall_limit FROM public.leaderboard_settings WHERE id = 1)
  ) t;

  -- F. Ambil daftar siklus lama yang sudah diselesaikan
  SELECT json_agg(t) INTO v_past_cycles
  FROM (
    SELECT id, start_at, end_at
    FROM public.leaderboard_cycles
    WHERE status = 'completed'
    ORDER BY end_at DESC
  ) t;

  -- G. Ambil pemenang dari siklus lama
  SELECT json_agg(t) INTO v_past_winners
  FROM (
    SELECT id, cycle_id, leaderboard_type, username, score, rank, reward_points, payout_status
    FROM public.leaderboard_winners
    ORDER BY cycle_id DESC, leaderboard_type ASC, rank ASC
  ) t;

  -- H. Hitung statistik spesifik user jika p_user_id diberikan
  IF p_user_id IS NOT NULL THEN
    -- 1. Faucet & Shortlink
    SELECT total_points, total_claims, rank 
    INTO v_user_faucet_shortlink_score, v_user_faucet_shortlink_claims, v_user_faucet_shortlink_rank
    FROM (
      SELECT 
        p.id AS user_id,
        (COALESCE(f.faucet_points, 0) + COALESCE(s.shortlink_points, 0))::INT AS total_points,
        (COALESCE(f.faucet_claims, 0) + COALESCE(s.shortlink_claims, 0))::INT AS total_claims,
        ROW_NUMBER() OVER (
          ORDER BY (COALESCE(f.faucet_points, 0) + COALESCE(s.shortlink_points, 0)) DESC, 
          GREATEST(f.last_claimed_at, s.last_completed_at) ASC
        )::INT AS rank
      FROM public.profiles p
      LEFT JOIN (
        SELECT 
          user_id,
          SUM(amount) AS faucet_points,
          COUNT(id) AS faucet_claims,
          MAX(claimed_at) AS last_claimed_at
        FROM public.faucet_claims
        WHERE claimed_at >= v_cycle.start_at
          AND claimed_at <= v_cycle.end_at
        GROUP BY user_id
      ) f ON p.id = f.user_id
      LEFT JOIN (
        SELECT 
          user_id,
          SUM(points_reward) AS shortlink_points,
          COUNT(id) AS shortlink_claims,
          MAX(completed_at) AS last_completed_at
        FROM public.shortlink_claims
        WHERE status = 'completed'
          AND completed_at >= v_cycle.start_at
          AND completed_at <= v_cycle.end_at
        GROUP BY user_id
      ) s ON p.id = s.user_id
      WHERE COALESCE(f.faucet_points, 0) > 0 OR COALESCE(s.shortlink_points, 0) > 0
    ) r
    WHERE user_id = p_user_id;

    -- 2. Referral
    SELECT total_referrals, rank 
    INTO v_user_referral_score, v_user_referral_rank
    FROM (
      SELECT 
        p.id AS user_id,
        COUNT(ref.id)::INT AS total_referrals,
        ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT AS rank
      FROM public.profiles p
      JOIN public.profiles ref ON p.id = ref.referred_by_id
      WHERE ref.referred_by_id IS NOT NULL
        AND ref.created_at >= v_cycle.start_at
        AND ref.created_at <= v_cycle.end_at
        AND ref.xp >= 1000
      GROUP BY p.id
    ) r
    WHERE user_id = p_user_id;

    -- 3. Offerwall
    SELECT total_points, total_claims, rank 
    INTO v_user_offerwall_score, v_user_offerwall_claims, v_user_offerwall_rank
    FROM (
      SELECT 
        p.id AS user_id,
        COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
        COUNT(c.id)::INT AS total_claims,
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank
      FROM public.profiles p
      JOIN public.offerwall_claims c ON p.id = c.user_id
      WHERE c.status = 'completed'
        AND c.completed_at >= v_cycle.start_at
        AND c.completed_at <= v_cycle.end_at
      GROUP BY p.id
    ) r
    WHERE user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'cycle_id', v_cycle.id,
    'start_at', v_cycle.start_at,
    'end_at', v_cycle.end_at,
    'faucet_shortlink_leaderboard', COALESCE(v_faucet_shortlink_leaderboard, '[]'::JSON),
    'referral_leaderboard', COALESCE(v_referral_leaderboard, '[]'::JSON),
    'offerwall_leaderboard', COALESCE(v_offerwall_leaderboard, '[]'::JSON),
    'past_cycles', COALESCE(v_past_cycles, '[]'::JSON),
    'past_winners', COALESCE(v_past_winners, '[]'::JSON),
    'settings', v_settings,
    'user_stats', json_build_object(
      'faucet_shortlink', json_build_object(
        'score', COALESCE(v_user_faucet_shortlink_score, 0),
        'claims', COALESCE(v_user_faucet_shortlink_claims, 0),
        'rank', v_user_faucet_shortlink_rank
      ),
      'referral', json_build_object(
        'score', COALESCE(v_user_referral_score, 0),
        'rank', v_user_referral_rank
      ),
      'offerwall', json_build_object(
        'score', COALESCE(v_user_offerwall_score, 0),
        'claims', COALESCE(v_user_offerwall_claims, 0),
        'rank', v_user_offerwall_rank
      )
    )
  );
END;
$$;
