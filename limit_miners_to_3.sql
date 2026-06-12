-- UPDATE FUNCTION TO ENFORCE MAXIMUM OF 3 ACTIVE MINERS PER USER
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
  v_active_miners_count INT;
BEGIN
  -- Get logged in user ID
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Unauthorized');
  END IF;

  -- 0. Enforce maximum of 3 active miners
  SELECT COUNT(*)::INT INTO v_active_miners_count
  FROM public.user_miners
  WHERE user_id = v_user_id AND expires_at > now();
  
  IF v_active_miners_count >= 3 THEN
    RETURN json_build_object('success', false, 'message', 'Batas maksimal miner aktif adalah 3. Anda tidak dapat membeli miner lagi saat ini.');
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
