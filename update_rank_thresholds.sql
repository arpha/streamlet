-- ====================================================================
-- MIGRATION SCRIPT: UPDATE RANK LEVEL THRESHOLDS, BONUSES, AND DECAY
-- ====================================================================

-- 1. Perbarui fungsi XP Decay harian
CREATE OR REPLACE FUNCTION public.check_and_apply_xp_decay(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_xp INT;
  v_last_check TIMESTAMP WITH TIME ZONE;
  v_periods INT;
  v_deduction INT;
BEGIN
  -- Ambil XP dan waktu cek terakhir
  SELECT xp, COALESCE(last_decay_checked_at, now())
  INTO v_current_xp, v_last_check
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_last_check IS NULL THEN
    RETURN;
  END IF;

  -- Hitung jumlah kelipatan 24 jam (hari) ketidakaktifan
  v_periods := FLOOR(EXTRACT(EPOCH FROM (now() - v_last_check)) / 86400)::INT;

  IF v_periods > 0 THEN
    FOR i IN 1..v_periods LOOP
      -- Diamond (>= 1,000,000 XP): potong 800
      -- Platinum (>= 100,000 XP): potong 400
      -- Gold (>= 10,000 XP): potong 200
      -- Silver (>= 1,000 XP): potong 100
      -- Bronze (>= 0 XP): potong 50
      -- Mud (< 0 XP): potong 20
      IF v_current_xp < 0 THEN
        v_deduction := 20;
      ELSIF v_current_xp < 1000 THEN
        v_deduction := 50;
      ELSIF v_current_xp < 10000 THEN
        v_deduction := 100;
      ELSIF v_current_xp < 100000 THEN
        v_deduction := 200;
      ELSIF v_current_xp < 1000000 THEN
        v_deduction := 400;
      ELSE
        v_deduction := 800;
      END IF;

      v_current_xp := v_current_xp - v_deduction;

      -- Batasi nilai XP minimum ke -500 (batas bawah Mud)
      IF v_current_xp < -500 THEN
        v_current_xp := -500;
      END IF;
    END LOOP;

    -- Update profiles
    UPDATE public.profiles
    SET xp = v_current_xp,
        last_decay_checked_at = v_last_check + (v_periods * interval '24 hours')
    WHERE id = p_user_id;
  END IF;
END;
$$;


-- 2. Perbarui fungsi claim_faucet untuk menggunakan aturan bonus yang baru
CREATE OR REPLACE FUNCTION public.claim_faucet(
  u_id UUID,
  reward_xp_val INT,
  cooldown_sec INT,
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
  last_claim TIMESTAMP WITH TIME ZONE;
  reward_amount INT;
  ref_id UUID;
  ref_commission INT;
  new_bal NUMERIC;
  user_xp INT;
BEGIN
  -- 0. Jalankan decay ketidakaktifan terlebih dahulu
  PERFORM public.check_and_apply_xp_decay(u_id);

  -- 1. Periksa batas cooldown klaim
  SELECT claimed_at INTO last_claim
  FROM public.faucet_claims
  WHERE user_id = u_id
  ORDER BY claimed_at DESC
  LIMIT 1;

  IF last_claim IS NOT NULL AND (now() - last_claim) < (cooldown_sec * interval '1 second') THEN
    RETURN json_build_object('success', false, 'message', 'Cooldown in progress');
  END IF;

  -- 2. Ambil nilai reward faucet asli dari site_settings
  SELECT value::INT INTO reward_amount
  FROM public.site_settings
  WHERE key = 'faucet_reward'
  LIMIT 1;

  IF reward_amount IS NULL THEN
    reward_amount := 10; -- fallback
  END IF;

  -- Ambil XP terkini untuk menentukan level/penalti
  SELECT xp INTO user_xp FROM public.profiles WHERE id = u_id LIMIT 1;
  
  -- 2b. Cek Rank dan sesuaikan reward
  IF user_xp < 0 THEN
    -- Rank Mud: Penalti potong 50%
    reward_amount := FLOOR(reward_amount * 0.5);
  ELSIF user_xp >= 1000000 THEN
    -- Diamond (+15%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.15);
  ELSIF user_xp >= 100000 THEN
    -- Platinum (+10%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.10);
  ELSIF user_xp >= 10000 THEN
    -- Gold (+6%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.06);
  ELSIF user_xp >= 1000 THEN
    -- Silver (+3%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.03);
  END IF;

  -- 3. Masukkan catatan klaim baru
  INSERT INTO public.faucet_claims (user_id, amount, claimed_at, ip_address, user_agent, device_fingerprint)
  VALUES (u_id, reward_amount, now(), p_ip_address, p_user_agent, p_device_fingerprint);

  -- 4. Tambah balance, XP, dan reset last_decay_checked_at ke saat ini
  UPDATE public.profiles
  SET 
    balance = balance + reward_amount,
    xp = xp + reward_xp_val,
    last_decay_checked_at = now()
  WHERE id = u_id;

  -- 5. Berikan komisi 25% ke pengundang jika ada
  SELECT referred_by_id INTO ref_id
  FROM public.profiles
  WHERE id = u_id
  LIMIT 1;

  IF ref_id IS NOT NULL THEN
    ref_commission := FLOOR(reward_amount * 0.25);
    IF ref_commission > 0 THEN
      UPDATE public.profiles
      SET balance = balance + ref_commission
      WHERE id = ref_id;
    END IF;
  END IF;

  -- 6. Ambil balance baru
  SELECT balance INTO new_bal
  FROM public.profiles
  WHERE id = u_id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Faucet claimed successfully!', 
    'reward_given', reward_amount, 
    'new_balance', new_bal
  );
END;
$$;


-- 3a. Perbarui fungsi start_shortlink_visit dengan reset UTC jam 7:00 WIB (00:00 UTC)
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

  -- 2. Cek cooldown 30 menit (hanya untuk provider dengan limit > 1, per provider)
  IF v_limit > 1 THEN
    SELECT completed_at INTO v_last_completion
    FROM public.shortlink_claims
    WHERE user_id = p_user_id
      AND provider = p_provider
      AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1;

    IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
      RETURN json_build_object(
        'success', false, 
        'message', 'Cooldown in progress for ' || p_provider || '. Please wait 30 minutes between visits.'
      );
    END IF;
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


-- 3b. Perbarui fungsi complete_shortlink_visit dengan aturan bonus yang baru dan reset UTC jam 7:00 WIB
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

  -- 1b. Jalankan decay sebelum memproses reward
  PERFORM public.check_and_apply_xp_decay(v_user_id);

  -- Ambil XP terbaru untuk cek level penalti atau bonus
  SELECT xp INTO user_xp FROM public.profiles WHERE id = v_user_id LIMIT 1;

  -- 1c. Terapkan penalti Mud (-50%) atau bonus rank
  IF user_xp < 0 THEN
    v_reward := FLOOR(v_reward * 0.5);
  ELSIF user_xp >= 1000000 THEN
    -- Diamond (+15%)
    v_reward := v_reward + CEIL(v_reward * 0.15);
  ELSIF user_xp >= 100000 THEN
    -- Platinum (+10%)
    v_reward := v_reward + CEIL(v_reward * 0.10);
  ELSIF user_xp >= 10000 THEN
    -- Gold (+6%)
    v_reward := v_reward + CEIL(v_reward * 0.06);
  ELSIF user_xp >= 1000 THEN
    -- Silver (+3%)
    v_reward := v_reward + CEIL(v_reward * 0.03);
  END IF;

  -- Set limit berdasarkan provider (reset jam 7 waktu GMT+7 / 00:00 UTC)
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

  -- 4. Tandai visit selesai
  UPDATE public.shortlink_claims
  SET status = 'completed',
      completed_at = now(),
      ip_address = COALESCE(ip_address, p_callback_ip),
      user_agent = COALESCE(user_agent, p_callback_user_agent),
      device_fingerprint = COALESCE(device_fingerprint, p_callback_device_fingerprint)
  WHERE id = p_visit_id;

  -- 5. Berikan Poin & XP (10 XP), serta reset last_decay_checked_at
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


-- 3c. Perbarui fungsi get_user_shortlink_stats berdasarkan reset UTC jam 7:00 WIB (00:00 UTC)
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
  v_cooldown_exeio INT := 0;
  v_cooldown_fclc INT := 0;
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

  -- 3. Hitung sisa cooldown per provider (hanya jika limit > 1)
  -- FC.LC
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'fclc'
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
    v_cooldown_fclc := EXTRACT(EPOCH FROM (interval '30 minutes' - (now() - v_last_completion)))::INT;
  END IF;

  -- Exe.io
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'exeio'
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
    v_cooldown_exeio := EXTRACT(EPOCH FROM (interval '30 minutes' - (now() - v_last_completion)))::INT;
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
    'cooldown_exeio', v_cooldown_exeio,
    'cooldown_fclc', v_cooldown_fclc,
    'total_earned', v_total_earned
  );
