-- ====================================================================
-- SKRIP PEMISAHAN LEADERBOARD FAUCET & SHORTLINK
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Tambah kolom baru pada leaderboard_settings jika belum ada
ALTER TABLE public.leaderboard_settings ADD COLUMN IF NOT EXISTS faucet_limit INT DEFAULT 20;
ALTER TABLE public.leaderboard_settings ADD COLUMN IF NOT EXISTS faucet_rewards INT[] DEFAULT ARRAY[200000, 150000, 100000, 75000, 60000, 50000, 45000, 40000, 35000, 30000, 20000, 20000, 20000, 20000, 20000, 15000, 15000, 15000, 15000, 15000];
ALTER TABLE public.leaderboard_settings ADD COLUMN IF NOT EXISTS shortlink_limit INT DEFAULT 10;
ALTER TABLE public.leaderboard_settings ADD COLUMN IF NOT EXISTS shortlink_rewards INT[] DEFAULT ARRAY[300000, 200000, 150000, 100000, 75000, 50000, 40000, 35000, 30000, 20000];

-- Inisialisasi data default pada record id = 1 jika bernilai null
UPDATE public.leaderboard_settings
SET faucet_limit = COALESCE(faucet_limit, 20),
    faucet_rewards = COALESCE(faucet_rewards, ARRAY[200000, 150000, 100000, 75000, 60000, 50000, 45000, 40000, 35000, 30000, 20000, 20000, 20000, 20000, 20000, 15000, 15000, 15000, 15000, 15000]),
    shortlink_limit = COALESCE(shortlink_limit, 10),
    shortlink_rewards = COALESCE(shortlink_rewards, ARRAY[300000, 200000, 150000, 100000, 75000, 50000, 40000, 35000, 30000, 20000])
WHERE id = 1;

-- 2. Perbarui check constraint pada leaderboard_winners agar mengizinkan tipe 'faucet' dan 'shortlink' secara terpisah
ALTER TABLE public.leaderboard_winners DROP CONSTRAINT IF EXISTS leaderboard_winners_leaderboard_type_check;
ALTER TABLE public.leaderboard_winners ADD CONSTRAINT leaderboard_winners_leaderboard_type_check 
  CHECK (leaderboard_type IN ('faucet_shortlink', 'faucet', 'shortlink', 'referral', 'offerwall'));

-- 3. Hapus fungsi lama yang mungkin memiliki tanda tangan (signature) berbeda
DROP FUNCTION IF EXISTS public.update_leaderboard_settings(UUID, INT, INT[], INT, INT[], INT, INT[]);
DROP FUNCTION IF EXISTS public.get_leaderboards();
DROP FUNCTION IF EXISTS public.get_leaderboards(UUID);

