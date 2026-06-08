-- ====================================================================
-- SKRIP SETUP DATABASE PESAN USER
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Buat tabel user_messages
CREATE TABLE IF NOT EXISTS public.user_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Mengaktifkan Row Level Security (RLS)
ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

-- 3. Policy: User bisa melihat (SELECT) pesan miliknya sendiri
CREATE POLICY "Users can view their own messages"
ON public.user_messages
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Policy: User bisa mengupdate pesan miliknya sendiri (misal: is_read = true)
CREATE POLICY "Users can update their own messages"
ON public.user_messages
FOR UPDATE
USING (auth.uid() = user_id);

-- 5. Policy: Admin bisa melakukan apa saja (ALL)
CREATE POLICY "Admins can do everything on user_messages"
ON public.user_messages
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND is_admin = true
    )
);

-- 6. RPC: Fungsi untuk mengirim pesan ke semua pengguna (Broadcast)
CREATE OR REPLACE FUNCTION public.send_message_to_all_users(
    p_title TEXT,
    p_content TEXT
)
RETURNS JSON
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_inserted_count INT;
BEGIN
    -- Pastikan pemanggil adalah admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    ) THEN
        RETURN json_build_object('success', false, 'message', 'Unauthorized');
    END IF;

    -- Insert ke semua user
    INSERT INTO public.user_messages (user_id, title, content)
    SELECT id, p_title, p_content FROM public.profiles;

    GET DIAGNOSTICS v_inserted_count = ROW_COUNT;

    RETURN json_build_object('success', true, 'message', 'Sent to all users', 'count', v_inserted_count);
END;
$$;
