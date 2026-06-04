-- ====================================================================
-- SKRIP SETUP DATABASE PENARIKAN (WITHDRAW) OTOMATIS VIA FAUCETPAY
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Membuat tabel withdrawals jika belum ada
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,            -- Jumlah penarikan dalam poin
  coin TEXT NOT NULL,                  -- DOGE, POL, atau BNB
  address TEXT NOT NULL,              -- Alamat/Email FaucetPay
  usd_value NUMERIC(12,8),           -- Nilai USD hasil konversi poin
  crypto_amount BIGINT,              -- Jumlah satoshi yang dikirim
  tx_hash TEXT,                       -- ID transaksi dari FaucetPay (payout_id)
  status TEXT DEFAULT 'pending',      -- pending, completed, failed
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Pastikan kolom tambahan ada (jika tabel sudah ada sebelumnya)
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS coin TEXT NOT NULL DEFAULT 'DOGE';
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS usd_value NUMERIC(12,8);
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS crypto_amount BIGINT;
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS tx_hash TEXT;

-- 3. Indeks untuk performa query
CREATE INDEX IF NOT EXISTS idx_withdrawals_user_id ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON public.withdrawals(created_at DESC);

-- 4. Aktifkan Row Level Security (RLS)
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

-- 5. Berikan hak akses (GRANT) ke role authenticated (user yang login)
GRANT SELECT, INSERT, UPDATE ON public.withdrawals TO authenticated;

-- 6. Buat kebijakan akses RLS
DROP POLICY IF EXISTS "Users can view their own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can view their own withdrawals" ON public.withdrawals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own withdrawals" ON public.withdrawals;
CREATE POLICY "Users can create their own withdrawals" ON public.withdrawals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Hapus fungsi lama jika ada (menghindari konflik return type)
DROP FUNCTION IF EXISTS public.request_withdrawal(UUID, INT, TEXT, TEXT);

-- 7. Fungsi RPC request_withdrawal — validasi & kurangi saldo secara atomik
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_user_id UUID,
  p_amount INT,
  p_coin TEXT,
  p_address TEXT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_balance INT;
  v_new_balance INT;
  v_withdrawal_id UUID;
  v_recent_count INT;
BEGIN
  -- 0. Pengecekan limit 1x per 24 jam
  SELECT COUNT(*) INTO v_recent_count
  FROM public.withdrawals
  WHERE user_id = p_user_id
    AND status != 'failed'
    AND created_at >= now() - INTERVAL '24 hours';

  IF v_recent_count > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Anda hanya dapat melakukan penarikan 1 kali dalam 24 jam.');
  END IF;

  -- A. Validasi batas minimum
  IF p_amount < 3000 THEN
    RETURN json_build_object('success', false, 'message', 'Batas penarikan minimal adalah 3000 poin.');
  END IF;

  -- B. Validasi koin
  IF p_coin NOT IN ('DOGE', 'POL', 'BNB') THEN
    RETURN json_build_object('success', false, 'message', 'Mata uang tidak didukung. Pilih DOGE, POL, atau BNB.');
  END IF;

  -- C. Validasi alamat
  IF p_address IS NULL OR TRIM(p_address) = '' THEN
    RETURN json_build_object('success', false, 'message', 'Email FaucetPay wajib diisi.');
  END IF;

  -- D. Dapatkan saldo saat ini dan kunci baris (mencegah double-spend)
  SELECT balance INTO v_current_balance
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Pengguna tidak ditemukan.');
  END IF;

  IF v_current_balance < p_amount THEN
    RETURN json_build_object('success', false, 'message', 'Saldo poin Anda tidak mencukupi.');
  END IF;

  -- E. Kurangi saldo pengguna
  UPDATE public.profiles
  SET balance = balance - p_amount
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- F. Masukkan catatan penarikan baru (status: pending)
  INSERT INTO public.withdrawals (user_id, amount, coin, address, status, created_at)
  VALUES (p_user_id, p_amount, p_coin, TRIM(p_address), 'pending', now())
  RETURNING id INTO v_withdrawal_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Penarikan berhasil diajukan.',
    'new_balance', v_new_balance,
    'withdrawal_id', v_withdrawal_id
  );
END;
$$;

-- 8. Fungsi untuk mengupdate status withdrawal setelah pembayaran FaucetPay
--    Digunakan oleh backend API route
CREATE OR REPLACE FUNCTION public.complete_withdrawal(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_usd_value NUMERIC,
  p_crypto_amount BIGINT,
  p_tx_hash TEXT DEFAULT NULL
)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.withdrawals
  SET 
    status = p_status,
    usd_value = p_usd_value,
    crypto_amount = p_crypto_amount,
    tx_hash = p_tx_hash
  WHERE id = p_withdrawal_id;

  -- Jika gagal, kembalikan saldo pengguna
  IF p_status = 'failed' THEN
    UPDATE public.profiles
    SET balance = balance + (
      SELECT amount FROM public.withdrawals WHERE id = p_withdrawal_id
    )
    WHERE id = (
      SELECT user_id FROM public.withdrawals WHERE id = p_withdrawal_id
    );
  END IF;
END;
$$;
