[ignoring loop detection]
-- ====================================================================
-- SKRIP SETUP DATABASE VIRTUAL MINER GAME
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Buat tabel user_miners jika belum ada
CREATE TABLE IF NOT EXISTS public.user_miners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    miner_type TEXT NOT NULL CHECK (miner_type IN ('coal', 'iron', 'gold')),
    cost INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '30 days'),
    last_claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    charged_until TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours')
);

-- 2. Aktifkan Row Level Security (RLS)
ALTER TABLE public.user_miners ENABLE ROW LEVEL SECURITY;

-- 3. Berikan hak akses ke role authenticated
GRANT SELECT ON public.user_miners TO authenticated;

-- 4. Policy RLS: User hanya bisa melihat miner miliknya sendiri
DROP POLICY IF EXISTS "Users can view their own miners" ON public.user_miners;
CREATE POLICY "Users can view their own miners"
ON public.user_miners
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 5. Fungsi Helper: Mendapatkan profit multiplier berdasarkan XP/Rank user saat ini
CREATE OR REPLACE FUNCTION public.get_user_mining_multiplier(p_xp INT)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_xp < 1000 THEN
    RETURN 1.00; -- Mud & Bronze (Tidak mendapat bonus profit tambahan)
  ELSIF p_xp < 10000 THEN
    RETURN 1.03; -- Silver (+3% profit)
  ELSIF p_xp < 100000 THEN
    RETURN 1.06; -- Gold (+6% profit)
  ELSIF p_xp < 1000000 THEN
    RETURN 1.10; -- Platinum (+10% profit)
  ELSE
    RETURN 1.15; -- Diamond (+15% profit)
  END IF;
END;
$$;

-- 6. Fungsi Helper: Bersihkan/reset last_claimed_at jika rank user turun di bawah Silver
CREATE OR REPLACE FUNCTION public.check_and_update_inactive_miners(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_xp INT;
BEGIN
  -- Dapatkan XP user saat ini
  SELECT xp INTO v_xp FROM public.profiles WHERE id = p_user_id;
  
  -- Jika rank turun di bawah Silver (< 1000 XP)
  IF v_xp < 1000 THEN
    UPDATE public.user_miners
    SET last_claimed_at = now()
    WHERE user_id = p_user_id AND expires_at > now();
  END IF;
END;
$$;

-- 7. RPC: Membeli Miner baru
CREATE OR REPLACE FUNCTION public.purchase_miner(p_miner_type TEXT)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_xp INT;
  v_cost INT;
  v_balance INT;
  v_new_balance INT;
  v_miner_id UUID;
BEGIN
  -- Dapatkan ID user yang login
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- 1. Validasi minimal Rank Silver (XP >= 1000)
  SELECT xp, balance INTO v_xp, v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  
  IF v_xp IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Profil tidak ditemukan.');
  END IF;
  
  IF v_xp < 1000 THEN
    RETURN json_build_object('success', false, 'message', 'Masa keaktifan rank Anda terlalu rendah. Butuh rank Silver ke atas untuk menggunakan Virtual Miner.');
  END IF;

  -- 2. Tentukan harga miner berdasarkan tipenya
  IF p_miner_type = 'coal' THEN
    v_cost := 5000;
  ELSIF p_miner_type = 'iron' THEN
    v_cost := 50000;
  ELSIF p_miner_type = 'gold' THEN
    v_cost := 500000;
  ELSE
    RETURN json_build_object('success', false, 'message', 'Tipe miner tidak valid.');
  END IF;

  -- 3. Verifikasi apakah poin user cukup
  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'message', 'Saldo poin Anda tidak mencukupi untuk membeli miner ini.');
  END IF;

  -- 4. Kurangi saldo poin user
  UPDATE public.profiles
  SET balance = balance - v_cost
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- 5. Masukkan record miner baru
  INSERT INTO public.user_miners (user_id, miner_type, cost, created_at, expires_at, last_claimed_at, charged_until)
  VALUES (v_user_id, p_miner_type, v_cost, now(), now() + INTERVAL '30 days', now(), now() + INTERVAL '24 hours')
  RETURNING id INTO v_miner_id;

  -- 6. Log aktivitas pembelian
  INSERT INTO public.faucet_claims (user_id, points_reward, ip_address, user_agent, details, created_at)
  VALUES (v_user_id, -v_cost, '127.0.0.1', 'System', 'Purchased ' || p_miner_type || ' miner', now());

  RETURN json_build_object(
    'success', true,
    'message', 'Berhasil membeli ' || p_miner_type || ' miner!',
    'new_balance', v_new_balance,
    'miner_id', v_miner_id
  );
END;
$$;

