-- ====================================================================
-- SKRIP SETUP AKTIVITAS PEMAIN TERBARU UNTUK PUBLIK
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_recent_player_activities()
RETURNS TABLE (
  activity_type TEXT,
  username TEXT,
  amount TEXT,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH all_activities AS (
    -- Faucet Claims
    (SELECT 
      'faucet'::TEXT as activity_type,
      p.username,
      (f.amount || ' Pts')::TEXT as amount,
      'Faucet Claim'::TEXT as details,
      f.claimed_at as created_at
    FROM public.faucet_claims f
    JOIN public.profiles p ON f.user_id = p.id
    ORDER BY f.claimed_at DESC
    LIMIT 10)
    
    UNION ALL
    
    -- Shortlink Claims
    (SELECT 
      'shortlink'::TEXT as activity_type,
      p.username,
      ('+' || s.points_reward || ' Pts')::TEXT as amount,
      (s.provider || ' Shortlink')::TEXT as details,
      COALESCE(s.completed_at, s.created_at) as created_at
    FROM public.shortlink_claims s
    JOIN public.profiles p ON s.user_id = p.id
    WHERE s.status = 'completed'
    ORDER BY COALESCE(s.completed_at, s.created_at) DESC
    LIMIT 10)
    
    UNION ALL
    
    -- Offerwall Claims
    (SELECT 
      'offerwall'::TEXT as activity_type,
      p.username,
      ('+' || o.points_reward || ' Pts')::TEXT as amount,
      (o.provider || ' Offerwall')::TEXT as details,
      o.created_at as created_at
    FROM public.offerwall_claims o
    JOIN public.profiles p ON o.user_id = p.id
    WHERE o.status = 'completed'
    ORDER BY o.created_at DESC
    LIMIT 10)
    
    UNION ALL
    
    -- Withdrawals
    (SELECT 
      'withdrawal'::TEXT as activity_type,
      p.username,
      ('-' || w.amount || ' Pts')::TEXT as amount,
      ('Withdrawal ' || w.coin)::TEXT as details,
      w.created_at as created_at
    FROM public.withdrawals w
    JOIN public.profiles p ON w.user_id = p.id
    ORDER BY w.created_at DESC
    LIMIT 10)

    UNION ALL
    
    -- Daily Checkins
    (SELECT 
      'checkin'::TEXT as activity_type,
      p.username,
      ('Streak Day ' || d.streak_day)::TEXT as amount,
      'Daily Check-in'::TEXT as details,
      d.claimed_at as created_at
    FROM public.daily_checkin_logs d
    JOIN public.profiles p ON d.user_id = p.id
    ORDER BY d.claimed_at DESC
    LIMIT 10)

    UNION ALL

    -- Mining Claims
    (SELECT 
      'mining'::TEXT as activity_type,
      p.username,
      (CASE WHEN m.claim_type = 'purchase' THEN '-' ELSE '+' END || m.amount || ' Pts')::TEXT as amount,
      (CASE WHEN m.claim_type = 'purchase' THEN 'Miner Purchase' ELSE 'Miner Reward Claim' END)::TEXT as details,
      m.claimed_at as created_at
    FROM public.mining_claims m
    JOIN public.profiles p ON m.user_id = p.id
    ORDER BY m.claimed_at DESC
    LIMIT 10)
  )
  SELECT 
    a.activity_type, 
    a.username, 
    a.amount, 
    a.details, 
    a.created_at
  FROM all_activities a
  ORDER BY a.created_at DESC
  LIMIT 10;
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.get_recent_player_activities() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_player_activities() TO anon;
