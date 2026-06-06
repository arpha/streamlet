-- ====================================================================
-- SKRIP SETUP LIST REFERRAL DETAIL (USERNAME, XP, & KONTRIBUSI)
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

CREATE OR REPLACE FUNCTION public.get_referrals_list(p_user_id UUID)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_referrals JSON;
BEGIN
  SELECT json_agg(t) INTO v_referrals
  FROM (
    SELECT 
      ref.username,
      ref.xp,
      (
        COALESCE(
          (SELECT FLOOR(SUM(fc.amount) * 0.25) FROM public.faucet_claims fc WHERE fc.user_id = ref.id),
          0
        ) +
        COALESCE(
          (SELECT FLOOR(SUM(sc.points_reward) * 0.10) FROM public.shortlink_claims sc WHERE sc.user_id = ref.id AND sc.status = 'completed'),
          0
        )
      )::INT AS contribution
    FROM public.profiles ref
    WHERE ref.referred_by_id = p_user_id
    ORDER BY contribution DESC, ref.xp DESC
  ) t;

  RETURN COALESCE(v_referrals, '[]'::JSON);
END;
$$;
