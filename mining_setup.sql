-- ====================================================================
-- DATABASE SETUP SCRIPT FOR VIRTUAL MINER GAME
-- Run this script in the SQL Editor of your Supabase dashboard.
-- ====================================================================

-- 1. Create user_miners table if it does not exist
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

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.user_miners ENABLE ROW LEVEL SECURITY;

-- 3. Grant access permissions to authenticated roles
GRANT SELECT ON public.user_miners TO authenticated;

-- 4. RLS Policy: Users can only view their own miners
DROP POLICY IF EXISTS "Users can view their own miners" ON public.user_miners;
CREATE POLICY "Users can view their own miners"
ON public.user_miners
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 4b. Create mining_claims table to separate mining history from faucet history
CREATE TABLE IF NOT EXISTS public.mining_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    miner_id UUID REFERENCES public.user_miners(id) ON DELETE SET NULL,
    amount INTEGER NOT NULL, -- negative for purchase, positive for claim
    claim_type TEXT NOT NULL CHECK (claim_type IN ('purchase', 'claim')),
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ip_address TEXT,
    user_agent TEXT
);

-- Enable RLS for mining_claims
ALTER TABLE public.mining_claims ENABLE ROW LEVEL SECURITY;

-- Grant permissions for mining_claims
GRANT SELECT ON public.mining_claims TO authenticated;

-- RLS Policy for mining_claims
DROP POLICY IF EXISTS "Users can view their own mining claims" ON public.mining_claims;
CREATE POLICY "Users can view their own mining claims"
ON public.mining_claims
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 5. Helper Function: Get profit multiplier based on user's current XP/Rank
CREATE OR REPLACE FUNCTION public.get_user_mining_multiplier(p_xp INT)
RETURNS NUMERIC
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_xp < 1000 THEN
    RETURN 1.00; -- Mud & Bronze (No extra bonus)
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

-- 6. Helper Function: Clean up / reset last_claimed_at if rank drops below Silver
CREATE OR REPLACE FUNCTION public.check_and_update_inactive_miners(p_user_id UUID)
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_xp INT;
BEGIN
  -- Get user's current XP
  SELECT xp INTO v_xp FROM public.profiles WHERE id = p_user_id;
  
  -- If rank dropped below Silver (< 1000 XP)
  IF v_xp < 1000 THEN
    UPDATE public.user_miners
    SET last_claimed_at = now()
    WHERE user_id = p_user_id AND expires_at > now();
  END IF;
END;
$$;

