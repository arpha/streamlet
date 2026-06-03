-- ====================================================================
-- SKRIP SETUP DATABASE REFERRAL & KOMISI FAUCET 25%
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Pastikan kolom-kolom referral di profiles sudah terindeks untuk performa optimal
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code ON public.profiles(referral_code);
CREATE INDEX IF NOT EXISTS idx_profiles_referred_by_id ON public.profiles(referred_by_id);


-- 2. Perbarui fungsi handle_new_user untuk menyimpan kode referral pendaftar
--    dan membuat kode referral unik bagi setiap pengguna baru.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  ref_by_id UUID;
  base_code TEXT;
  final_code TEXT;
  counter INT := 0;
BEGIN
  -- Dapatkan referred_by_id berdasarkan metadata 'referred_by_code'
  IF new.raw_user_meta_data ? 'referred_by_code' AND (new.raw_user_meta_data->>'referred_by_code') IS NOT NULL AND (new.raw_user_meta_data->>'referred_by_code') <> '' THEN
    SELECT id INTO ref_by_id 
    FROM public.profiles 
    WHERE referral_code = (new.raw_user_meta_data->>'referred_by_code')
    LIMIT 1;
  END IF;

  -- Buat kode referral unik dari username
  base_code := COALESCE(new.raw_user_meta_data->>'username', 'user');
  -- Bersihkan karakter non-alphanumeric dan jadikan lowercase
  base_code := LOWER(REGEXP_REPLACE(base_code, '[^a-zA-Z0-9]', '', 'g'));
  IF base_code = '' THEN
    base_code := 'user';
  END IF;
  final_code := base_code;

  -- Cari kode yang belum dipakai
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter;
  END LOOP;

  -- Masukkan profil baru
  INSERT INTO public.profiles (id, username, balance, xp, referral_code, referred_by_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', new.email),
    0,
    0,
    final_code,
    ref_by_id
  );

  RETURN new;
END;
$$;


-- 3. Hapus fungsi lama terlebih dahulu untuk menghindari konflik tipe kembalian (return type)
DROP FUNCTION IF EXISTS public.claim_faucet(uuid, integer, integer);

-- 4. Perbarui fungsi database claim_faucet agar otomatis memberikan komisi 25% ke pengundang
CREATE OR REPLACE FUNCTION public.claim_faucet(
  u_id UUID,
  reward_xp_val INT,
  cooldown_sec INT
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

  -- 3. Masukkan catatan klaim baru
  INSERT INTO public.faucet_claims (user_id, amount, claimed_at)
  VALUES (u_id, reward_amount, now());

  -- 4. Tambah balance dan XP pengguna yang klaim
  UPDATE public.profiles
  SET 
    balance = balance + reward_amount,
    xp = xp + reward_xp_val
  WHERE id = u_id
  RETURNING balance INTO new_bal;

  -- 5. Berikan komisi 25% jika user memiliki pengundang (referral)
  SELECT referred_by_id INTO ref_id
  FROM public.profiles
  WHERE id = u_id
  LIMIT 1;

  IF ref_id IS NOT NULL THEN
    -- Hitung komisi 25%
    ref_commission := FLOOR(reward_amount * 0.25);
    
    IF ref_commission > 0 THEN
      -- Tambahkan komisi langsung ke balance referrer
      UPDATE public.profiles
      SET balance = balance + ref_commission
      WHERE id = ref_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully claimed!',
    'new_balance', new_bal,
    'reward_given', reward_amount
  );
END;
$$;


-- 5. Fungsi RPC untuk mengambil statistik referral (melewati batasan RLS)
CREATE OR REPLACE FUNCTION public.get_referral_stats(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_referral_code TEXT;
  v_total_referrals INT;
  v_active_today INT;
  v_total_commissions NUMERIC;
  v_referred_ids UUID[];
BEGIN
  -- 1. Ambil kode referral pengguna
  SELECT referral_code INTO v_referral_code
  FROM public.profiles
  WHERE id = p_user_id;

  -- 2. Ambil semua ID pengguna yang direferensikan
  SELECT ARRAY_AGG(id) INTO v_referred_ids
  FROM public.profiles
  WHERE referred_by_id = p_user_id;

  v_total_referrals := COALESCE(array_length(v_referred_ids, 1), 0);

  IF v_total_referrals = 0 THEN
    RETURN json_build_object(
      'referral_code', COALESCE(v_referral_code, ''),
      'total_referrals', 0,
      'active_today', 0,
      'total_commissions', 0
    );
  END IF;

  -- 3. Hitung referral yang aktif hari ini (klaim dalam 24 jam terakhir)
  SELECT COUNT(DISTINCT user_id) INTO v_active_today
  FROM public.faucet_claims
  WHERE user_id = ANY(v_referred_ids)
    AND claimed_at >= (now() - interval '24 hours');

  -- 4. Hitung total komisi (25% dari semua klaim faucet referral)
  SELECT COALESCE(FLOOR(SUM(amount) * 0.25), 0) INTO v_total_commissions
  FROM public.faucet_claims
  WHERE user_id = ANY(v_referred_ids);

  RETURN json_build_object(
    'referral_code', COALESCE(v_referral_code, ''),
    'total_referrals', v_total_referrals,
    'active_today', v_active_today,
    'total_commissions', v_total_commissions
  );
END;
$$;
