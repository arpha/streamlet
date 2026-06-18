-- ====================================================================
-- OFFERWALL BOOSTER DATABASE SETUP SCRIPT (EVENT TICKETS)
-- Run this script in the Supabase SQL Editor dashboard.
-- ====================================================================

-- 1. Add booster columns to the offerwall_claims table if they do not exist
ALTER TABLE public.offerwall_claims ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.offerwall_claims ADD COLUMN IF NOT EXISTS boost_points_added INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.offerwall_claims ADD COLUMN IF NOT EXISTS boosted_at TIMESTAMP WITH TIME ZONE;

-- 2. Create the offerwall_booster_logs table for booster usage history
CREATE TABLE IF NOT EXISTS public.offerwall_booster_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  claim_id UUID NOT NULL REFERENCES public.offerwall_claims(id) ON DELETE CASCADE,
  points_boosted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for performance optimization on log queries
CREATE INDEX IF NOT EXISTS idx_offerwall_booster_logs_user_id ON public.offerwall_booster_logs(user_id);

-- 3. Enable Row Level Security (RLS) on the logs table
ALTER TABLE public.offerwall_booster_logs ENABLE ROW LEVEL SECURITY;

-- 4. Grant access privileges
GRANT SELECT ON public.offerwall_booster_logs TO authenticated;

-- 5. RLS policy for logs table
DROP POLICY IF EXISTS "Users can view their own booster logs" ON public.offerwall_booster_logs;
CREATE POLICY "Users can view their own booster logs" ON public.offerwall_booster_logs
  FOR SELECT USING (auth.uid() = user_id);

-- 6. RPC Function: apply_offerwall_booster
CREATE OR REPLACE FUNCTION public.apply_offerwall_booster(p_claim_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_tickets INT;
  v_claim RECORD;
  v_boost_points INT;
  v_new_balance NUMERIC;
  v_new_tickets INT;
BEGIN
  -- A. Get the authenticated user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- B. Fetch user's event tickets
  SELECT event_tickets INTO v_tickets
  FROM public.profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF v_tickets < 1 THEN
    RETURN json_build_object('success', false, 'message', 'You do not have any Event Tickets to use as a booster.');
  END IF;

  -- C. Fetch offerwall claim and validate eligibility
  SELECT * INTO v_claim
  FROM public.offerwall_claims
  WHERE id = p_claim_id AND user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Offerwall claim not found.');
  END IF;

  IF v_claim.status != 'completed' THEN
    RETURN json_build_object('success', false, 'message', 'Booster can only be used on claims with completed status.');
  END IF;

  IF v_claim.is_boosted THEN
    RETURN json_build_object('success', false, 'message', 'This offerwall claim has already been boosted.');
  END IF;

  IF v_claim.completed_at < (now() - INTERVAL '7 days') THEN
    RETURN json_build_object('success', false, 'message', 'Booster time limit has expired (only valid for 1 week after task completion).');
  END IF;

  -- D. Calculate booster points (50% of the base points)
  v_boost_points := FLOOR(v_claim.points_reward * 0.5);
  IF v_boost_points < 1 THEN
    RETURN json_build_object('success', false, 'message', 'Reward points are too small to be boosted.');
  END IF;

  -- E. Deduct 1 ticket from user's profile
  UPDATE public.profiles
  SET event_tickets = event_tickets - 1
  WHERE id = v_user_id
  RETURNING event_tickets INTO v_new_tickets;

  -- F. Add booster points to user's balance
  UPDATE public.profiles
  SET balance = balance + v_boost_points
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- G. Update offerwall_claims table
  UPDATE public.offerwall_claims
  SET is_boosted = TRUE,
      boost_points_added = v_boost_points,
      points_reward = points_reward + v_boost_points,
      boosted_at = now()
  WHERE id = p_claim_id;

  -- H. Record history in the booster logs table
  INSERT INTO public.offerwall_booster_logs (user_id, claim_id, points_boosted)
  VALUES (v_user_id, p_claim_id, v_boost_points);

  RETURN json_build_object(
    'success', true,
    'message', 'Booster successfully applied! Balance increased by 50% (+' || v_boost_points || ' Pts).',
    'new_balance', v_new_balance,
    'new_tickets', v_new_tickets,
    'points_added', v_boost_points
  );
END;
$$;
