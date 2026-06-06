-- ====================================================================
-- SKRIP SETUP DATABASE LEADERBOARD & SISTEM PERSETUJUAN HADIAH (ADMIN)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Pastikan kolom created_at tersedia di profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- 2. Buat tabel pencatatan siklus leaderboard 30 hari
CREATE TABLE IF NOT EXISTS public.leaderboard_cycles (
  id SERIAL PRIMARY KEY,
  start_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed'))
);

-- Indeks untuk pencarian siklus aktif cepat
CREATE INDEX IF NOT EXISTS idx_leaderboard_cycles_status ON public.leaderboard_cycles(status);

-- 3. Fungsi pembantu untuk menentukan reward berdasarkan peringkat (Top 10)
CREATE OR REPLACE FUNCTION public.get_leaderboard_rank_reward(p_rank INT)
RETURNS INT
IMMUTABLE
SECURITY DEFINER
AS $$
BEGIN
  CASE p_rank
    WHEN 1 THEN RETURN 300000;
    WHEN 2 THEN RETURN 200000;
    WHEN 3 THEN RETURN 150000;
    WHEN 4 THEN RETURN 100000;
    WHEN 5 THEN RETURN 75000;
    WHEN 6 THEN RETURN 50000;
    WHEN 7 THEN RETURN 40000;
    WHEN 8 THEN RETURN 35000;
    WHEN 9 THEN RETURN 30000;
    WHEN 10 THEN RETURN 20000;
    ELSE RETURN 0;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- 4. Tabel penyimpanan pemenang leaderboard dari siklus sebelumnya
CREATE TABLE IF NOT EXISTS public.leaderboard_winners (
  id SERIAL PRIMARY KEY,
  cycle_id INT REFERENCES public.leaderboard_cycles(id) ON DELETE CASCADE,
  leaderboard_type TEXT NOT NULL CHECK (leaderboard_type IN ('shortlink', 'referral')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  score INT NOT NULL,
  rank INT NOT NULL,
  reward_points INT NOT NULL,
  payout_status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (payout_status IN ('pending_approval', 'approved', 'rejected')),
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indeks performa untuk winners
CREATE INDEX IF NOT EXISTS idx_leaderboard_winners_cycle_id ON public.leaderboard_winners(cycle_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_winners_payout_status ON public.leaderboard_winners(payout_status);

-- 5. Fungsi RPC untuk mengelola siklus aktif & pengarsipan pemenang otomatis saat reset
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
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC)::INT AS rank
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
        ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC)::INT AS rank
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

    -- D. Buat siklus baru mulai dari sekarang untuk 30 hari ke depan
    INSERT INTO public.leaderboard_cycles (start_at, end_at, status)
    VALUES (v_now, v_now + INTERVAL '30 days', 'active')
    RETURNING * INTO v_active_cycle;
  END IF;

  RETURN v_active_cycle;
END;
$$;

-- 6. Fungsi RPC untuk melakukan persetujuan hadiah pemenang individu oleh Admin
CREATE OR REPLACE FUNCTION public.approve_leaderboard_winner_payout(p_winner_id INT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_winner public.leaderboard_winners;
  v_new_balance NUMERIC;
BEGIN
  -- Ambil data pemenang dan kunci baris untuk mencegah double-spend
  SELECT * INTO v_winner
  FROM public.leaderboard_winners
  WHERE id = p_winner_id
  FOR UPDATE;

  IF v_winner.id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Winner data not found');
  END IF;

  IF v_winner.payout_status = 'approved' THEN
    RETURN json_build_object('success', false, 'message', 'Rewards for this winner have already been sent.');
  END IF;

  IF v_winner.reward_points <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'No reward points associated with this rank');
  END IF;

  -- A. Tambahkan saldo poin ke user yang menang
  UPDATE public.profiles
  SET balance = balance + v_winner.reward_points
  WHERE id = v_winner.user_id
  RETURNING balance INTO v_new_balance;

  -- B. Update status pemenang
  UPDATE public.leaderboard_winners
  SET payout_status = 'approved',
      paid_at = now()
  WHERE id = p_winner_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully sent ' || v_winner.reward_points || ' points to ' || v_winner.username,
    'new_balance', v_new_balance
  );
END;
$$;

-- 7. Fungsi RPC untuk menyetujui semua hadiah pemenang yang tertunda pada siklus tertentu sekaligus
CREATE OR REPLACE FUNCTION public.approve_leaderboard_payouts_for_cycle(p_cycle_id INT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_winner RECORD;
  v_count INT := 0;
  v_total_points INT := 0;
BEGIN
  FOR v_winner IN 
    SELECT id, user_id, username, reward_points 
    FROM public.leaderboard_winners
    WHERE cycle_id = p_cycle_id AND payout_status = 'pending_approval' AND reward_points > 0
  LOOP
    -- Panggil fungsi persetujuan individu
    PERFORM public.approve_leaderboard_winner_payout(v_winner.id);
    v_count := v_count + 1;
    v_total_points := v_total_points + v_winner.reward_points;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully approved and sent ' || v_total_points || ' points to ' || v_count || ' winners'
  );
END;
$$;

