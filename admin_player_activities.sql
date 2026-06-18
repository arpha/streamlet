-- ====================================================================
-- SKRIP SETUP SEKIRITI, AKTIVITAS & HEARTBEAT PEMAIN UNTUK ADMIN
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Tambah kolom last_active_at pada tabel profiles jika belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITH TIME ZONE;

-- 2. Fungsi RPC untuk mengupdate status aktivitas/heartbeat user (dipanggil dari client)
CREATE OR REPLACE FUNCTION public.update_user_activity()
RETURNS VOID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    UPDATE public.profiles
    SET last_active_at = now()
    WHERE id = auth.uid();
  END IF;
END;
$$;

-- 3. Berikan izin akses eksekusi ke user terautentikasi
GRANT EXECUTE ON FUNCTION public.update_user_activity() TO authenticated;

-- 4. Hapus fungsi lama jika ada (untuk menghindari error perubahan tipe return)
DROP FUNCTION IF EXISTS public.get_admin_player_activities(UUID, TEXT, TEXT, INT, INT);

-- 5. Fungsi utama untuk mengambil semua aktivitas dengan status online
CREATE OR REPLACE FUNCTION public.get_admin_player_activities(
  p_user_id UUID,
  p_search TEXT DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_limit INT DEFAULT 50,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  activity_type TEXT,
  username TEXT,
  email TEXT,
  amount TEXT,
  details TEXT,
  ip_address TEXT,
  device_fingerprint TEXT,
  status TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  last_active_at TIMESTAMP WITH TIME ZONE
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  -- Verifikasi apakah user yang memanggil adalah admin
  SELECT is_admin INTO v_is_admin FROM public.profiles WHERE id = p_user_id;
  IF v_is_admin IS NOT TRUE THEN
    RAISE EXCEPTION 'Akses ditolak. Anda bukan Admin.';
  END IF;

  RETURN QUERY
  WITH all_activities AS (
    -- Faucet Claims
    SELECT 
      'faucet'::TEXT as activity_type,
      p.username,
      p.email,
      (f.amount || ' Pts')::TEXT as amount,
      'Faucet Claim'::TEXT as details,
      f.ip_address::TEXT,
      f.device_fingerprint::TEXT,
      'completed'::TEXT as status,
      f.claimed_at as created_at,
      p.last_active_at
    FROM public.faucet_claims f
    JOIN public.profiles p ON f.user_id = p.id
    
    UNION ALL
    
    -- Shortlink Claims
    SELECT 
      'shortlink'::TEXT as activity_type,
      p.username,
      p.email,
      ('+' || s.points_reward || ' Pts')::TEXT as amount,
      (s.provider || ' Shortlink')::TEXT as details,
      s.ip_address::TEXT,
      s.device_fingerprint::TEXT,
      s.status::TEXT,
      COALESCE(s.completed_at, s.created_at) as created_at,
      p.last_active_at
    FROM public.shortlink_claims s
    JOIN public.profiles p ON s.user_id = p.id
    
    UNION ALL
    
    -- Offerwall Claims
    SELECT 
      'offerwall'::TEXT as activity_type,
      p.username,
      p.email,
      ('+' || o.points_reward || ' Pts')::TEXT as amount,
      (o.provider || ' Offerwall')::TEXT as details,
      NULL::TEXT as ip_address,
      NULL::TEXT as device_fingerprint,
      o.status::TEXT,
      o.created_at as created_at,
      p.last_active_at
    FROM public.offerwall_claims o
    JOIN public.profiles p ON o.user_id = p.id
    
    UNION ALL
    
    -- Withdrawals
    SELECT 
      'withdrawal'::TEXT as activity_type,
      p.username,
      p.email,
      ('-' || w.amount || ' Pts')::TEXT as amount,
      ('Withdraw ' || w.coin || ' to ' || w.address)::TEXT as details,
      NULL::TEXT as ip_address,
      NULL::TEXT as device_fingerprint,
      w.status::TEXT,
      w.created_at as created_at,
      p.last_active_at
    FROM public.withdrawals w
    JOIN public.profiles p ON w.user_id = p.id

    UNION ALL
    
    -- Daily Checkins
    SELECT 
      'checkin'::TEXT as activity_type,
      p.username,
      p.email,
      ('Day ' || d.streak_day)::TEXT as amount,
      'Daily Check-in'::TEXT as details,
      NULL::TEXT as ip_address,
      NULL::TEXT as device_fingerprint,
      'completed'::TEXT as status,
      d.claimed_at as created_at,
      p.last_active_at
    FROM public.daily_checkin_logs d
    JOIN public.profiles p ON d.user_id = p.id

    UNION ALL

    -- Miner Claims & Purchases
    SELECT 
      'mining'::TEXT as activity_type,
      p.username,
      p.email,
      (CASE WHEN m.amount > 0 THEN '+' ELSE '' END || m.amount || ' Pts')::TEXT as amount,
      COALESCE(m.user_agent, CASE WHEN m.claim_type = 'purchase' THEN 'Miner Purchase' ELSE 'Miner Claim' END)::TEXT as details,
      m.ip_address::TEXT,
      NULL::TEXT as device_fingerprint,
      'completed'::TEXT as status,
      m.claimed_at as created_at,
      p.last_active_at
    FROM public.mining_claims m
    JOIN public.profiles p ON m.user_id = p.id

    UNION ALL

    -- Offerwall Booster Logs
    SELECT 
      'booster'::TEXT as activity_type,
      p.username,
      p.email,
      ('+' || b.points_boosted || ' Pts')::TEXT as amount,
      ('Offerwall Booster (' || o.provider || ')')::TEXT as details,
      NULL::TEXT as ip_address,
      NULL::TEXT as device_fingerprint,
      'completed'::TEXT as status,
      b.created_at as created_at,
      p.last_active_at
    FROM public.offerwall_booster_logs b
    JOIN public.profiles p ON b.user_id = p.id
    JOIN public.offerwall_claims o ON b.claim_id = o.id
  )
  SELECT 
    a.activity_type, 
    a.username, 
    a.email, 
    a.amount, 
    a.details, 
    a.ip_address, 
    a.device_fingerprint, 
    a.status, 
    a.created_at,
    a.last_active_at
  FROM all_activities a
  WHERE 
    (p_type IS NULL OR a.activity_type = p_type)
    AND (
      p_search IS NULL 
      OR a.username ILIKE '%' || p_search || '%'
      OR a.email ILIKE '%' || p_search || '%'
      OR a.ip_address ILIKE '%' || p_search || '%'
      OR a.device_fingerprint ILIKE '%' || p_search || '%'
      OR a.details ILIKE '%' || p_search || '%'
    )
  ORDER BY a.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
