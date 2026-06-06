-- ====================================================================
-- SKRIP MIGRASI RANK DECAY & PENALTI RANK MUD (-50% REWARD)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Tambahkan kolom last_decay_checked_at jika belum ada dengan DEFAULT now()
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_decay_checked_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Pastikan default value terpasang untuk insert masa depan
ALTER TABLE public.profiles ALTER COLUMN last_decay_checked_at SET DEFAULT timezone('utc'::text, now());

-- Inisialisasi untuk pengguna yang sudah ada
UPDATE public.profiles 
SET last_decay_checked_at = COALESCE(created_at, now()) 
WHERE last_decay_checked_at IS NULL;


-- 2. Buat fungsi pembantu check_and_apply_xp_decay
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
  -- Ambil XP dan waktu cek terakhir dari profiles
  SELECT xp, COALESCE(last_decay_checked_at, created_at, now())
  INTO v_current_xp, v_last_check
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_last_check IS NULL THEN
    RETURN;
  END IF;

  -- Hitung jumlah kelipatan 24 jam (hari) ketidakaktifan
  v_periods := FLOOR(EXTRACT(EPOCH FROM (now() - v_last_check)) / 86400)::INT;

  -- Jika tidak aktif lebih dari 24 jam, terapkan pemotongan berkelanjutan
  IF v_periods > 0 THEN
    FOR i IN 1..v_periods LOOP
      -- Diamond (>= 100k XP): potong 400
      -- Platinum (>= 10k XP): potong 200
      -- Silver (>= 1k XP): potong 100
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
      ELSE
        v_deduction := 400;
      END IF;

      v_current_xp := v_current_xp - v_deduction;

      -- Batasi nilai XP minimum ke -500 (batas bawah Mud)
      IF v_current_xp < -500 THEN
        v_current_xp := -500;
      END IF;
    END LOOP;

    -- Update database profiles dengan XP baru dan geser tanggal cek terakhir
    UPDATE public.profiles
    SET xp = v_current_xp,
        last_decay_checked_at = v_last_check + (v_periods * interval '24 hours')
    WHERE id = p_user_id;
  END IF;
END;
$$;


-- 3. Perbarui fungsi claim_faucet dengan pemanggilan decay dan pemotongan Mud 50%
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
  -- 0. Jalankan pengecekan & penerapan decay ketidakaktifan terlebih dahulu
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
    reward_amount := 10; -- fallback default
  END IF;

  -- Ambil XP terkini untuk menentukan level/penalti
  SELECT xp INTO user_xp FROM public.profiles WHERE id = u_id LIMIT 1;
  
  -- 2b. Cek Rank dan sesuaikan reward
  IF user_xp < 0 THEN
    -- Rank Mud: Penalti potong 50%
    reward_amount := FLOOR(reward_amount * 0.5);
  ELSIF user_xp >= 100000 THEN
    -- Diamond (+15%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.15);
  ELSIF user_xp >= 10000 THEN
    -- Platinum (+10%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.10);
  ELSIF user_xp >= 1000 THEN
    -- Silver (+5%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.05);
  END IF;

  -- 3. Masukkan catatan klaim baru
  INSERT INTO public.faucet_claims (user_id, amount, claimed_at, ip_address, user_agent, device_fingerprint)
  VALUES (u_id, reward_amount, now(), p_ip_address, p_user_agent, p_device_fingerprint);

  -- 4. Tambah balance, XP, dan reset last_decay_checked_at ke saat ini (karena aktif)
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


-- 4. Perbarui fungsi complete_shortlink_visit dengan pemanggilan decay dan pemotongan Mud 50%
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

  -- Ambil XP terbaru untuk cek level penalti
  SELECT xp INTO user_xp FROM public.profiles WHERE id = v_user_id LIMIT 1;

  -- 1c. Terapkan penalti Mud (-50%) jika user_xp < 0
  IF user_xp < 0 THEN
    v_reward := FLOOR(v_reward * 0.5);
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
