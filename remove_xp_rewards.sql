-- ====================================================================
-- REMOVE XP REWARDS FROM FAUCET, SHORTLINKS, & OFFERWALLS
-- Run this script in the Supabase Dashboard SQL Editor.
-- ====================================================================

-- 1. Redefine claim_faucet (XP reward removed)
CREATE OR REPLACE FUNCTION public.claim_faucet(
  u_id UUID,
  reward_xp_val INT, -- parameter kept for backward-compatibility with API calls, but ignored
  cooldown_sec INT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_device_fingerprint TEXT DEFAULT NULL
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
  -- 0. Run inactivity decay first
  PERFORM public.check_and_apply_xp_decay(u_id);

  -- 1. Check claim cooldown limit
  SELECT claimed_at INTO last_claim
  FROM public.faucet_claims
  WHERE user_id = u_id
  ORDER BY claimed_at DESC
  LIMIT 1;

  IF last_claim IS NOT NULL AND (now() - last_claim) < (cooldown_sec * interval '1 second') THEN
    RETURN json_build_object('success', false, 'message', 'Cooldown in progress');
  END IF;

  -- 2. Fetch original faucet reward value from settings
  SELECT value::INT INTO reward_amount
  FROM public.site_settings
  WHERE key = 'faucet_reward'
  LIMIT 1;

  IF reward_amount IS NULL THEN
    reward_amount := 10; -- fallback
  END IF;

  -- Fetch current XP to determine level bonus or penality
  SELECT xp INTO user_xp FROM public.profiles WHERE id = u_id LIMIT 1;
  
  -- 2b. Check Rank and adjust reward
  IF user_xp < 0 THEN
    -- Rank Mud: Penalty cut 50%
    reward_amount := FLOOR(reward_amount * 0.5);
  ELSIF user_xp >= 1000000 THEN
    -- Diamond (+15%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.15);
  ELSIF user_xp >= 100000 THEN
    -- Platinum (+10%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.10);
  ELSIF user_xp >= 10000 THEN
    -- Gold (+6%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.06);
  ELSIF user_xp >= 1000 THEN
    -- Silver (+3%)
    reward_amount := reward_amount + CEIL(reward_amount * 0.03);
  END IF;

  -- 3. Insert claim log
  INSERT INTO public.faucet_claims (user_id, amount, claimed_at, ip_address, user_agent, device_fingerprint)
  VALUES (u_id, reward_amount, now(), p_ip_address, p_user_agent, p_device_fingerprint);

  -- 4. Add points (NO XP ADDED) and reset decay check timestamp
  UPDATE public.profiles
  SET 
    balance = balance + reward_amount,
    last_decay_checked_at = now()
  WHERE id = u_id;

  -- 5. Give 25% referral commission if referrer exists
  SELECT referred_by_id INTO ref_id
  FROM public.profiles
  WHERE id = u_id
  LIMIT 1;

  IF ref_id IS NOT NULL THEN
    ref_commission := FLOOR(reward_amount * 0.25);
    IF ref_commission > 0 THEN
      UPDATE public.profiles
      SET balance = balance + ref_commission
      WHERE id = ref_id;
    END IF;
  END IF;

  -- 6. Get new balance
  SELECT balance INTO new_bal
  FROM public.profiles
  WHERE id = u_id;

  RETURN json_build_object(
    'success', true, 
    'message', 'Faucet claimed successfully!', 
    'reward_given', reward_amount, 
    'new_balance', new_bal
  );
END;
$$;

-- 2. Redefine complete_shortlink_visit (XP reward removed)
CREATE OR REPLACE FUNCTION public.complete_shortlink_visit(
  p_visit_id UUID,
  p_callback_ip TEXT DEFAULT NULL,
  p_callback_user_agent TEXT DEFAULT NULL,
  p_callback_device_fingerprint TEXT DEFAULT NULL
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_user_id UUID;
  v_reward INT;
  v_status TEXT;
  v_provider TEXT;
  v_completed_today_provider INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_new_balance NUMERIC;
  v_ref_id UUID;
  v_ref_commission INT;
  v_limit INT;
  user_xp INT;
BEGIN
  -- 1. Fetch visit details
  SELECT user_id, points_reward, status, provider INTO v_user_id, v_reward, v_status, v_provider
  FROM public.shortlink_claims
  WHERE id = p_visit_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Shortlink visit not found');
  END IF;

  IF v_status = 'completed' THEN
    RETURN json_build_object('success', false, 'message', 'This shortlink visit has already been claimed');
  END IF;

  -- 1b. Run decay before rewarding
  PERFORM public.check_and_apply_xp_decay(v_user_id);

  -- Fetch latest XP
  SELECT xp INTO user_xp FROM public.profiles WHERE id = v_user_id LIMIT 1;

  -- 1c. Apply Mud rank penalty (-50%) or level bonus
  IF user_xp < 0 THEN
    v_reward := FLOOR(v_reward * 0.5);
  ELSIF user_xp >= 1000000 THEN
    -- Diamond (+15%)
    v_reward := v_reward + CEIL(v_reward * 0.15);
  ELSIF user_xp >= 100000 THEN
    -- Platinum (+10%)
    v_reward := v_reward + CEIL(v_reward * 0.10);
  ELSIF user_xp >= 10000 THEN
    -- Gold (+6%)
    v_reward := v_reward + CEIL(v_reward * 0.06);
  ELSIF user_xp >= 1000 THEN
    -- Silver (+3%)
    v_reward := v_reward + CEIL(v_reward * 0.03);
  END IF;

  -- Set limit based on provider
  IF v_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF v_provider = 'exeio' THEN
    v_limit := 2;
  ELSIF v_provider = 'fclc' THEN
    v_limit := 2;
  ELSIF v_provider = 'cuty' THEN
    v_limit := 1;
  ELSE
    v_limit := 5;
  END IF;

  -- 2. Double-check daily limit
  SELECT COUNT(*) INTO v_completed_today_provider
  FROM public.shortlink_claims
  WHERE user_id = v_user_id
    AND provider = v_provider
    AND status = 'completed'
    AND completed_at >= date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';

  IF v_completed_today_provider >= v_limit THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached for ' || v_provider || ' (Max ' || v_limit || ' per day)');
  END IF;

  -- 3. Double-check cooldown 30 minutes
  IF v_limit > 1 THEN
    SELECT completed_at INTO v_last_completion
    FROM public.shortlink_claims
    WHERE user_id = v_user_id
      AND provider = v_provider
      AND status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1;

    IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
      RETURN json_build_object('success', false, 'message', 'Cooldown active for ' || v_provider || '. Please wait.');
    END IF;
  END IF;

  -- 4. Mark visit as completed
  UPDATE public.shortlink_claims
  SET status = 'completed',
      completed_at = now(),
      ip_address = COALESCE(ip_address, p_callback_ip),
      user_agent = COALESCE(user_agent, p_callback_user_agent),
      device_fingerprint = COALESCE(device_fingerprint, p_callback_device_fingerprint)
  WHERE id = p_visit_id;

  -- 5. Give points reward (NO XP ADDED) and update decay timestamp
  UPDATE public.profiles
  SET balance = balance + v_reward,
      last_decay_checked_at = now()
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- 6. Referral Commission (10%)
  SELECT referred_by_id INTO v_ref_id
  FROM public.profiles
  WHERE id = v_user_id
  LIMIT 1;

  IF v_ref_id IS NOT NULL THEN
    v_ref_commission := FLOOR(v_reward * 0.10);
    IF v_ref_commission > 0 THEN
      UPDATE public.profiles
      SET balance = balance + v_ref_commission
      WHERE id = v_ref_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Successfully claimed ' || v_reward || ' Points!',
    'new_balance', v_new_balance,
    'reward_given', v_reward
  );
END;
$$;

-- 3. Redefine process_offerwall_completion (XP reward removed)
CREATE OR REPLACE FUNCTION public.process_offerwall_completion(
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
  user_xp INT;
  v_adjusted_reward INT;
BEGIN
  -- 1. Check if transaction already processed
  SELECT COUNT(*) INTO v_exists
  FROM public.offerwall_claims
  WHERE provider = p_provider AND transaction_id = p_transaction_id;

  IF v_exists > 0 THEN
    RETURN json_build_object('success', false, 'message', 'Transaction already processed');
  END IF;

  -- Fetch current XP
  SELECT xp INTO user_xp FROM public.profiles WHERE id = p_user_id LIMIT 1;
  
  -- 2. Apply penalty or rank bonus
  IF user_xp < 0 THEN
    v_adjusted_reward := FLOOR(p_reward_points * 0.5);
  ELSIF user_xp >= 1000000 THEN
    v_adjusted_reward := p_reward_points + CEIL(p_reward_points * 0.15);
  ELSIF user_xp >= 100000 THEN
    v_adjusted_reward := p_reward_points + CEIL(p_reward_points * 0.10);
  ELSIF user_xp >= 10000 THEN
    v_adjusted_reward := p_reward_points + CEIL(p_reward_points * 0.06);
  ELSIF user_xp >= 1000 THEN
    v_adjusted_reward := p_reward_points + CEIL(p_reward_points * 0.03);
  ELSE
    v_adjusted_reward := p_reward_points;
  END IF;

  -- 3. Insert claim log
  INSERT INTO public.offerwall_claims (user_id, provider, transaction_id, points_reward, payout_usd, status)
  VALUES (p_user_id, p_provider, p_transaction_id, v_adjusted_reward, p_payout_usd, 'completed');

  -- 4. Add points (NO XP ADDED) and update decay timestamp
  UPDATE public.profiles
  SET balance = balance + v_adjusted_reward,
      last_decay_checked_at = now()
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 5. Referral Commission (10%)
  SELECT referred_by_id INTO v_ref_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_ref_id IS NOT NULL THEN
    v_ref_commission := FLOOR(v_adjusted_reward * 0.10);
    IF v_ref_commission > 0 THEN
      UPDATE public.profiles
      SET balance = balance + v_ref_commission
      WHERE id = v_ref_id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Offerwall claim completed successfully',
    'new_balance', v_new_balance
  );
END;
$$;

-- 4. Redefine process_offerwall_cancellation (XP subtraction removed)
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
  v_reward_given INT;
BEGIN
  -- 1. Check if completed transaction exists
  SELECT points_reward INTO v_reward_given
  FROM public.offerwall_claims
  WHERE provider = p_provider AND transaction_id = p_transaction_id AND status = 'completed';

  IF v_reward_given IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Completed transaction not found');
  END IF;

  -- 2. Mark transaction as canceled
  UPDATE public.offerwall_claims
  SET status = 'canceled'
  WHERE provider = p_provider AND transaction_id = p_transaction_id;

  -- 3. Deduct points (NO XP SUBTRACTED)
  UPDATE public.profiles
  SET balance = GREATEST(0, balance - v_reward_given)
  WHERE id = p_user_id
  RETURNING balance INTO v_new_balance;

  -- 4. Revoke referral commission if exists
  SELECT referred_by_id INTO v_ref_id
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_ref_id IS NOT NULL THEN
    v_ref_commission := FLOOR(v_reward_given * 0.10);
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