-- 8. RPC: Klaim rewards dari miner
CREATE OR REPLACE FUNCTION public.claim_miner_rewards(p_miner_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_xp INT;
  v_multiplier NUMERIC;
  v_miner RECORD;
  v_end_time TIMESTAMP WITH TIME ZONE;
  v_active_hours NUMERIC;
  v_total_return NUMERIC;
  v_hourly_rate NUMERIC;
  v_reward_amount INT;
  v_new_balance INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- 1. Ambil data miner dan kunci baris
  SELECT * INTO v_miner FROM public.user_miners WHERE id = p_miner_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Miner tidak ditemukan.');
  END IF;

  -- 2. Ambil XP user saat ini
  SELECT xp INTO v_xp FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  
  -- 3. Cek apakah rank saat ini di bawah Silver
  IF v_xp < 1000 THEN
    -- Reset last_claimed_at ke waktu sekarang untuk menghanguskan akumulasi waktu sebelumnya
    UPDATE public.user_miners SET last_claimed_at = now() WHERE id = p_miner_id;
    RETURN json_build_object('success', false, 'message', 'Miner nonaktif karena rank Anda berada di bawah Silver. Naikkan rank Anda untuk mengaktifkannya kembali.');
  END IF;

  -- 4. Hitung multiplier berdasarkan rank saat ini
  v_multiplier := public.get_user_mining_multiplier(v_xp);

  -- 5. Hitung batas akhir penambangan yang valid (terkecil dari now, expires_at, dan charged_until)
  v_end_time := LEAST(now(), v_miner.expires_at, v_miner.charged_until);

  -- Jika last_claimed_at berada setelah v_end_time (tidak ada waktu tambang berjalan)
  IF v_miner.last_claimed_at >= v_end_time THEN
    RETURN json_build_object('success', false, 'message', 'Tidak ada hasil tambang baru yang bisa diklaim saat ini.');
  END IF;

  -- 6. Hitung durasi jam menambang
  v_active_hours := EXTRACT(EPOCH FROM (v_end_time - v_miner.last_claimed_at)) / 3600.0;
  IF v_active_hours < 0 THEN
    v_active_hours := 0;
  END IF;

  -- 7. Hitung pendapatan
  -- total_return = harga beli * multiplier (misal 5000 * 1.03 = 5150)
  v_total_return := v_miner.cost * v_multiplier;
  -- hourly_rate = total_return / 720 jam (30 hari)
  v_hourly_rate := v_total_return / 720.0;
  v_reward_amount := FLOOR(v_active_hours * v_hourly_rate);

  IF v_reward_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Hasil tambang terlalu kecil untuk diklaim. Silakan tunggu lebih lama.');
  END IF;

  -- 8. Update saldo user
  UPDATE public.profiles
  SET balance = balance + v_reward_amount
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- 9. Update last_claimed_at pada miner
  UPDATE public.user_miners
  SET last_claimed_at = v_end_time
  WHERE id = p_miner_id;

  -- 10. Catat klaim di tabel history
  INSERT INTO public.faucet_claims (user_id, points_reward, ip_address, user_agent, details, created_at)
  VALUES (v_user_id, v_reward_amount, '127.0.0.1', 'System', 'Claimed rewards from ' || v_miner.miner_type || ' miner', now());

  RETURN json_build_object(
    'success', true,
    'message', 'Berhasil mengklaim ' || v_reward_amount || ' poin dari miner Anda!',
    'new_balance', v_new_balance,
    'reward_amount', v_reward_amount
  );
END;
$$;

-- 9. RPC: Mengisi baterai (recharge) miner
CREATE OR REPLACE FUNCTION public.recharge_miner(p_miner_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_miner RECORD;
  v_claim_res JSON;
  v_xp INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- 1. Ambil data miner dan kunci baris
  SELECT * INTO v_miner FROM public.user_miners WHERE id = p_miner_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Miner tidak ditemukan.');
  END IF;

  -- Cek apakah miner sudah expired
  IF now() >= v_miner.expires_at THEN
    RETURN json_build_object('success', false, 'message', 'Miner sudah kedaluwarsa. Tidak dapat di-recharge.');
  END IF;

  -- 2. Ambil XP user
  SELECT xp INTO v_xp FROM public.profiles WHERE id = v_user_id;
  IF v_xp < 1000 THEN
    RETURN json_build_object('success', false, 'message', 'Rank Anda di bawah Silver. Miner tidak dapat di-recharge.');
  END IF;

  -- 3. Klaim otomatis sisa reward terlebih dahulu
  --    Ini memanggil fungsi claim_miner_rewards secara internal
  BEGIN
    v_claim_res := public.claim_miner_rewards(p_miner_id);
  EXCEPTION WHEN OTHERS THEN
    -- Hiraukan error jika tidak ada reward yang bernilai > 0
  END;

  -- Ambil data terupdate setelah claim
  SELECT * INTO v_miner FROM public.user_miners WHERE id = p_miner_id;

  -- 4. Jika baterai sudah sempat mati total (charged_until < now())
  --    Maka ubah last_claimed_at = now() agar jeda offline tidak dihitung
  IF v_miner.charged_until < now() THEN
    UPDATE public.user_miners
    SET 
      last_claimed_at = now(),
      charged_until = now() + INTERVAL '24 hours'
    WHERE id = p_miner_id;
  ELSE
    -- Jika masih menyala, perpanjang baterai hingga 24 jam ke depan dari sekarang
    UPDATE public.user_miners
    SET charged_until = now() + INTERVAL '24 hours'
    WHERE id = p_miner_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Baterai miner berhasil diisi ulang hingga 24 jam ke depan!'
  );
END;
$$;

-- 10. RPC: Membuang miner expired
CREATE OR REPLACE FUNCTION public.delete_expired_miner(p_miner_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_miner RECORD;
  v_claim_res JSON;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- 1. Ambil data miner
  SELECT * INTO v_miner FROM public.user_miners WHERE id = p_miner_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Miner tidak ditemukan.');
  END IF;

  -- 2. Validasi apakah miner benar-benar sudah kedaluwarsa
  IF now() < v_miner.expires_at THEN
    RETURN json_build_object('success', false, 'message', 'Miner belum kedaluwarsa. Anda hanya bisa membuang miner yang sudah expired.');
  END IF;

  -- 3. Klaim otomatis sisa reward terakhir
  BEGIN
    v_claim_res := public.claim_miner_rewards(p_miner_id);
  EXCEPTION WHEN OTHERS THEN
    -- Hiraukan error jika tidak ada reward yang dapat diklaim
  END;

  -- 4. Hapus miner dari database untuk mengosongkan rak
  DELETE FROM public.user_miners WHERE id = p_miner_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Miner kedaluwarsa berhasil dibuang. Rak Anda sekarang kosong.'
  );
END;
$$;
