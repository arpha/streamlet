-- Add error_message column to withdrawals table if it doesn't exist
ALTER TABLE public.withdrawals ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Drop old function signature
DROP FUNCTION IF EXISTS public.complete_withdrawal(UUID, TEXT, NUMERIC, BIGINT, TEXT);

-- Create updated complete_withdrawal function with p_error_message parameter
CREATE OR REPLACE FUNCTION public.complete_withdrawal(
  p_withdrawal_id UUID,
  p_status TEXT,
  p_usd_value NUMERIC,
  p_crypto_amount BIGINT,
  p_tx_hash TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
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
    tx_hash = p_tx_hash,
    error_message = p_error_message
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
