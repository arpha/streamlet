-- ====================================================================
-- SKRIP MIGRASI PENAMBAHAN FC.LC SHORTLINK & LIMIT BARU (TOTAL 5)
-- Pembagian limit: ShrinkMe = 1, Exe.io = 1, FC.LC = 3
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Perbarui fungsi start_shortlink_visit dengan limit baru
CREATE OR REPLACE FUNCTION public.start_shortlink_visit(
  p_user_id UUID,
  p_provider TEXT,
  p_reward INT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_completed_today_provider INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_visit_id UUID;
  v_limit INT;
BEGIN
  -- Set limit berdasarkan aturan pembagian baru (Total limit harian = 5)
  IF p_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF p_provider = 'exeio' THEN
    v_limit := 1;
  ELSIF p_provider = 'fclc' THEN
    v_limit := 3;
  ELSE
    v_limit := 5; -- default fallback jika ada provider lain
  END IF;

  -- 1. Hitung klaim sukses 24 jam terakhir untuk provider ini
  SELECT COUNT(*) INTO v_completed_today_provider
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = p_provider
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  IF v_completed_today_provider >= v_limit THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached for ' || p_provider || ' (Max ' || v_limit || ' per 24 hours)');
  END IF;

  -- 2. Cek cooldown global 30 menit
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

  -- 3. Hapus visit pending lama
  DELETE FROM public.shortlink_claims
  WHERE user_id = p_user_id 
    AND status = 'pending'
    AND created_at < (now() - interval '1 hour');

  -- 4. Masukkan pending claim
  INSERT INTO public.shortlink_claims (user_id, provider, points_reward, status, ip_address, user_agent, device_fingerprint)
  VALUES (p_user_id, p_provider, p_reward, 'pending', p_ip_address, p_user_agent, p_device_fingerprint)
  RETURNING id INTO v_visit_id;

  RETURN json_build_object(
    'success', true,
    'visit_id', v_visit_id
  );
END;
$$;


-- 2. Perbarui fungsi complete_shortlink_visit dengan limit baru
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

  -- Set limit berdasarkan aturan pembagian baru (Total limit harian = 5)
  IF v_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF v_provider = 'exeio' THEN
    v_limit := 1;
  ELSIF v_provider = 'fclc' THEN
    v_limit := 3;
  ELSE
    v_limit := 5;
  END IF;

  -- 2. Double-check batas harian
  SELECT COUNT(*) INTO v_completed_today_provider
  FROM public.shortlink_claims
  WHERE user_id = v_user_id
    AND provider = v_provider
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  IF v_completed_today_provider >= v_limit THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached for ' || v_provider || ' (Max ' || v_limit || ' per 24 hours)');
  END IF;

  -- 3. Double-check cooldown 30 menit
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = v_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
    RETURN json_build_object('success', false, 'message', 'Cooldown active. Please wait 30 minutes.');
  END IF;

  -- 4. Tandai visit selesai dan rekam IP, UA, dan fingerprint
  UPDATE public.shortlink_claims
  SET status = 'completed',
      completed_at = now(),
      ip_address = COALESCE(ip_address, p_callback_ip),
      user_agent = COALESCE(user_agent, p_callback_user_agent),
      device_fingerprint = COALESCE(device_fingerprint, p_callback_device_fingerprint)
  WHERE id = p_visit_id;

  -- 5. Berikan Poin & XP (10 XP)
  UPDATE public.profiles
  SET balance = balance + v_reward,
      xp = xp + 10
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


-- 3. Perbarui fungsi get_user_shortlink_stats untuk menghitung FC.LC
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
  v_completed_shrinkme INT;
  v_completed_exeio INT;
  v_completed_fclc INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_cooldown_remaining INT := 0;
  v_total_earned BIGINT;
BEGIN
  -- 1. Total klaim selesai hari ini (semua provider)
  SELECT COUNT(*) INTO v_completed_today
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  -- 2. Hitung berdasarkan masing-masing provider
  SELECT COUNT(*) INTO v_completed_shrinkme
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'shrinkme'
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  SELECT COUNT(*) INTO v_completed_exeio
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'exeio'
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  SELECT COUNT(*) INTO v_completed_fclc
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'fclc'
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  -- 3. Hitung sisa cooldown global
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL THEN
    IF (now() - v_last_completion) < interval '30 minutes' THEN
      v_cooldown_remaining := EXTRACT(EPOCH FROM (interval '30 minutes' - (now() - v_last_completion)))::INT;
    END IF;
  END IF;

  -- 4. Hitung total pendapatan dari shortlinks
  SELECT COALESCE(SUM(points_reward), 0) INTO v_total_earned
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed';

  RETURN json_build_object(
    'completed_today', v_completed_today,
    'completed_shrinkme', v_completed_shrinkme,
    'completed_exeio', v_completed_exeio,
    'completed_fclc', v_completed_fclc,
    'cooldown_remaining', v_cooldown_remaining,
    'total_earned', v_total_earned
  );
END;
$$;
