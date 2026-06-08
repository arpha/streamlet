-- ====================================================================
-- SKRIP SETUP DATABASE DAILY CHECK-IN 7 HARI
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Tambahkan kolom ke tabel profiles jika belum ada
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_checkin_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS checkin_streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS event_tickets INTEGER NOT NULL DEFAULT 0;

-- 2. Buat tabel daily_checkin_logs untuk riwayat klaim
CREATE TABLE IF NOT EXISTS public.daily_checkin_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    streak_day INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL,
    reward_tickets INTEGER NOT NULL DEFAULT 0,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Mengaktifkan Row Level Security (RLS)
ALTER TABLE public.daily_checkin_logs ENABLE ROW LEVEL SECURITY;

-- 4. Berikan hak akses (GRANT) ke role authenticated
GRANT SELECT ON public.daily_checkin_logs TO authenticated;

-- 5. Kebijakan RLS: User hanya bisa melihat log miliknya sendiri
DROP POLICY IF EXISTS "Users can view their own check-in logs" ON public.daily_checkin_logs;
CREATE POLICY "Users can view their own check-in logs"
ON public.daily_checkin_logs
FOR SELECT
USING (auth.uid() = user_id);

-- 6. Fungsi RPC: Memproses klaim absen harian secara atomik
CREATE OR REPLACE FUNCTION public.claim_daily_checkin()
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    u_id UUID;
    v_last_checkin TIMESTAMP WITH TIME ZONE;
    v_streak INTEGER;
    v_new_streak INTEGER;
    v_xp INTEGER;
    v_tickets INTEGER;
    v_new_xp INTEGER;
    v_new_tickets INTEGER;
    v_today_start TIMESTAMP WITH TIME ZONE;
    v_yesterday_start TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Dapatkan ID user yang memanggil (authenticated user)
    u_id := auth.uid();
    IF u_id IS NULL THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Tentukan batas hari ini dan kemarin berdasarkan waktu UTC (reset pukul 00:00 UTC / 07:00 WIB)
    v_today_start := date_trunc('day', now() AT TIME ZONE 'UTC');
    v_yesterday_start := v_today_start - INTERVAL '1 day';

    -- Ambil data check-in terakhir dan streak dari profile
    SELECT last_checkin_at, checkin_streak INTO v_last_checkin, v_streak
    FROM public.profiles
    WHERE id = u_id
    FOR UPDATE;

    -- Validasi: Jika sudah klaim hari ini (sejak 00:00 UTC)
    IF v_last_checkin IS NOT NULL AND v_last_checkin >= v_today_start THEN
        RETURN json_build_object('success', false, 'message', 'Anda sudah melakukan absen harian hari ini.');
    END IF;

    -- Tentukan streak baru
    IF v_last_checkin IS NULL THEN
        -- Absen pertama kali
        v_new_streak := 1;
    ELSIF v_last_checkin >= v_yesterday_start THEN
        -- Absen beruntun (kemarin absen, hari ini absen)
        IF v_streak >= 7 THEN
            -- Ulangi dari hari ke-1 jika sudah selesai 7 hari
            v_new_streak := 1;
        ELSE
            v_new_streak := v_streak + 1;
        END IF;
    ELSE
        -- Bolos absen (kemarin tidak absen), reset ke hari ke-1
        v_new_streak := 1;
    END IF;

    -- Tentukan hadiah berdasarkan streak hari
    IF v_new_streak = 1 THEN v_xp := 5; v_tickets := 0;
    ELSIF v_new_streak = 2 THEN v_xp := 10; v_tickets := 0;
    ELSIF v_new_streak = 3 THEN v_xp := 15; v_tickets := 0;
    ELSIF v_new_streak = 4 THEN v_xp := 20; v_tickets := 0;
    ELSIF v_new_streak = 5 THEN v_xp := 30; v_tickets := 0;
    ELSIF v_new_streak = 6 THEN v_xp := 40; v_tickets := 0;
    ELSIF v_new_streak = 7 THEN v_xp := 50; v_tickets := 1;
    ELSE
        -- Fallback pengaman
        v_new_streak := 1;
        v_xp := 5;
        v_tickets := 0;
    END IF;

    -- Perbarui profiles user
    UPDATE public.profiles
    SET 
        xp = xp + v_xp,
        event_tickets = event_tickets + v_tickets,
        checkin_streak = v_new_streak,
        last_checkin_at = now()
    WHERE id = u_id
    RETURNING xp, event_tickets INTO v_new_xp, v_new_tickets;

    -- Catat log absen harian
    INSERT INTO public.daily_checkin_logs (user_id, streak_day, reward_xp, reward_tickets)
    VALUES (u_id, v_new_streak, v_xp, v_tickets);

    RETURN json_build_object(
        'success', true,
        'message', 'Absen harian berhasil diklaim!',
        'streak_day', v_new_streak,
        'reward_xp', v_xp,
        'reward_tickets', v_tickets,
        'new_xp', v_new_xp,
        'new_tickets', v_new_tickets
    );
END;
$$;
