-- ====================================================================
-- SECURE ADMIN SECURITY & RLS POLICIES SETUP
-- Run this script in your Supabase SQL Editor.
-- ====================================================================

-- 1. Create a helper function to check admin status bypassing RLS (SECURITY DEFINER)
-- This prevents infinite recursion when checking policies on the profiles table itself.
CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE id = p_user_id AND is_admin = true
  );
END;
$$;

-- Grant execution permissions on helper function
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(UUID) TO anon;

-- 2. Add Select policies for admins on profiles table safely
DROP POLICY IF EXISTS "Admins can select all profiles" ON public.profiles;
CREATE POLICY "Admins can select all profiles"
ON public.profiles
FOR SELECT
USING (
  public.is_admin(auth.uid())
);

-- 3. Add Select policies for admins on withdrawals table safely
DROP POLICY IF EXISTS "Admins can select all withdrawals" ON public.withdrawals;
CREATE POLICY "Admins can select all withdrawals"
ON public.withdrawals
FOR SELECT
USING (
  public.is_admin(auth.uid())
);

-- 4. Create or replace the function to get admin dashboard stats
CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_total_users INT;
  v_dau INT;
  v_mau INT;
  v_total_user_points NUMERIC;
  v_total_faucet_claims INT;
  v_total_shortlinks INT;
  v_active_miners INT;
  v_coal_miners INT;
  v_iron_miners INT;
  v_gold_miners INT;
  v_miner_purchases_volume NUMERIC;
  v_miner_claims_volume NUMERIC;
  v_completed_withdrawals_count INT;
  v_completed_withdrawals_usd NUMERIC;
  v_failed_withdrawals_count INT;
  v_pending_withdrawals_count INT;
  v_pending_withdrawals_points NUMERIC;
  v_active_ptc_campaigns INT;
  v_now TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Verify requester is an administrator using the secure helper function
  IF public.is_admin(p_user_id) IS NOT TRUE THEN
    RAISE EXCEPTION 'Access Denied. Admin authorization required.';
  END IF;

  v_now := now();

  -- 1. User Engagement Stats
  SELECT count(*), coalesce(sum(balance), 0) INTO v_total_users, v_total_user_points FROM public.profiles;
  SELECT count(*) INTO v_dau FROM public.profiles WHERE last_active_at >= (v_now - INTERVAL '24 hours');
  SELECT count(*) INTO v_mau FROM public.profiles WHERE last_active_at >= (v_now - INTERVAL '30 days');

  -- 2. Faucet Claims Count
  SELECT count(*) INTO v_total_faucet_claims FROM public.faucet_claims;

  -- 3. Shortlink Claims Count
  SELECT count(*) INTO v_total_shortlinks FROM public.shortlink_claims WHERE status = 'completed';

  -- 4. User Miners Stats
  SELECT count(*) INTO v_active_miners FROM public.user_miners WHERE expires_at > v_now;
  SELECT count(*) INTO v_coal_miners FROM public.user_miners WHERE miner_type = 'coal' AND expires_at > v_now;
  SELECT count(*) INTO v_iron_miners FROM public.user_miners WHERE miner_type = 'iron' AND expires_at > v_now;
  SELECT count(*) INTO v_gold_miners FROM public.user_miners WHERE miner_type = 'gold' AND expires_at > v_now;

  -- 5. Mining Claims Volume (Purchases & Rewards)
  SELECT coalesce(sum(amount), 0) INTO v_miner_purchases_volume FROM public.mining_claims WHERE claim_type = 'purchase';
  v_miner_purchases_volume := abs(v_miner_purchases_volume);
  
  SELECT coalesce(sum(amount), 0) INTO v_miner_claims_volume FROM public.mining_claims WHERE claim_type = 'claim';

  -- 6. Withdrawal Stats
  SELECT count(*), coalesce(sum(usd_value), 0) INTO v_completed_withdrawals_count, v_completed_withdrawals_usd FROM public.withdrawals WHERE status = 'completed';
  SELECT count(*) INTO v_failed_withdrawals_count FROM public.withdrawals WHERE status = 'failed';
  SELECT count(*), coalesce(sum(amount), 0) INTO v_pending_withdrawals_count, v_pending_withdrawals_points FROM public.withdrawals WHERE status = 'pending';

  -- 7. PTC Campaigns Count
  SELECT count(*) INTO v_active_ptc_campaigns FROM public.ptc_campaigns WHERE status = 'active';

  RETURN json_build_object(
    'totalUsers', v_total_users,
    'dau', v_dau,
    'mau', v_mau,
    'totalUserPoints', v_total_user_points,
    'totalFaucetClaims', v_total_faucet_claims,
    'totalShortlinks', v_total_shortlinks,
    'activeMiners', v_active_miners,
    'coalMiners', v_coal_miners,
    'ironMiners', v_iron_miners,
    'goldMiners', v_gold_miners,
    'minerPurchasesVolume', v_miner_purchases_volume,
    'minerClaimsVolume', v_miner_claims_volume,
    'completedWithdrawalsCount', v_completed_withdrawals_count,
    'completedWithdrawalsUsd', v_completed_withdrawals_usd,
    'failedWithdrawalsCount', v_failed_withdrawals_count,
    'pendingWithdrawalsCount', v_pending_withdrawals_count,
    'pendingWithdrawalsPoints', v_pending_withdrawals_points,
    'activePtcCampaigns', v_active_ptc_campaigns
  );
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_admin_dashboard_stats(UUID) TO authenticated;