END;
$$;


-- 4. Perbarui fungsi process_offerwall_completion untuk menyertakan penalti & bonus rank
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
  user_xp INT;
  v_adjusted_reward INT;
BEGIN
  -- 1. Periksa apakah transaksi sudah pernah diproses sebelumnya
  SELECT COUNT(*) INTO v_exists
  FROM public.offerwall_claims
  WHERE provider = p_provider AND transaction_id = p_transaction_id;

  IF v_exists > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Transaction already processed');
  END IF;

  -- Ambil XP terkini untuk menentukan level/penalti
  SELECT xp INTO user_xp FROM public.profiles WHERE id = p_user_id LIMIT 1;
  
  -- 2. Terapkan penalti Mud (-50%) atau bonus rank
  IF user_xp < 0 THEN
    v_adjusted_reward := FLOOR(p_reward_points * 0.5);
  ELSIF user_xp >= 1000000 THEN
    -- Diamond (+15%)
    v_adjusted_reward := p_reward_points + CEIL(p_reward_points * 0.15);
  ELSIF user_xp >= 100000 THEN
    -- Platinum (+10%)
    v_adjusted_reward := p_reward_points + CEIL(p_reward_points * 0.10);
  ELSIF user_xp >= 10000 THEN
    -- Gold (+6%)
    v_adjusted_reward := p_reward_points + CEIL(p_reward_points * 0.06);
  ELSIF user_xp >= 1000 THEN
    -- Silver (+3%)
    v_adjusted_reward := p_reward_points + CEIL(p_reward_points * 0.03);
  ELSE
    v_adjusted_reward := p_reward_points;
  END IF;

  -- 3. Masukkan record transaksi baru (dengan poin yang disesuaikan)
  INSERT INTO public.offerwall_claims (user_id, provider, transaction_id, points_reward, payout_usd, status)
  VALUES (p_user_id, p_provider, p_transaction_id, v_adjusted_reward, p_payout_usd, 'completed');

  -- 4. Tambahkan poin ke user dan berikan 15 XP
  UPDATE public.profiles
  SET balance = balance + v_adjusted_reward,
      xp = xp + 15,
      last_decay_checked_at = now()
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 5. Berikan komisi referral 10% jika memiliki referrer
  SELECT referred_by_id INTO v_ref_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_ref_id IS NOT NULL THEN
    v_ref_commission := FLOOR(v_adjusted_reward * 0.10);
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


