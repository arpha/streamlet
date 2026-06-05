-- ====================================================================
-- SKRIP UPDATE MIGRASI GRAPH MINGGUAN (USER EARNINGS + REFERRAL COMMISSION)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_user_weekly_earnings(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_result JSON;
BEGIN
  -- Generate deretan 7 hari terakhir (dari 6 hari lalu sampai hari ini)
  -- dan hitung gabungan pendapatan faucet, shortlink, serta komisi referral.
  WITH days AS (
    SELECT generate_series(
      (now() - interval '6 days')::date,
      now()::date,
      interval '1 day'
    )::date AS earning_date
  ),
  user_faucet AS (
    SELECT 
      claimed_at::date AS earning_date,
      COALESCE(SUM(amount), 0) AS amount
    FROM public.faucet_claims
    WHERE user_id = p_user_id
      AND claimed_at >= (now() - interval '7 days')
    GROUP BY 1
  ),
  user_shortlink AS (
    SELECT 
      completed_at::date AS earning_date,
      COALESCE(SUM(points_reward), 0) AS amount
    FROM public.shortlink_claims
    WHERE user_id = p_user_id
      AND status = 'completed'
      AND completed_at >= (now() - interval '7 days')
    GROUP BY 1
  ),
  ref_ids AS (
    SELECT id 
    FROM public.profiles
    WHERE referred_by_id = p_user_id
  ),
  ref_faucet AS (
    SELECT 
      c.claimed_at::date AS earning_date,
      COALESCE(SUM(FLOOR(c.amount * 0.25)), 0) AS amount
    FROM public.faucet_claims c
    JOIN ref_ids r ON c.user_id = r.id
    WHERE c.claimed_at >= (now() - interval '7 days')
    GROUP BY 1
  ),
  ref_shortlink AS (
    SELECT 
      c.completed_at::date AS earning_date,
      COALESCE(SUM(FLOOR(c.points_reward * 0.10)), 0) AS amount
    FROM public.shortlink_claims c
    JOIN ref_ids r ON c.user_id = r.id
    WHERE c.status = 'completed'
      AND c.completed_at >= (now() - interval '7 days')
    GROUP BY 1
  )
  SELECT json_agg(
    json_build_object(
      'date', d.earning_date,
      'day_name', to_char(d.earning_date, 'Dy'), -- Hasil: 'Mon', 'Tue', 'Wed', dll.
      'points', (
        COALESCE(uf.amount, 0) + 
        COALESCE(us.amount, 0) + 
        COALESCE(rf.amount, 0) + 
        COALESCE(rs.amount, 0)
      )::INT
    ) ORDER BY d.earning_date
  ) INTO v_result
  FROM days d
  LEFT JOIN user_faucet uf ON d.earning_date = uf.earning_date
  LEFT JOIN user_shortlink us ON d.earning_date = us.earning_date
  LEFT JOIN ref_faucet rf ON d.earning_date = rf.earning_date
  LEFT JOIN ref_shortlink rs ON d.earning_date = rs.earning_date;

  RETURN COALESCE(v_result, '[]'::JSON);
END;
$$;
