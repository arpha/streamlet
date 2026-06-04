-- ====================================================================
-- SKRIP SETUP STATISTIK PENARIKAN PUBLIK & RIWAYAT PENARIKAN TERBARU
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Update fungsi get_public_stats untuk menghitung total_paid_usd
CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_total_users INT;
  v_total_earned NUMERIC;
  v_total_paid_usd NUMERIC;
BEGIN
  -- A. Hitung total user
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;

  -- B. Hitung total earned (dari faucet_claims + komisi referal)
  SELECT COALESCE(SUM(amount), 0) + COALESCE(SUM(CASE WHEN p.referred_by_id IS NOT NULL THEN FLOOR(c.amount * 0.25) ELSE 0 END), 0)
  INTO v_total_earned
  FROM public.faucet_claims c
  LEFT JOIN public.profiles p ON c.user_id = p.id;

  -- C. Hitung total paid out in USD dari withdrawals dengan status 'completed'
  SELECT COALESCE(SUM(usd_value), 0)
  INTO v_total_paid_usd
  FROM public.withdrawals
  WHERE status = 'completed';

  RETURN json_build_object(
    'total_users', v_total_users,
    'total_earned', v_total_earned,
    'total_paid_usd', v_total_paid_usd
  );
END;
$$;

-- 2. Buat fungsi get_recent_withdrawals untuk mengambil 10 penarikan terbaru
--    Fungsi ini menggunakan SECURITY DEFINER agar dapat diakses publik melewati RLS.
CREATE OR REPLACE FUNCTION public.get_recent_withdrawals()
RETURNS TABLE (
  coin TEXT,
  amount INT,
  usd_value NUMERIC,
  address TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    w.coin,
    w.amount,
    w.usd_value,
    w.address,
    w.status,
    w.created_at
  FROM public.withdrawals w
  ORDER BY w.created_at DESC
  LIMIT 10;
END;
$$;
