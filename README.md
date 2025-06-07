# Backend MRJ

Backend MRJ adalah aplikasi backend berbasis Node.js dan Express yang digunakan untuk mengelola proses hafalan, murajaah, dan statistik hafalan Al-Qur'an. Proyek ini terhubung dengan database MongoDB dan menyediakan berbagai endpoint API untuk mendukung aplikasi frontend terkait.

## Fitur Utama
- **Manajemen Pengguna:** Registrasi, login, dan refresh token.
- **Hafalan (Ziyadah):** Mulai, pantau, dan selesaikan sesi hafalan ayat Al-Qur'an.
- **Vault Hafalan:** Menyimpan hafalan yang telah selesai sebelum diverifikasi oleh guru.
- **Verifikasi & Transfer:** Guru dapat memverifikasi hafalan dan memindahkan ke daftar hafalan tetap.
- **Murajaah & Revisi:** Mendukung sesi murajaah (ulangan) dan revisi hafalan.
- **Statistik:** Melihat statistik harian, mingguan, dan bulanan terkait aktivitas hafalan dan murajaah.
- **Menu Dinamis:** Mendukung menu dinamis untuk navigasi aplikasi frontend.

## Teknologi
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT (JSON Web Token)
- dotenv, helmet, cors, multer

## Instalasi
1. **Clone repository ini**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Buat file `.env`** dan tambahkan variabel berikut:
   ```env
   MONGODB_URI=mongodb://localhost:27017/mrj
   JWT_SECRET=your_jwt_secret
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   FRONTEND_URL=http://localhost:5173
   ```
4. **Jalankan server:**
   ```bash
   npm run dev
   ```

## Struktur Endpoint Utama

### Autentikasi Pengguna
- `POST /api/users/register` — Registrasi pengguna
- `POST /api/users/login` — Login pengguna
- `POST /api/users/refresh-token` — Refresh token JWT

### Hafalan (Ziyadah)
- `POST /api/memorizations/start` — Mulai hafalan baru
- `POST /api/memorizations/:entryId/sessions` — Mulai sesi hafalan baru
- `PUT /api/memorizations/:entryId/finish` — Selesaikan hafalan
- `GET /api/memorizations/:entryId/progress` — Lihat progres hafalan

### Vault Hafalan
- `GET /api/vault/` — Lihat daftar hafalan yang menunggu verifikasi
- `POST /api/vault/:vaultId/verify` — Verifikasi hafalan oleh guru

### Murajaah & Revisi
- `POST /api/revisions/start` — Mulai sesi murajaah
- `PUT /api/revisions/:sessionId/pause` — Pause/resume sesi murajaah
- `GET /api/revisions/:sessionId/status` — Status sesi murajaah

### Surah
- `GET /api/surahs/` — Daftar surah
- `GET /api/surahs/:surahNumber` — Detail surah

### Statistik
- `GET /api/stats` — Statistik total (harian/mingguan/bulanan)
- `GET /api/stats/daily-breakdown` — Statistik harian
- `GET /api/stats/weekly-breakdown` — Statistik mingguan
- `GET /api/stats/monthly-breakdown` — Statistik bulanan

### Menu
- `GET /api/menu/` — Daftar menu aktif

## Struktur Folder
- `controllers/` — Logika bisnis dan handler endpoint
- `models/` — Skema database MongoDB
- `routes/` — Definisi endpoint API
- `middleware/` — Middleware (autentikasi, dsb)
- `utils/` — Fungsi utilitas
- `scripts/` — Script untuk populate data awal

## Lisensi
Proyek ini menggunakan lisensi ISC.

---

> Untuk pertanyaan atau kontribusi, silakan buat issue atau pull request di repository ini.

---

# Backend MRJ (English Version)

Backend MRJ is a Node.js and Express-based backend application for managing Quran memorization, revision (murajaah), and memorization statistics. This project connects to a MongoDB database and provides various API endpoints to support the related frontend application.

## Main Features
- **User Management:** Registration, login, and token refresh.
- **Memorization (Ziyadah):** Start, track, and complete Quran memorization sessions.
- **Memorization Vault:** Store completed memorization before teacher verification.
- **Verification & Transfer:** Teachers can verify memorization and transfer it to the permanent memorized list.
- **Murajaah & Revision:** Supports murajaah (review) and revision sessions.
- **Statistics:** View daily, weekly, and monthly statistics related to memorization and murajaah activities.
- **Dynamic Menu:** Supports dynamic menu for frontend navigation.

## Technology
- Node.js
- Express.js
- MongoDB (Mongoose)
- JWT (JSON Web Token)
- dotenv, helmet, cors, multer

## Installation
1. **Clone this repository**
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Create a `.env` file** and add the following variables:
   ```env
   MONGODB_URI=mongodb://localhost:27017/mrj
   JWT_SECRET=your_jwt_secret
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   FRONTEND_URL=http://localhost:5173
   ```
4. **Run the server:**
   ```bash
   npm run dev
   ```

## Main Endpoint Structure

### User Authentication
- `POST /api/users/register` — Register user
- `POST /api/users/login` — User login
- `POST /api/users/refresh-token` — Refresh JWT token

### Memorization (Ziyadah)
- `POST /api/memorizations/start` — Start new memorization
- `POST /api/memorizations/:entryId/sessions` — Start new memorization session
- `PUT /api/memorizations/:entryId/finish` — Complete memorization
- `GET /api/memorizations/:entryId/progress` — View memorization progress

### Memorization Vault
- `GET /api/vault/` — View list of memorization waiting for verification
- `POST /api/vault/:vaultId/verify` — Teacher verifies memorization

### Murajaah & Revision
- `POST /api/revisions/start` — Start murajaah session
- `PUT /api/revisions/:sessionId/pause` — Pause/resume murajaah session
- `GET /api/revisions/:sessionId/status` — Murajaah session status

### Surah
- `GET /api/surahs/` — List of surahs
- `GET /api/surahs/:surahNumber` — Surah details

### Statistics
- `GET /api/stats` — Total statistics (daily/weekly/monthly)
- `GET /api/stats/daily-breakdown` — Daily statistics
- `GET /api/stats/weekly-breakdown` — Weekly statistics
- `GET /api/stats/monthly-breakdown` — Monthly statistics

### Menu
- `GET /api/menu/` — List of active menu

## Folder Structure
- `controllers/` — Business logic and endpoint handlers
- `models/` — MongoDB schema models
- `routes/` — API endpoint definitions
- `middleware/` — Middleware (authentication, etc)
- `utils/` — Utility functions
- `scripts/` — Scripts for initial data population

## License
This project uses the ISC license.

---

> For questions or contributions, please open an issue or pull request in this repository. 