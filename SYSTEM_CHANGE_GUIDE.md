# Attendance Payroll System Change Guide

This file is a quick reference for developers who need to modify this system.

## 1) What this system is

- Frontend: React + Vite (`src/`)
- Backend API: Express (`server/`)
- Database: MySQL (`attendance_payroll` by default)
- Auth: JWT + bcrypt password hashing

## 2) High-level request flow

1. User submits login in frontend.
2. Frontend calls `/api/auth/login`.
3. Vite proxy forwards `/api/*` to `http://localhost:4000` in development.
4. Backend validates credentials against MySQL `users` table.
5. On success, backend returns JWT + user profile.

## 3) Main files to know before changing anything

### Backend
- `server/server.js`: app setup, middleware, route registration.
- `server/db.js`: MySQL pool and query helper.
- `server/routes/auth.js`: login, profile, password endpoints.
- `server/routes/teachers.js`: teacher CRUD endpoints.
- `server/routes/schedules.js`: schedule CRUD endpoints.
- `server/routes/settings.js`: attendance settings endpoints.
- `server/routes/attendance.js`: attendance scan/log endpoints.
- `server/middleware/auth.js`: JWT auth and role authorization.

### Database bootstrap
- `server/scripts/initDb.js`: creates DB/tables and seeds admin account.

### Frontend
- `src/api.js`: unified API request helper.
- `src/context/AuthContext.jsx`: login/logout/token/profile behavior.
- `src/pages/LoginPage.jsx`: login form UI and submit logic.

## 4) Commands you will use often

```bash
npm run db:init      # create DB/tables + seed admin
npm run dev:server   # API only (watch mode)
npm run server       # API only (non-watch)
npm run dev          # frontend only
npm run dev:full     # frontend + backend together
```

## 5) Deep dive: how init DB works

File: `server/scripts/initDb.js`

### Purpose
- Reads config from `.env`.
- Ensures the database exists.
- Creates required tables if missing.
- Applies lightweight schema migration safeguards.
- Seeds/refreshes default admin account.

### Initialization sequence
1. Load `.env` from project root.
2. Connect to MySQL using host/user/password/port env values.
3. `CREATE DATABASE IF NOT EXISTS` and `USE` that DB.
4. Create `users`, `teachers`, `schedules`, `attendance_settings`, `attendance` tables.
5. Run migration-safe updates (example: make sure `teacher_id` exists in `users`).
6. Insert singleton default settings row (`attendance_settings.id = 1`) with `INSERT IGNORE`.
7. Seed admin user using upsert logic.
8. Close connection.

## 6) How default admin account is populated

### Source values
Admin credentials come from `.env`:

- `ADMIN_USERNAME` (default fallback: `admin`)
- `ADMIN_PASSWORD` (default fallback: `admin123`)

### Password handling
- Plain password is never stored directly.
- Script hashes the password with bcrypt (`bcrypt.hash(adminPassword, 10)`).
- Hash is stored in `users.password_hash`.

### Upsert behavior (important)
Admin seed uses:

- `INSERT INTO users (username, password_hash, role) VALUES (...)`
- `ON DUPLICATE KEY UPDATE ...`

Current behavior on duplicate username:
- `password_hash` is updated to the newly generated hash.
- `role` is forced to `admin`.
- `teacher_id` is reset to `NULL`.

This means re-running `npm run db:init` now refreshes admin credentials correctly.

## 7) Why admin login can fail even if .env looks correct

Common cause (already fixed in this project):
- Old seed logic did not update `password_hash` when `username` already existed.
- Result: `.env` password changed, but DB still had old hash.

Current script fixes that by updating the hash on duplicate username.

## 8) Safe change checklist

Before changing code:
1. Confirm `.env` values (DB and admin vars).
2. Run `npm run db:init` to normalize schema + seed data.
3. Start API and verify `/api/health`.

After changing backend/auth/db logic:
1. Re-run `npm run db:init` if schema/seed affected.
2. Test login (`admin` / configured admin password).
3. Verify protected routes still require valid JWT.

## 9) If you need to modify account behavior

Use this guide:
- Change login validation: `server/routes/auth.js`
- Change token payload/expiry: `server/routes/auth.js`
- Change password hashing policy: `server/scripts/initDb.js` and `server/routes/auth.js`
- Change default admin seed behavior: `server/scripts/initDb.js`
- Change auth guards and roles: `server/middleware/auth.js`

## 10) Notes for future maintainers

- Keep `initDb.js` idempotent: it should be safe to run many times.
- Prefer additive migrations (check then alter) to avoid breaking existing data.
- Never store plaintext passwords.
- If admin login fails, inspect `users.password_hash` and verify seed upsert path first.
