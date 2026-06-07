-- ====================================================================
-- SKRIP MIGRASI OTOMATISASI EMAIL DI TABEL PROFILES
-- Jalankan skrip ini di SQL Editor dashboard Supabase Anda.
-- ====================================================================

-- 1. Perbarui fungsi trigger handle_new_user agar secara otomatis
--    mengisi kolom 'email' saat pengguna baru mendaftar.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  ref_by_id UUID;
  base_code TEXT;
  final_code TEXT;
  counter INT := 0;
BEGIN
  -- Dapatkan referred_by_id berdasarkan metadata 'referred_by_code'
  IF new.raw_user_meta_data ? 'referred_by_code' AND (new.raw_user_meta_data->>'referred_by_code') IS NOT NULL AND (new.raw_user_meta_data->>'referred_by_code') <> '' THEN
    SELECT id INTO ref_by_id 
    FROM public.profiles 
    WHERE referral_code = (new.raw_user_meta_data->>'referred_by_code')
    LIMIT 1;
  END IF;

  -- Buat kode referral unik dari username
  base_code := COALESCE(new.raw_user_meta_data->>'username', 'user');
  -- Bersihkan karakter non-alphanumeric dan jadikan lowercase
  base_code := LOWER(REGEXP_REPLACE(base_code, '[^a-zA-Z0-9]', '', 'g'));
  IF base_code = '' THEN
    base_code := 'user';
  END IF;
  final_code := base_code;

  -- Cari kode yang belum dipakai
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = final_code) LOOP
    counter := counter + 1;
    final_code := base_code || counter;
  END LOOP;

  -- Masukkan profil baru dengan kolom email terisi
  INSERT INTO public.profiles (id, username, email, balance, xp, referral_code, referred_by_id)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', new.email),
    new.email,
    0,
    0,
    final_code,
    ref_by_id
  );

  RETURN new;
END;
$$;

-- 2. Pastikan trigger terpasang pada auth.users jika belum ada
--    (skrip ini aman karena menggunakan CREATE OR REPLACE / DROP IF EXISTS pattern)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Satu kali sinkronisasi (Backfill) untuk mengisi email di profil yang masih NULL
--    menggunakan data email dari tabel otentikasi auth.users.
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;