-- 7. RPC: Purchase a new Miner
DROP FUNCTION IF EXISTS public.purchase_miner(TEXT);
DROP FUNCTION IF EXISTS public.purchase_miner(TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.purchase_miner(
  p_miner_type TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
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
  -- Get logged in user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- 1. Validate Silver Rank minimum requirement (XP >= 1000)
  SELECT xp, balance INTO v_xp, v_balance FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  
  IF v_xp IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Profile not found.');
  END IF;
  
  IF v_xp < 1000 THEN
    RETURN json_build_object('success', false, 'message', 'Your rank status is too low. Silver rank or higher is required to use Virtual Miner.');
  END IF;

  -- 2. Determine cost based on miner type
  IF p_miner_type = 'coal' THEN
    v_cost := 5000;
  ELSIF p_miner_type = 'iron' THEN
    v_cost := 50000;
  ELSIF p_miner_type = 'gold' THEN
    v_cost := 500000;
  ELSE
    RETURN json_build_object('success', false, 'message', 'Invalid miner type.');
  END IF;

  -- 3. Verify point balance
  IF v_balance < v_cost THEN
    RETURN json_build_object('success', false, 'message', 'Your point balance is insufficient to purchase this miner.');
  END IF;

  -- 4. Deduct points from profile balance
  UPDATE public.profiles
  SET balance = balance - v_cost
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- 5. Insert new miner record
  INSERT INTO public.user_miners (user_id, miner_type, cost, created_at, expires_at, last_claimed_at, charged_until)
  VALUES (v_user_id, p_miner_type, v_cost, now(), now() + INTERVAL '30 days', now(), now() + INTERVAL '24 hours')
  RETURNING id INTO v_miner_id;

  -- 6. Log purchase activity
  INSERT INTO public.mining_claims (user_id, miner_id, amount, claim_type, claimed_at, ip_address, user_agent)
  VALUES (v_user_id, v_miner_id, -v_cost, 'purchase', now(), COALESCE(p_ip_address, '127.0.0.1'), COALESCE(p_user_agent, 'Purchased ' || p_miner_type || ' miner'));

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully purchased ' || p_miner_type || ' miner!',
    'new_balance', v_new_balance,
    'miner_id', v_miner_id
  );
END;
$$;

-- 8. RPC: Claim miner rewards
DROP FUNCTION IF EXISTS public.claim_miner_rewards(UUID);
DROP FUNCTION IF EXISTS public.claim_miner_rewards(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_miner_rewards(
  p_miner_id UUID,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
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
  v_active_seconds NUMERIC;
  v_total_return NUMERIC;
  v_hourly_rate NUMERIC;
  v_seconds_rate NUMERIC;
  v_reward_amount INT;
  v_used_seconds NUMERIC;
  v_new_last_claimed_at TIMESTAMP WITH TIME ZONE;
  v_new_balance INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- 1. Fetch miner details and lock row
  SELECT * INTO v_miner FROM public.user_miners WHERE id = p_miner_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Miner not found.');
  END IF;

  -- 2. Get current user XP
  SELECT xp INTO v_xp FROM public.profiles WHERE id = v_user_id FOR UPDATE;
  
  -- 3. Check if rank dropped below Silver
  IF v_xp < 1000 THEN
    -- Reset last_claimed_at to now to discard previous mining progression
    UPDATE public.user_miners SET last_claimed_at = now() WHERE id = p_miner_id;
    RETURN json_build_object('success', false, 'message', 'Miner is inactive because your rank is below Silver. Rank up to reactivate it.');
  END IF;

  -- 4. Calculate multiplier based on current XP
  v_multiplier := public.get_user_mining_multiplier(v_xp);

  -- 5. Calculate valid end time (minimum of now, expires_at, and charged_until)
  v_end_time := LEAST(now(), v_miner.expires_at, v_miner.charged_until);

  -- If last_claimed_at is after the calculated end time
  IF v_miner.last_claimed_at >= v_end_time THEN
    RETURN json_build_object('success', false, 'message', 'No new mined rewards to claim at this time.');
  END IF;

  -- 6. Calculate active seconds
  v_active_seconds := EXTRACT(EPOCH FROM (v_end_time - v_miner.last_claimed_at));
  IF v_active_seconds < 0 THEN
    v_active_seconds := 0;
  END IF;

  -- 7. Calculate payout amount
  v_total_return := v_miner.cost * v_multiplier;
  v_hourly_rate := v_total_return / 720.0;
  v_seconds_rate := v_hourly_rate / 3600.0;
  v_reward_amount := FLOOR(v_active_seconds * v_seconds_rate);

  IF v_reward_amount <= 0 THEN
    RETURN json_build_object('success', false, 'message', 'Mined rewards are too small to claim. Please wait a bit longer.');
  END IF;

  -- Calculate exactly how many seconds were used to generate this integer reward amount,
  -- so we can carry over the unused fractional part (seconds) to the next claim!
  v_used_seconds := v_reward_amount / v_seconds_rate;
  v_new_last_claimed_at := v_miner.last_claimed_at + (v_used_seconds * INTERVAL '1 second');

  -- 8. Add rewards to user balance
  UPDATE public.profiles
  SET balance = balance + v_reward_amount
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- 9. Update last_claimed_at timestamp (retaining fractional remainder)
  UPDATE public.user_miners
  SET last_claimed_at = v_new_last_claimed_at
  WHERE id = p_miner_id;

  -- 10. Log claim in history
  INSERT INTO public.mining_claims (user_id, miner_id, amount, claim_type, claimed_at, ip_address, user_agent)
  VALUES (v_user_id, p_miner_id, v_reward_amount, 'claim', now(), COALESCE(p_ip_address, '127.0.0.1'), COALESCE(p_user_agent, 'Claimed rewards from ' || v_miner.miner_type || ' miner'));

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully claimed ' || v_reward_amount || ' points from your miner!',
    'new_balance', v_new_balance,
    'reward_amount', v_reward_amount
  );
END;
$$;

-- 9. RPC: Recharge miner battery
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

  -- 1. Fetch miner details and lock row
  SELECT * INTO v_miner FROM public.user_miners WHERE id = p_miner_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Miner not found.');
  END IF;

  -- Verify expiration
  IF now() >= v_miner.expires_at THEN
    RETURN json_build_object('success', false, 'message', 'Miner is already expired. Cannot recharge.');
  END IF;

  -- 2. Get user XP
  SELECT xp INTO v_xp FROM public.profiles WHERE id = v_user_id;
  IF v_xp < 1000 THEN
    RETURN json_build_object('success', false, 'message', 'Your rank is below Silver. Miner cannot be recharged.');
  END IF;

  -- 3. Auto-claim remaining rewards first
  BEGIN
    v_claim_res := public.claim_miner_rewards(p_miner_id);
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if there are no rewards to claim
  END;

  -- Fetch updated miner details after auto-claim
  SELECT * INTO v_miner FROM public.user_miners WHERE id = p_miner_id;

  -- 4. If battery was completely dead (charged_until < now())
  --    Then reset last_claimed_at = now() so offline gap is not calculated
  IF v_miner.charged_until < now() THEN
    UPDATE public.user_miners
    SET 
      last_claimed_at = now(),
      charged_until = now() + INTERVAL '24 hours'
    WHERE id = p_miner_id;
  ELSE
    -- If battery is still active, extend charged_until by 24 hours from now
    UPDATE public.user_miners
    SET charged_until = now() + INTERVAL '24 hours'
    WHERE id = p_miner_id;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Miner battery successfully recharged for the next 24 hours!'
  );
END;
$$;

-- 10. RPC: Discard expired miner
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

  -- 1. Fetch miner details
  SELECT * INTO v_miner FROM public.user_miners WHERE id = p_miner_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Miner not found.');
  END IF;

  -- 2. Verify if miner is actually expired
  IF now() < v_miner.expires_at THEN
    RETURN json_build_object('success', false, 'message', 'Miner is not expired. You can only discard expired miners.');
  END IF;

  -- 3. Auto-claim remaining rewards one last time
  BEGIN
    v_claim_res := public.claim_miner_rewards(p_miner_id);
  EXCEPTION WHEN OTHERS THEN
    -- Ignore errors if no rewards can be claimed
  END;

  -- 4. Delete miner from database to free up space
  DELETE FROM public.user_miners WHERE id = p_miner_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Expired miner successfully discarded. Your rack slot is now empty.'
  );
