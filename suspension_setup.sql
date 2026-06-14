-- ====================================================================
-- SECURE ACCOUNT SUSPENSION & TRIGGER SYSTEM
-- Run this script in your Supabase SQL Editor.
-- ====================================================================

-- 1. Add suspension columns to profiles table if they don't exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS suspension_reason TEXT DEFAULT NULL;

-- 2. Create security function to check suspension status
CREATE OR REPLACE FUNCTION public.check_user_suspension(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND is_suspended = true
  ) THEN
    RAISE EXCEPTION 'AKUN ANDA DITANGGUHKAN: Akun ini telah dibekukan karena melanggar aturan.';
  END IF;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.check_user_suspension(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_suspension(UUID) TO anon;

-- 3. Create database trigger function to block writes for suspended users
CREATE OR REPLACE FUNCTION public.trg_check_user_suspension()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Perform check for the user_id involved in the operation
  -- Most tables store this as user_id. We check if NEW.user_id is not null.
  IF NEW.user_id IS NOT NULL THEN
    PERFORM public.check_user_suspension(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Apply triggers to core transactional tables

-- Faucet Claims (Prevent claims)
DROP TRIGGER IF EXISTS trg_faucet_claims_suspension_check ON public.faucet_claims;
CREATE TRIGGER trg_faucet_claims_suspension_check
BEFORE INSERT ON public.faucet_claims
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_user_suspension();

-- Shortlink Claims (Prevent visits and completions)
DROP TRIGGER IF EXISTS trg_shortlink_claims_suspension_check ON public.shortlink_claims;
CREATE TRIGGER trg_shortlink_claims_suspension_check
BEFORE INSERT OR UPDATE ON public.shortlink_claims
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_user_suspension();

-- Withdrawals (Prevent requesting payouts)
DROP TRIGGER IF EXISTS trg_withdrawals_suspension_check ON public.withdrawals;
CREATE TRIGGER trg_withdrawals_suspension_check
BEFORE INSERT ON public.withdrawals
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_user_suspension();

-- PTC Views (Prevent PTC ads claims)
DROP TRIGGER IF EXISTS trg_ptc_views_suspension_check ON public.ptc_views;
CREATE TRIGGER trg_ptc_views_suspension_check
BEFORE INSERT ON public.ptc_views
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_user_suspension();

-- User Miners (Prevent purchasing miners)
DROP TRIGGER IF EXISTS trg_user_miners_suspension_check ON public.user_miners;
CREATE TRIGGER trg_user_miners_suspension_check
BEFORE INSERT ON public.user_miners
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_user_suspension();

-- Mining Claims (Prevent mining claims)
DROP TRIGGER IF EXISTS trg_mining_claims_suspension_check ON public.mining_claims;
CREATE TRIGGER trg_mining_claims_suspension_check
BEFORE INSERT ON public.mining_claims
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_user_suspension();

-- Offerwall Claims (Prevent completing offerwalls)
DROP TRIGGER IF EXISTS trg_offerwall_claims_suspension_check ON public.offerwall_claims;
CREATE TRIGGER trg_offerwall_claims_suspension_check
BEFORE INSERT OR UPDATE ON public.offerwall_claims
FOR EACH ROW
EXECUTE FUNCTION public.trg_check_user_suspension();

-- 5. Add RLS policy to allow Admins to update all user profiles
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
USING (
  public.is_admin(auth.uid())
)
WITH CHECK (
  public.is_admin(auth.uid())
);