-- 4. Buat RPC fungsi baru untuk update pengaturan leaderboard oleh Admin (terpisah)
CREATE OR REPLACE FUNCTION public.update_leaderboard_settings(
  p_admin_id UUID,
  p_faucet_limit INT,
  p_faucet_rewards INT[],
  p_shortlink_limit INT,
  p_shortlink_rewards INT[],
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
  -- Verifikasi hak akses admin
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = p_admin_id LIMIT 1;
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN json_build_object('success', false, 'message', 'Access denied. Admin privileges required.');
  END IF;

  -- Simpan/update data settings
  INSERT INTO public.leaderboard_settings (
    id,
    faucet_limit,
    faucet_rewards,
    shortlink_limit,
    shortlink_rewards,
    referral_limit,
    referral_rewards,
    offerwall_limit,
    offerwall_rewards
  )
  VALUES (
    1,
    p_faucet_limit,
    p_faucet_rewards,
    p_shortlink_limit,
    p_shortlink_rewards,
    p_referral_limit,
    p_referral_rewards,
    p_offerwall_limit,
    p_offerwall_rewards
  )
  ON CONFLICT (id) DO UPDATE
  SET faucet_limit = EXCLUDED.faucet_limit,
      faucet_rewards = EXCLUDED.faucet_rewards,
      shortlink_limit = EXCLUDED.shortlink_limit,
      shortlink_rewards = EXCLUDED.shortlink_rewards,
      referral_limit = EXCLUDED.referral_limit,
      referral_rewards = EXCLUDED.referral_rewards,
      offerwall_limit = EXCLUDED.offerwall_limit,
      offerwall_rewards = EXCLUDED.offerwall_rewards;

  RETURN json_build_object('success', true, 'message', 'Leaderboard settings saved successfully!');
END;
$$;

-- 5. Buat RPC fungsi baru untuk melakukan reset siklus secara manual oleh Admin (mengarsipkan terpisah)
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
  
  -- Verifikasi admin
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = p_admin_id LIMIT 1;
  IF NOT COALESCE(v_is_admin, FALSE) THEN
    RETURN json_build_object('success', false, 'message', 'Access denied. Admin privileges required.');
  END IF;

  -- Dapatkan siklus aktif saat ini
  SELECT * INTO v_active_cycle
  FROM public.leaderboard_cycles
  WHERE status = 'active'
  ORDER BY start_at DESC
  LIMIT 1;

  IF v_active_cycle.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'No active leaderboard cycle found.');
  END IF;

  -- Ambil setelan leaderboard
  SELECT * INTO v_settings FROM public.leaderboard_settings WHERE id = 1 LIMIT 1;
  IF v_settings.id IS NULL THEN
    INSERT INTO public.leaderboard_settings (id) VALUES (1) RETURNING * INTO v_settings;
  END IF;

  -- Tandai siklus lama selesai
  UPDATE public.leaderboard_cycles
  SET status = 'completed',
      end_at = v_now
  WHERE id = v_active_cycle.id;

  -- A. Rekam & arsipkan pemenang Faucet
  INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
  SELECT 
    v_active_cycle.id,
    'faucet',
    p.id,
    p.username,
    t.total_points,
    t.rank,
    COALESCE(v_settings.faucet_rewards[t.rank], 0)
  FROM (
    SELECT 
      c.user_id,
      COALESCE(SUM(c.amount), 0)::INT AS total_points,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.amount), 0) DESC, MAX(c.claimed_at) ASC)::INT AS rank
    FROM public.faucet_claims c
    WHERE c.claimed_at >= v_active_cycle.start_at
      AND c.claimed_at <= v_now
    GROUP BY c.user_id
    HAVING SUM(c.amount) > 0
  ) t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.rank <= v_settings.faucet_limit;

  -- B. Rekam & arsipkan pemenang Shortlink
  INSERT INTO public.leaderboard_winners (cycle_id, leaderboard_type, user_id, username, score, rank, reward_points)
  SELECT 
    v_active_cycle.id,
    'shortlink',
    p.id,
    p.username,
    t.total_points,
    t.rank,
    COALESCE(v_settings.shortlink_rewards[t.rank], 0)
  FROM (
    SELECT 
      c.user_id,
      COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank
    FROM public.shortlink_claims c
    WHERE c.status = 'completed'
      AND c.completed_at >= v_active_cycle.start_at
      AND c.completed_at <= v_now
    GROUP BY c.user_id
    HAVING SUM(c.points_reward) > 0
  ) t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.rank <= v_settings.shortlink_limit;

  -- C. Rekam & arsipkan pemenang Referral
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
      AND ref.xp >= 500
    GROUP BY ref.referred_by_id
    HAVING COUNT(ref.id) > 0
  ) t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.rank <= v_settings.referral_limit;

  -- D. Rekam & arsipkan pemenang Offerwall
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
      user_id,
      total_points,
      ROW_NUMBER() OVER (ORDER BY total_points DESC, last_activity_at ASC)::INT AS rank
    FROM (
      SELECT 
        user_id,
        SUM(points)::INT AS total_points,
        MAX(last_activity_at) AS last_activity_at
      FROM (
        SELECT 
          c.user_id,
          SUM(c.points_reward - COALESCE(c.boost_points_added, 0))::INT AS points,
          MAX(c.completed_at) AS last_activity_at
        FROM public.offerwall_claims c
        WHERE c.status = 'completed'
          AND c.completed_at >= v_active_cycle.start_at
          AND c.completed_at <= v_now
        GROUP BY c.user_id
        
        UNION ALL
        
        SELECT 
          l.user_id,
          SUM(l.points_boosted)::INT AS points,
          MAX(l.created_at) AS last_activity_at
        FROM public.offerwall_booster_logs l
        WHERE l.created_at >= v_active_cycle.start_at
          AND l.created_at <= v_now
        GROUP BY l.user_id
      ) sub2
      GROUP BY user_id
    ) sub
    WHERE total_points > 0
  ) t
  JOIN public.profiles p ON t.user_id = p.id
  WHERE t.rank <= v_settings.offerwall_limit;

  -- Buat siklus baru mulai dari sekarang
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