-- 8. Fungsi RPC utama untuk memuat data Leaderboard (Aktif & Riwayat)
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
      ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC)::INT AS rank,
      public.get_leaderboard_rank_reward(ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(c.points_reward), 0) DESC)::INT) AS estimated_prize
    FROM public.profiles p
    JOIN public.shortlink_claims c ON p.id = c.user_id
    WHERE c.status = 'completed'
      AND c.completed_at >= v_cycle.start_at
      AND c.completed_at <= v_cycle.end_at
    GROUP BY p.id, p.username
    HAVING SUM(c.points_reward) > 0
    ORDER BY total_points DESC
    LIMIT 10
  ) t;

  -- C. Buat leaderboard referral aktif (Top 10)
  SELECT json_agg(t) INTO v_referral_leaderboard
  FROM (
    SELECT 
      p.username,
      COUNT(ref.id)::INT AS total_referrals,
      ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC)::INT AS rank,
      public.get_leaderboard_rank_reward(ROW_NUMBER() OVER (ORDER BY COUNT(ref.id) DESC)::INT) AS estimated_prize
    FROM public.profiles p
    JOIN public.profiles ref ON p.id = ref.referred_by_id
    WHERE ref.referred_by_id IS NOT NULL
      AND ref.created_at >= v_cycle.start_at
      AND ref.created_at <= v_cycle.end_at
      AND ref.xp >= 100
    GROUP BY p.id, p.username
    HAVING COUNT(ref.id) > 0
    ORDER BY total_referrals DESC
    LIMIT 10
  ) t;

  -- D. Ambil daftar siklus lama yang sudah diselesaikan
  SELECT json_agg(t) INTO v_past_cycles
  FROM (
    SELECT id, start_at, end_at
    FROM public.leaderboard_cycles
    WHERE status = 'completed'
    ORDER BY end_at DESC
  ) t;

  -- E. Ambil pemenang dari siklus lama
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
    'past_cycles', COALESCE(v_past_cycles, '[]'::JSON),
    'past_winners', COALESCE(v_past_winners, '[]'::JSON)
  );
END;
$$;

-- 9. Perbarui fungsi database complete_shortlink_visit agar menyimpan v_reward ke shortlink_claims.points_reward
CREATE OR REPLACE FUNCTION public.complete_shortlink_visit(
  p_visit_id UUID,
  p_callback_ip TEXT DEFAULT NULL,
  p_callback_user_agent TEXT DEFAULT NULL,
  p_callback_device_fingerprint TEXT DEFAULT NULL
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
  v_provider TEXT;
  v_completed_today_provider INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_new_balance NUMERIC;
  v_ref_id UUID;
  v_ref_commission INT;
  v_limit INT;
  user_xp INT;
BEGIN
  -- 1. Ambil info visit
  SELECT user_id, points_reward, status, provider INTO v_user_id, v_reward, v_status, v_provider
  FROM public.shortlink_claims
  WHERE id = p_visit_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Shortlink visit not found');
  END IF;

  IF v_status = 'completed' THEN
    RETURN json_build_object('success', false, 'message', 'This shortlink visit has already been claimed');
  END IF;

  -- 1b. Jalankan decay sebelum memproses reward agar level ter-update paling kini
  PERFORM public.check_and_apply_xp_decay(v_user_id);

  -- Ambil XP terbaru untuk cek level penalti atau bonus
  SELECT xp INTO user_xp FROM public.profiles WHERE id = v_user_id LIMIT 1;

  -- 1c. Terapkan penalti Mud (-50%) atau bonus rank
  IF user_xp < 0 THEN
    v_reward := FLOOR(v_reward * 0.5);
  ELSIF user_xp >= 100000 THEN
    -- Diamond (+15%)
    v_reward := v_reward + CEIL(v_reward * 0.15);
  ELSIF user_xp >= 10000 THEN
    -- Platinum (+10%)
    v_reward := v_reward + CEIL(v_reward * 0.10);
  ELSIF user_xp >= 1000 THEN
    -- Silver (+5%)
    v_reward := v_reward + CEIL(v_reward * 0.05);
  END IF;

  -- Set limit berdasarkan aturan pembagian baru (reset jam 7 waktu GMT+7 / 00:00 UTC)
  IF v_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF v_provider = 'exeio' THEN
    v_limit := 2;
  ELSIF v_provider = 'fclc' THEN
    v_limit := 2;
  ELSIF v_provider = 'cuty' THEN
    v_limit := 1;
  ELSE
    v_limit := 5;
  END IF;

  -- 2. Double-check batas harian
  SELECT COUNT(*) INTO v_completed_today_provider
  FROM public.shortlink_claims
  WHERE user_id = v_user_id
    AND provider = v_provider
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  IF v_completed_today_provider >= v_limit THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached for ' || v_provider || ' (Max ' || v_limit || ' per day)');
  END IF;

  -- 3. Double-check cooldown 30 menit (hanya untuk provider dengan limit > 1, per provider)
  IF v_limit > 1 THEN
    SELECT completed_at INTO v_last_completion
    FROM public.shortlink_claims
    WHERE user_id = v_user_id
      AND provider = v_provider
      AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1;

    IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
      RETURN json_build_object('success', false, 'message', 'Cooldown active for ' || v_provider || '. Please wait.');
    END IF;
  END IF;

  -- 4. Tandai visit selesai dan rekam IP, UA, fingerprint, serta simpan perolehan poin yang sebenarnya (v_reward)
  UPDATE public.shortlink_claims
  SET status = 'completed',
      completed_at = now(),
      points_reward = v_reward, -- <--- Simpan perolehan poin final yang sudah disesuaikan bonus rank
      ip_address = COALESCE(ip_address, p_callback_ip),
      user_agent = COALESCE(user_agent, p_callback_user_agent),
      device_fingerprint = COALESCE(device_fingerprint, p_callback_device_fingerprint)
  WHERE id = p_visit_id;

  -- 5. Berikan Poin & XP (10 XP), serta reset last_decay_checked_at ke saat ini (karena aktif)
  UPDATE public.profiles
  SET balance = balance + v_reward,
      xp = xp + 10,
      last_decay_checked_at = now()
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- 6. Berikan komisi referral (10%)
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
    'message', 'Successfully claimed ' || v_reward || ' Points & 10 XP!',
    'new_balance', v_new_balance,
    'reward_given', v_reward
  );
END;
$$;
