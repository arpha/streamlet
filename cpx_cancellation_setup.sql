-- ====================================================================
-- SKRIP SETUP RPC PEMBATALAN/CHARGEBACK TRANSAKSI OFFERWALL
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

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
BEGIN
  -- 1. Cari apakah transaksi completed sebelumnya ada
  SELECT COUNT(*) INTO v_exists
  FROM public.offerwall_claims
  WHERE provider = p_provider AND transaction_id = p_transaction_id AND status = 'completed';

  IF v_exists = 0 THEN
    RETURN json_build_object('success', false, 'message', 'Completed transaction not found');
  END IF;

  -- 2. Ubah status transaksi menjadi 'canceled'
  UPDATE public.offerwall_claims
  SET status = 'canceled'
  WHERE provider = p_provider AND transaction_id = p_transaction_id;

  -- 3. Potong poin dari user dan kurangi 100 XP
  UPDATE public.profiles
  SET balance = GREATEST(0, balance - p_reward_points),
      xp = GREATEST(0, xp - 100)
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 4. Tarik kembali komisi referral jika ada
  SELECT referred_by_id INTO v_ref_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_ref_id IS NOT NULL THEN
    v_ref_commission := FLOOR(p_reward_points * 0.10);
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