-- 6. Perbarui fungsi RPC utama untuk memuat data Leaderboard (Aktif & Riwayat) terpisah
CREATE OR REPLACE FUNCTION public.get_leaderboards(p_user_id UUID DEFAULT NULL)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle public.leaderboard_cycles;
  v_faucet_leaderboard JSON;
  v_shortlink_leaderboard JSON;
  v_referral_leaderboard JSON;
  v_offerwall_leaderboard JSON;
  v_past_cycles JSON;
  v_past_winners JSON;
  v_settings JSON;

  -- Stats spesifik untuk user
  v_user_faucet_score INT := 0;
  v_user_faucet_claims INT := 0;
  v_user_faucet_rank INT := NULL;

  v_user_shortlink_score INT := 0;
  v_user_shortlink_claims INT := 0;
  v_user_shortlink_rank INT := NULL;

  v_user_referral_score INT := 0;
  v_user_referral_rank INT := NULL;

  v_user_offerwall_score INT := 0;
  v_user_offerwall_claims INT := 0;
  v_user_offerwall_rank INT := NULL;
BEGIN
  -- Dapatkan atau inisialisasi siklus aktif
  v_cycle := public.get_or_create_active_leaderboard_cycle();

  -- Ambil settings aktif
  SELECT row_to_json(s) INTO v_settings FROM public.leaderboard_settings s WHERE id = 1 LIMIT 1;
  IF v_settings IS NULL THEN
    INSERT INTO public.leaderboard_settings (id) VALUES (1);
    SELECT row_to_json(s) INTO v_settings FROM public.leaderboard_settings s WHERE id = 1 LIMIT 1;
  END IF;

  -- A. Leaderboard Faucet Aktif
  SELECT json_agg(t) INTO v_faucet_leaderboard
  FROM (
    SELECT 
      p.username,
      COALESCE(f.faucet_points, 0)::INT AS total_points,
      COALESCE(f.faucet_claims, 0)::INT AS total_claims,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(f.faucet_points, 0) DESC, 
        f.last_claimed_at ASC
      )::INT AS rank,
      COALESCE(s.faucet_rewards[ROW_NUMBER() OVER (
        ORDER BY COALESCE(f.faucet_points, 0) DESC, 
        f.last_claimed_at ASC
      )::INT], 0) AS estimated_prize
    FROM public.profiles p
    JOIN (
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
    CROSS JOIN public.leaderboard_settings s
    WHERE s.id = 1 AND COALESCE(f.faucet_points, 0) > 0
    ORDER BY total_points DESC, f.last_claimed_at ASC
    LIMIT (SELECT faucet_limit FROM public.leaderboard_settings WHERE id = 1)
  ) t;

  -- B. Leaderboard Shortlink Aktif
  SELECT json_agg(t) INTO v_shortlink_leaderboard
  FROM (
    SELECT 
      p.username,
      COALESCE(sl.shortlink_points, 0)::INT AS total_points,
      COALESCE(sl.shortlink_claims, 0)::INT AS total_claims,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(sl.shortlink_points, 0) DESC, 
        sl.last_completed_at ASC
      )::INT AS rank,
      COALESCE(s.shortlink_rewards[ROW_NUMBER() OVER (
        ORDER BY COALESCE(sl.shortlink_points, 0) DESC, 
        sl.last_completed_at ASC
      )::INT], 0) AS estimated_prize
    FROM public.profiles p
    JOIN (
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
    ) sl ON p.id = sl.user_id
    CROSS JOIN public.leaderboard_settings s
    WHERE s.id = 1 AND COALESCE(sl.shortlink_points, 0) > 0
    ORDER BY total_points DESC, sl.last_completed_at ASC
    LIMIT (SELECT shortlink_limit FROM public.leaderboard_settings WHERE id = 1)
  ) t;

  -- C. Leaderboard Referral Aktif
  SELECT json_agg(t) INTO v_referral_leaderboard
  FROM (
    SELECT 
      p.username,
      COUNT(ref.id)::INT AS total_referrals,
      ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT AS rank,
      COALESCE(s.referral_rewards[ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT], 0) AS estimated_prize
    FROM public.profiles p
    JOIN public.profiles ref ON p.id = ref.referred_by_id
    CROSS JOIN public.leaderboard_settings s
    WHERE s.id = 1
      AND ref.referred_by_id IS NOT NULL
      AND ref.created_at >= v_cycle.start_at
      AND ref.created_at <= v_cycle.end_at
      AND ref.xp >= 500
    GROUP BY p.id, p.username, s.referral_rewards
    HAVING COUNT(ref.id) > 0
    ORDER BY total_referrals DESC, MAX(ref.created_at) ASC
    LIMIT (SELECT referral_limit FROM public.leaderboard_settings WHERE id = 1)
  ) t;

  -- D. Leaderboard Offerwall Aktif
  SELECT json_agg(t) INTO v_offerwall_leaderboard
  FROM (
    SELECT 
      p.username,
      u.total_points::INT AS total_points,
      u.total_claims::INT AS total_claims,
      ROW_NUMBER() OVER (
        ORDER BY u.total_points DESC, 
        u.last_activity_at ASC
      )::INT AS rank,
      COALESCE(
        s.offerwall_rewards[
          ROW_NUMBER() OVER (
            ORDER BY u.total_points DESC, 
            u.last_activity_at ASC
          )::INT
        ], 
        0
      ) AS estimated_prize
    FROM public.profiles p
    JOIN (
      SELECT 
        user_id,
        SUM(points)::INT AS total_points,
        SUM(claims)::INT AS total_claims,
        MAX(last_activity_at) AS last_activity_at
      FROM (
        SELECT 
          c.user_id,
          SUM(c.points_reward - COALESCE(c.boost_points_added, 0))::INT AS points,
          COUNT(c.id)::INT AS claims,
          MAX(c.completed_at) AS last_activity_at
        FROM public.offerwall_claims c
        WHERE c.status = 'completed'
          AND c.completed_at >= v_cycle.start_at
          AND c.completed_at <= v_cycle.end_at
        GROUP BY c.user_id
        
        UNION ALL
        
        SELECT 
          l.user_id,
          SUM(l.points_boosted)::INT AS points,
          0::INT AS claims,
          MAX(l.created_at) AS last_activity_at
        FROM public.offerwall_booster_logs l
        WHERE l.created_at >= v_cycle.start_at
          AND l.created_at <= v_cycle.end_at
        GROUP BY l.user_id
      ) sub
      GROUP BY user_id
    ) u ON p.id = u.user_id
    CROSS JOIN public.leaderboard_settings s
    WHERE s.id = 1 AND u.total_points > 0
    ORDER BY total_points DESC, u.last_activity_at ASC
    LIMIT (SELECT offerwall_limit FROM public.leaderboard_settings WHERE id = 1)
  ) t;

  -- E. Ambil daftar siklus lama
  SELECT json_agg(t) INTO v_past_cycles
  FROM (
    SELECT id, start_at, end_at
    FROM public.leaderboard_cycles
    WHERE status = 'completed'
    ORDER BY end_at DESC
  ) t;

  -- F. Ambil pemenang siklus lama
  SELECT json_agg(t) INTO v_past_winners
  FROM (
    SELECT id, cycle_id, leaderboard_type, username, score, rank, reward_points, payout_status
    FROM public.leaderboard_winners
    ORDER BY cycle_id DESC, leaderboard_type ASC, rank ASC
  ) t;

  -- G. Statistik Spesifik User
  IF p_user_id IS NOT NULL THEN
    -- Faucet
    SELECT total_points, total_claims, rank 
    INTO v_user_faucet_score, v_user_faucet_claims, v_user_faucet_rank
    FROM (
      SELECT 
        p.id AS user_id,
        COALESCE(f.faucet_points, 0)::INT AS total_points,
        COALESCE(f.faucet_claims, 0)::INT AS total_claims,
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(f.faucet_points, 0) DESC, 
          f.last_claimed_at ASC
        )::INT AS rank
      FROM public.profiles p
      JOIN (
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
    ) r
    WHERE user_id = p_user_id;

    -- Shortlink
    SELECT total_points, total_claims, rank 
    INTO v_user_shortlink_score, v_user_shortlink_claims, v_user_shortlink_rank
    FROM (
      SELECT 
        p.id AS user_id,
        COALESCE(sl.shortlink_points, 0)::INT AS total_points,
        COALESCE(sl.shortlink_claims, 0)::INT AS total_claims,
        ROW_NUMBER() OVER (
          ORDER BY COALESCE(sl.shortlink_points, 0) DESC, 
          sl.last_completed_at ASC
        )::INT AS rank
      FROM public.profiles p
      JOIN (
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
      ) sl ON p.id = sl.user_id
    ) r
    WHERE user_id = p_user_id;

    -- Referral
    SELECT total_referrals, rank 
    INTO v_user_referral_score, v_user_referral_rank
    FROM (
      SELECT 
        ref.referred_by_id AS user_id,
        COUNT(ref.id)::INT AS total_referrals,
        ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC, MAX(ref.created_at) ASC)::INT AS rank
      FROM public.profiles ref
      WHERE ref.referred_by_id IS NOT NULL
        AND ref.created_at >= v_cycle.start_at
        AND ref.created_at <= v_cycle.end_at
        AND ref.xp >= 500
      GROUP BY ref.referred_by_id
    ) r
    WHERE user_id = p_user_id;

    -- Offerwall
    SELECT total_points, total_claims, rank 
    INTO v_user_offerwall_score, v_user_offerwall_claims, v_user_offerwall_rank
    FROM (
      SELECT 
        user_id,
        total_points,
        total_claims,
        ROW_NUMBER() OVER (
          ORDER BY total_points DESC, 
          last_activity_at ASC
        )::INT AS rank
      FROM (
        SELECT 
          user_id,
          SUM(points)::INT AS total_points,
          SUM(claims)::INT AS total_claims,
          MAX(last_activity_at) AS last_activity_at
        FROM (
          SELECT 
            c.user_id,
            SUM(c.points_reward - COALESCE(c.boost_points_added, 0))::INT AS points,
            COUNT(c.id)::INT AS claims,
            MAX(c.completed_at) AS last_activity_at
          FROM public.offerwall_claims c
          WHERE c.status = 'completed'
            AND c.completed_at >= v_cycle.start_at
            AND c.completed_at <= v_cycle.end_at
          GROUP BY c.user_id
          
          UNION ALL
          
          SELECT 
            l.user_id,
            SUM(l.points_boosted)::INT AS points,
            0::INT AS claims,
            MAX(l.created_at) AS last_activity_at
          FROM public.offerwall_booster_logs l
          WHERE l.created_at >= v_cycle.start_at
            AND l.created_at <= v_cycle.end_at
          GROUP BY l.user_id
        ) sub2
        GROUP BY user_id
      ) sub
    ) r
    WHERE user_id = p_user_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'cycle_id', v_cycle.id,
    'start_at', v_cycle.start_at,
    'end_at', v_cycle.end_at,
    'faucet_leaderboard', COALESCE(v_faucet_leaderboard, '[]'::JSON),
    'shortlink_leaderboard', COALESCE(v_shortlink_leaderboard, '[]'::JSON),
    'referral_leaderboard', COALESCE(v_referral_leaderboard, '[]'::JSON),
    'offerwall_leaderboard', COALESCE(v_offerwall_leaderboard, '[]'::JSON),
    'past_cycles', COALESCE(v_past_cycles, '[]'::JSON),
    'past_winners', COALESCE(v_past_winners, '[]'::JSON),
    'settings', v_settings,
    'user_stats', json_build_object(
      'faucet', json_build_object(
        'score', COALESCE(v_user_faucet_score, 0),
        'claims', COALESCE(v_user_faucet_claims, 0),
        'rank', v_user_faucet_rank
      ),
      'shortlink', json_build_object(
        'score', COALESCE(v_user_shortlink_score, 0),
        'claims', COALESCE(v_user_shortlink_claims, 0),
        'rank', v_user_shortlink_rank
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

-- 7. Perbarui fungsi rank individual user
CREATE OR REPLACE FUNCTION public.get_user_leaderboard_ranks(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_cycle public.leaderboard_cycles;
  v_faucet_rank INT := NULL;
  v_faucet_points INT := 0;
  v_shortlink_rank INT := NULL;
  v_shortlink_points INT := 0;
  v_offerwall_rank INT := NULL;
  v_offerwall_points INT := 0;
  v_referral_rank INT := NULL;
  v_referral_count INT := 0;
BEGIN
  -- Dapatkan atau inisialisasi siklus aktif
  v_cycle := public.get_or_create_active_leaderboard_cycle();

  -- Faucet rank
  SELECT rank, total_points INTO v_faucet_rank, v_faucet_points
  FROM (
    SELECT 
      p.id AS user_id,
      COALESCE(f.faucet_points, 0)::INT AS total_points,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(f.faucet_points, 0) DESC, 
        f.last_claimed_at ASC
      )::INT AS rank
    FROM public.profiles p
    JOIN (
      SELECT 
        user_id,
        SUM(amount) AS faucet_points,
        MAX(claimed_at) AS last_claimed_at
      FROM public.faucet_claims
      WHERE claimed_at >= v_cycle.start_at
        AND claimed_at <= v_cycle.end_at
      GROUP BY user_id
    ) f ON p.id = f.user_id
  ) t
  WHERE t.user_id = p_user_id;

  -- Shortlink rank
  SELECT rank, total_points INTO v_shortlink_rank, v_shortlink_points
  FROM (
    SELECT 
      p.id AS user_id,
      COALESCE(s.shortlink_points, 0)::INT AS total_points,
      ROW_NUMBER() OVER (
        ORDER BY COALESCE(s.shortlink_points, 0) DESC, 
        s.last_completed_at ASC
      )::INT AS rank
    FROM public.profiles p
    JOIN (
      SELECT 
        user_id,
        SUM(points_reward) AS shortlink_points,
        MAX(completed_at) AS last_completed_at
      FROM public.shortlink_claims
      WHERE status = 'completed'
        AND completed_at >= v_cycle.start_at
        AND completed_at <= v_cycle.end_at
      GROUP BY user_id
    ) s ON p.id = s.user_id
  ) t
  WHERE t.user_id = p_user_id;

  -- Offerwall rank
  SELECT rank, total_points INTO v_offerwall_rank, v_offerwall_points
  FROM (
    SELECT 
      c.user_id,
      COALESCE(SUM(c.points_reward), 0)::INT AS total_points,
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC, MAX(c.completed_at) ASC)::INT AS rank
    FROM public.offerwall_claims c
    WHERE c.status = 'completed'
      AND c.completed_at >= v_cycle.start_at
      AND c.completed_at <= v_cycle.end_at
    GROUP BY c.user_id
  ) t
  WHERE t.user_id = p_user_id;

  -- Referral rank
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
      AND ref.xp >= 500
    GROUP BY ref.referred_by_id
  ) t
  WHERE t.user_id = p_user_id;

  RETURN json_build_object(
    'faucet_rank', v_faucet_rank,
    'faucet_points', COALESCE(v_faucet_points, 0),
    'shortlink_rank', v_shortlink_rank,
    'shortlink_points', COALESCE(v_shortlink_points, 0),
    'offerwall_rank', v_offerwall_rank,
    'offerwall_points', COALESCE(v_offerwall_points, 0),
    'referral_rank', v_referral_rank,
    'referral_count', COALESCE(v_referral_count, 0)
  );
END;
$$;
