-- ====================================================================
-- DATABASE MIGRATION: PROVIDER-SPECIFIC SHORTLINK LIMITS
-- ====================================================================

-- 1. Update start_shortlink_visit RPC to apply separate limits
CREATE OR REPLACE FUNCTION public.start_shortlink_visit(
  p_user_id UUID,
  p_provider TEXT,
  p_reward INT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_completed_today_provider INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_visit_id UUID;
  v_limit INT;
BEGIN
  -- Set limit based on provider
  IF p_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF p_provider = 'exeio' THEN
    v_limit := 4;
  ELSE
    v_limit := 5; -- default fallback
  END IF;

  -- 1. Count claims completed in last 24 hours for this provider
  SELECT COUNT(*) INTO v_completed_today_provider
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = p_provider
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  IF v_completed_today_provider >= v_limit THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached for ' || p_provider || ' (Max ' || v_limit || ' per 24 hours)');
  END IF;

  -- 2. Check 30-minute cooldown since last completion (global cooldown)
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
    RETURN json_build_object(
      'success', false, 
      'message', 'Cooldown in progress. Please wait 30 minutes between shortlinks.'
    );
  END IF;

  -- 3. Delete old pending visits for this user
  DELETE FROM public.shortlink_claims
  WHERE user_id = p_user_id 
    AND status = 'pending'
    AND created_at < (now() - interval '1 hour');

  -- 4. Insert new pending claim
  INSERT INTO public.shortlink_claims (user_id, provider, points_reward, status)
  VALUES (p_user_id, p_provider, p_reward, 'pending')
  RETURNING id INTO v_visit_id;

  RETURN json_build_object(
    'success', true,
    'visit_id', v_visit_id
  );
END;
$$;


-- 2. Update complete_shortlink_visit RPC to apply double-check separate limits
CREATE OR REPLACE FUNCTION public.complete_shortlink_visit(
  p_visit_id UUID
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

  -- Set limit based on provider
  IF v_provider = 'shrinkme' THEN
    v_limit := 1;
  ELSIF v_provider = 'exeio' THEN
    v_limit := 4;
  ELSE
    v_limit := 5;
  END IF;

  -- 2. Double-check daily limit for this provider
  SELECT COUNT(*) INTO v_completed_today_provider
  FROM public.shortlink_claims
  WHERE user_id = v_user_id
    AND provider = v_provider
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  IF v_completed_today_provider >= v_limit THEN
    RETURN json_build_object('success', false, 'message', 'Daily limit reached for ' || v_provider || ' (Max ' || v_limit || ' per 24 hours)');
  END IF;

  -- 3. Double-check 30-minute cooldown (global)
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = v_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL AND (now() - v_last_completion) < interval '30 minutes' THEN
    RETURN json_build_object('success', false, 'message', 'Cooldown active. Please wait 30 minutes.');
  END IF;

  -- 4. Mark visit as completed
  UPDATE public.shortlink_claims
  SET status = 'completed',
      completed_at = now()
  WHERE id = p_visit_id;

  -- 5. Award Points & XP (10 XP)
  UPDATE public.profiles
  SET balance = balance + v_reward,
      xp = xp + 10
  WHERE id = v_user_id
  RETURNING balance INTO v_new_balance;

  -- 6. Award referral commission (10%)
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
    'message', 'Successfully claimed ' || v_reward || ' Points & 10 XP!',
    'new_balance', v_new_balance,
    'reward_given', v_reward
  );
END;
$$;


-- 3. Update get_user_shortlink_stats RPC to return breakdown of completed visits
CREATE OR REPLACE FUNCTION public.get_user_shortlink_stats(
  p_user_id UUID
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_completed_today INT;
  v_completed_shrinkme INT;
  v_completed_exeio INT;
  v_last_completion TIMESTAMP WITH TIME ZONE;
  v_cooldown_remaining INT := 0;
  v_total_earned BIGINT;
BEGIN
  -- 1. Count total completed today
  SELECT COUNT(*) INTO v_completed_today
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  -- 2. Count completed today per provider
  SELECT COUNT(*) INTO v_completed_shrinkme
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'shrinkme'
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  SELECT COUNT(*) INTO v_completed_exeio
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND provider = 'exeio'
    AND status = 'completed'
    AND completed_at >= (now() - interval '24 hours');

  -- 3. Calculate remaining cooldown (seconds)
  SELECT completed_at INTO v_last_completion
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1;

  IF v_last_completion IS NOT NULL THEN
    IF (now() - v_last_completion) < interval '30 minutes' THEN
      v_cooldown_remaining := EXTRACT(EPOCH FROM (interval '30 minutes' - (now() - v_last_completion)))::INT;
    END IF;
  END IF;

  -- 4. Calculate total earnings
  SELECT COALESCE(SUM(points_reward), 0) INTO v_total_earned
  FROM public.shortlink_claims
  WHERE user_id = p_user_id
    AND status = 'completed';

  RETURN json_build_object(
    'completed_today', v_completed_today,
    'completed_shrinkme', v_completed_shrinkme,
    'completed_exeio', v_completed_exeio,
    'cooldown_remaining', v_cooldown_remaining,
    'total_earned', v_total_earned
  );
END;
$$;
