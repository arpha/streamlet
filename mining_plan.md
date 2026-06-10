# Rencana Fitur: Virtual Miner Game (Simulasi Tambang Kripto)

Rencana ini dibuat untuk menambahkan fitur Virtual Miner ke situs ArphaGames. Silakan edit file ini langsung jika ada bagian yang ingin Anda sesuaikan atau perbaiki.

---

## 1. Skema Database (`mining_setup.sql`)

Kita akan membuat tabel baru `user_miners` dan beberapa fungsi RPC Supabase:

### A. Tabel `public.user_miners`
* `id` UUID DEFAULT gen_random_uuid() PRIMARY KEY
* `user_id` UUID REFERENCES public.profiles(id) ON DELETE CASCADE
* `miner_type` TEXT NOT NULL (Pilihan: 'coal', 'iron', 'gold')
* `cost` INT NOT NULL (Biaya poin saat pembelian)
* `created_at` TIMESTAMP WITH TIME ZONE DEFAULT now()
* `expires_at` TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '30 days')
* `last_claimed_at` TIMESTAMP WITH TIME ZONE DEFAULT now()
* `charged_until` TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours')

### B. Fungsi PostgreSQL Helper & RPC
1. **`get_user_mining_multiplier(p_xp INT)`**
   * Mengembalikan persentase profit berdasarkan XP/Rank user saat klaim:
     * **Mud & Bronze** (XP < 1.000): Tidak diizinkan ikut (Multiplier: 1.00 - Tidak mendapat keuntungan tambahan)
     * **Silver** (XP 1.000 - 9.999): 3% profit (Multiplier: 1.03)
     * **Gold** (XP 10.000 - 99.999): 6% profit (Multiplier: 1.06)
     * **Platinum** (XP 100.000 - 999.999): 10% profit (Multiplier: 1.10)
     * **Diamond** (XP >= 1.000.000): 15% profit (Multiplier: 1.15)
     
2. **`purchase_miner(p_miner_type TEXT)`**
   * Verifikasi apakah XP user minimal 1.000 (Rank Silver). Jika di bawah itu, pembelian ditolak.
   * Verifikasi apakah poin user cukup.
   * Kurangi saldo poin user di `public.profiles`.
   * Masukkan record baru ke tabel `user_miners`.
   
3. **`claim_miner_rewards(p_miner_id UUID)`**
   * Verifikasi apakah XP user saat ini minimal 1.000 (Rank Silver). Jika di bawah 1.000, proses dihentikan dengan pesan error.
   * Rumus perhitungan poin:
     * Jika XP user saat ini < 1.000 (Mud/Bronze), miner tidak aktif (menghasilkan 0 poin).
     * `end_time` = Batas terkecil antara `now()`, `expires_at`, dan `charged_until`.
     * `active_hours` = Jumlah jam antara `last_claimed_at` dan `end_time` (jika bernilai negatif, dihitung 0).
     * `total_return` = `cost * multiplier` (misal 5000 * 1.03 = 5150 poin).
     * `hourly_rate` = `total_return / 720.0` (720 jam = 30 hari).
     * `reward` = `active_hours * hourly_rate`.
   * Tambahkan `reward` ke saldo user.
   * Update `last_claimed_at` = `end_time`.

4. **`check_and_update_inactive_miners(p_user_id UUID)`**
   * Fungsi helper untuk mendeteksi jika rank user turun di bawah Silver (< 1.000 XP).
   * Jika XP < 1.000, fungsi ini secara otomatis memperbarui `last_claimed_at = now()` pada semua miner aktif milik user tersebut.
   * Ini memastikan bahwa selama user berstatus Mud/Bronze, miner mereka berstatus **Paused** (tidak menimbun waktu menambang), dan waktu penambangan selama masa rank rendah tersebut hangus (tidak bisa diklaim ketika nanti naik kembali ke Silver).
   * Fungsi ini dipanggil setiap kali user membuka halaman Mining Room.

5. **`recharge_miner(p_miner_id UUID)`**
   * Klaim otomatis reward berjalan terlebih dahulu (untuk mengamankan poin yang sudah dihasilkan sebelum baterai di-reset).
   * Jika baterai sudah sempat mati (`charged_until < now()`):
     * Set `last_claimed_at = now()` (agar jeda waktu mati/off tidak menghasilkan poin).
   * Set `charged_until = now() + INTERVAL '24 hours'`.

6. **`delete_expired_miner(p_miner_id UUID)`**
   * Verifikasi bahwa miner tersebut memang sudah kedaluwarsa (`now() >= expires_at`).
   * Klaim secara otomatis sisa koin yang belum sempat diambil (hingga batas waktu `expires_at`), lalu hapus record miner tersebut dari database untuk mengosongkan rak/slot.

---

## 2. Antarmuka Halaman Depan (`src/app/mining/page.tsx`)

Halaman ini akan memiliki tema cyberpunk/glassmorphism gelap, terbagi menjadi dua tab utama:

### Tab 1: Mining Room (Daftar Miner Aktif)
* **Status Miner:**
  * 🟢 **Mining** (Baterai masih menyala & belum kedaluwarsa).
  * 🔴 **Need Charge** (Baterai habis tetapi belum kedaluwarsa).
  * 💀 **Expired** (Sudah melewati 30 hari).
* **Indikator Visual:**
  * Lingkaran progres (*circular progress bar*) untuk daya baterai 24 jam.
  * Teks sisa hari aktif (contoh: "23 Days Left").
  * Akumulasi poin yang belum diklaim (berjalan real-time di frontend).
* **Tombol Aksi:**
  * Tombol **Claim Rewards** untuk menarik poin terkumpul.
  * Tombol **Recharge Baterai** untuk mengisi ulang daya baterai selama 24 jam.
  * Tombol **Trash / Buang Miner** (hanya muncul saat status **Expired**): Untuk membersihkan rak dengan mengklaim sisa hadiah otomatis lalu menghapus miner dari database.

### Tab 2: Miner Shop (Toko Miner)
Pemain dapat membeli miner menggunakan saldo Poin mereka:
1. **Coal Miner (Low Tier):** Harga 5.000 Poin.
2. **Iron Miner (Mid Tier):** Harga 50.000 Poin.
3. **Gold Miner (High Tier):** Harga 500.000 Poin.

Setiap kartu miner di toko akan menampilkan secara transparan perkiraan hasil keuntungan berdasarkan rank level pemain saat itu.

---

## 3. Integrasi Navigasi (`Navbar.tsx`)
* Tambahkan link **"Mining Room"** di dropdown profil user (di sebelah "Profile" atau "Withdraw").