-- 5. Perbarui fungsi process_offerwall_cancellation agar memotong poin aktual yang diberikan
CREATE OR REPLACE FUNCTION public.process_offerwall_cancellation(
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
  v_reward_given INT;
BEGIN
  -- 1. Cari apakah transaksi completed sebelumnya ada dan ambil poin aktualnya
  SELECT points_reward INTO v_reward_given
  FROM public.offerwall_claims
  WHERE provider = p_provider AND transaction_id = p_transaction_id AND status = 'completed';

  IF v_reward_given IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Completed transaction not found');
  END IF;

  -- 2. Ubah status transaksi menjadi 'canceled'
  UPDATE public.offerwall_claims
  SET status = 'canceled'
  WHERE provider = p_provider AND transaction_id = p_transaction_id;

  -- 3. Potong poin dari user dan kurangi 15 XP
  UPDATE public.profiles
  SET balance = GREATEST(0, balance - v_reward_given),
      xp = GREATEST(0, xp - 15)
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 4. Tarik kembali komisi referral jika ada
  SELECT referred_by_id INTO v_ref_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_ref_id IS NOT NULL THEN
    v_ref_commission := FLOOR(v_reward_given * 0.10);
    IF v_ref_commission > 0 THEN
      UPDATE public.profiles
      SET balance = GREATEST(0, balance - v_ref_commission)
      WHERE id = v_ref_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Offerwall claim canceled successfully',
    'new_balance', v_new_balance
  );
END;
$$;
