-- SQL Migration: Update shortlink daily limits, rewards, cooldowns and reset time (reset at 7:00 AM GMT+7 / 00:00 UTC)

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
  -- Set limit berdasarkan aturan pembagian baru (reset jam 7 waktu GMT+7 / 00:00 UTC)
  IF p_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF p_provider = 'exeio' THEN
    v_limit := 2;
  ELSIF p_provider = 'fclc' THEN
    v_limit := 2;
  ELSIF p_provider = 'cuty' THEN
    v_limit := 1;
  ELSE
    v_limit := 5; -- default fallback jika ada provider lain
  END IF;

  -- 1. Hitung klaim sukses sejak jam 7 pagi GMT+7 (00:00 UTC) hari ini untuk provider ini
  SELECT COUNT(*) INTO v_completed_today_provider
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = p_provider
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  IF v_completed_today_provider >= v_limit THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached for ' || p_provider || ' (Max ' || v_limit || ' per day)');
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

  -- 4. Buat visit baru
  INSERT INTO public.shortlink_claims (
    user_id, 
    provider, 
    points_reward, 
    status, 
    ip_address,
    user_agent,
    device_fingerprint
  )
  VALUES (
    p_user_id, 
    p_provider, 
    p_reward, 
    'pending', 
    p_ip_address,
    p_user_agent,
    p_device_fingerprint
  )
  RETURNING id INTO v_visit_id;

  RETURN json_build_object('success', true, 'visit_id', v_visit_id);
END;
$$;


-- 2. Perbarui fungsi complete_shortlink_visit dengan limit baru & reset UTC
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


-- 3. Perbarui fungsi get_user_shortlink_stats untuk menghitung FC.LC, Exe.io, dan Shrinkme berdasarkan reset UTC
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
  v_completed_cuty INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_cooldown_remaining INT := 0;
  v_total_earned BIGINT;
BEGIN
  -- 1. Total klaim selesai hari ini (semua provider) sejak jam 7 pagi GMT+7 (00:00 UTC)
  SELECT COUNT(*) INTO v_completed_today
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  -- 2. Hitung berdasarkan masing-masing provider sejak jam 7 pagi GMT+7 (00:00 UTC)
  SELECT COUNT(*) INTO v_completed_shrinkme
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'shrinkme'
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT COUNT(*) INTO v_completed_exeio
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'exeio'
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT COUNT(*) INTO v_completed_fclc
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'fclc'
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  SELECT COUNT(*) INTO v_completed_cuty
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'cuty'
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

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
    'completed_cuty', v_completed_cuty,
    'cooldown_remaining', v_cooldown_remaining,
    'total_earned', v_total_earned
  );
END;
$$;
