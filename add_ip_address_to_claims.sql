-- ====================================================================
-- SKRIP MIGRASI PENYIMPANAN IP ADDRESS PADA KLAIM FAUCET & SHORTLINK
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Tambah kolom ip_address pada tabel faucet_claims jika belum ada
ALTER TABLE public.faucet_claims 
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- 2. Tambah kolom ip_address pada tabel shortlink_claims jika belum ada
ALTER TABLE public.shortlink_claims 
ADD COLUMN IF NOT EXISTS ip_address TEXT;


-- 3. Perbarui fungsi RPC claim_faucet agar menerima p_ip_address
CREATE OR REPLACE FUNCTION public.claim_faucet(
  u_id UUID,
  reward_xp_val INT,
  cooldown_sec INT,
  p_ip_address TEXT DEFAULT NULL
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
  -- 1. Periksa batas cooldown klaim
  SELECT claimed_at INTO last_claim
  FROM public.faucet_claims
  WHERE user_id = u_id
  ORDER BY claimed_at DESC
  LIMIT 1;

  IF last_claim IS NOT NULL AND (now() - last_claim) < (cooldown_sec * interval '1 second') THEN
    RETURN json_build_object('success', false, 'message', 'Cooldown in progress');
  END IF;

  -- 2. Ambil nilai reward faucet dari site_settings
  SELECT value::INT INTO reward_amount
  FROM public.site_settings
  WHERE key = 'faucet_reward'
  LIMIT 1;

  IF reward_amount IS NULL THEN
    reward_amount := 10; -- fallback default
  END IF;

  -- 2b. Bonus Faucet Berdasarkan Level
  -- Ambil XP saat ini dari profiles
  SELECT xp INTO user_xp FROM public.profiles WHERE id = u_id LIMIT 1;
  
  IF user_xp >= 100000 THEN
    -- Diamond (+15%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.15);
  ELSIF user_xp >= 10000 THEN
    -- Platinum (+10%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.10);
  ELSIF user_xp >= 1000 THEN
    -- Silver (+5%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.05);
  END IF;

  -- 3. Masukkan catatan klaim baru beserta IP
  INSERT INTO public.faucet_claims (user_id, amount, claimed_at, ip_address)
  VALUES (u_id, reward_amount, now(), p_ip_address);

  -- 4. Tambah balance dan XP pengguna yang klaim
  UPDATE public.profiles
  SET 
    balance = balance + reward_amount,
    xp = xp + reward_xp_val
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


-- 4. Perbarui fungsi RPC start_shortlink_visit agar menerima p_ip_address
CREATE OR REPLACE FUNCTION public.start_shortlink_visit(
  p_user_id UUID,
  p_provider TEXT,
  p_reward INT,
  p_ip_address TEXT DEFAULT NULL
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
  -- Set limit berdasarkan provider
  IF p_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF p_provider = 'exeio' THEN
    v_limit := 4;
  ELSE
    v_limit := 5; -- default fallback
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

  -- 4. Masukkan pending claim beserta IP
  INSERT INTO public.shortlink_claims (user_id, provider, points_reward, status, ip_address)
  VALUES (p_user_id, p_provider, p_reward, 'pending', p_ip_address)
  RETURNING id INTO v_visit_id;

  RETURN json_build_object(
    'success', true,
    'visit_id', v_visit_id
  );
END;
$$;


-- 5. Perbarui fungsi RPC complete_shortlink_visit agar menerima p_callback_ip
CREATE OR REPLACE FUNCTION public.complete_shortlink_visit(
  p_visit_id UUID,
  p_callback_ip TEXT DEFAULT NULL
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

  -- Set limit berdasarkan provider
  IF v_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF v_provider = 'exeio' THEN
    v_limit := 4;
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

  -- 4. Tandai visit selesai dan rekam IP callback jika belum ada
  UPDATE public.shortlink_claims
  SET status = 'completed',
      completed_at = now(),
      ip_address = COALESCE(ip_address, p_callback_ip)
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
