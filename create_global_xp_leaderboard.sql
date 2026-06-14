-- Migration to create Global XP Leaderboard RPC

CREATE OR REPLACE FUNCTION public.get_global_xp_leaderboard(p_user_id UUID DEFAULT NULL)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_leaderboard JSON;
  v_user_rank INT;
  v_user_xp INT;
BEGIN
  -- 1. Get top 100 players
  SELECT json_agg(t) INTO v_leaderboard
  FROM (
    SELECT 
      COALESCE(p.username, 'User_' || substring(p.id::text, 1, 8))::TEXT as username,
      p.xp::INT as xp,
      ROW_NUMBER() OVER (ORDER BY p.xp DESC)::INT AS rank
    FROM public.profiles p
    ORDER BY p.xp DESC
    LIMIT 100
  ) t;

  -- 2. Get current user's rank and XP
  IF p_user_id IS NOT NULL THEN
    SELECT xp INTO v_user_xp FROM public.profiles WHERE id = p_user_id;
    
    SELECT rank INTO v_user_rank
    FROM (
      SELECT id, ROW_NUMBER() OVER (ORDER BY xp DESC)::INT AS rank
      FROM public.profiles
    ) r
    WHERE r.id = p_user_id;
  END IF;

  RETURN json_build_object(
    'leaderboard', COALESCE(v_leaderboard, '[]'::json),
    'user_xp', v_user_xp,
    'user_rank', v_user_rank
  );
END;
$$;