END;
$$;

-- 11. RPC: Claim rewards from all active miners at once
DROP FUNCTION IF EXISTS public.claim_all_miner_rewards();
DROP FUNCTION IF EXISTS public.claim_all_miner_rewards(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.claim_all_miner_rewards(
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_miner RECORD;
  v_res JSON;
  v_total_claimed INT := 0;
  v_success_count INT := 0;
  v_new_balance INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Loop through all active miners of the user that are NOT expired
  FOR v_miner IN 
    SELECT id FROM public.user_miners 
    WHERE user_id = v_user_id AND expires_at > now()
  LOOP
    SELECT public.claim_miner_rewards(v_miner.id, p_ip_address, p_user_agent) INTO v_res;
    IF (v_res->>'success')::BOOLEAN = true THEN
      v_total_claimed := v_total_claimed + (v_res->>'reward_amount')::INT;
      v_success_count := v_success_count + 1;
    END IF;
  END LOOP;

  -- Fetch final balance
  SELECT balance INTO v_new_balance FROM public.profiles WHERE id = v_user_id;

  IF v_success_count = 0 THEN
    RETURN json_build_object('success', false, 'message', 'No rewards available to claim.');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully claimed ' || v_total_claimed || ' points from ' || v_success_count || ' miners!',
    'new_balance', v_new_balance,
    'total_claimed', v_total_claimed
  );
END;
$$;

-- 12. RPC: Recharge all active miners at once
CREATE OR REPLACE FUNCTION public.recharge_all_miners()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_miner RECORD;
  v_res JSON;
  v_success_count INT := 0;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- Loop through all active miners of the user that are NOT expired
  FOR v_miner IN 
    SELECT id FROM public.user_miners 
    WHERE user_id = v_user_id AND expires_at > now()
  LOOP
    SELECT public.recharge_miner(v_miner.id) INTO v_res;
    IF (v_res->>'success')::BOOLEAN = true THEN
      v_success_count := v_success_count + 1;
    END IF;
  END LOOP;

  IF v_success_count = 0 THEN
    RETURN json_build_object('success', false, 'message', 'No miners were recharged.');
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully recharged ' || v_success_count || ' miners!'
  );
END;
$$;
