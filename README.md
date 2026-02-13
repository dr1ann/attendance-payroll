# STI Ormoc Teacher Attendance + Payroll (MVP)

A simple school system project for STI College Ormoc to:

1. Track teacher attendance through QR code scanning.
2. Compute payroll based on approved attendance records.

This project is intentionally minimal and practical for an individual capstone/class requirement.

## Project Scope (Simple MVP)

### Included

- Admin login and role-based access.
- Teacher masterlist and schedule management.
- QR attendance scanning (Time In / Time Out).
- Attendance logs and basic correction workflow.
- Payroll computation per cutoff period.
- Printable/exportable payroll summary.

### Not Included (for now)

- Biometric attendance devices.
- Multi-campus sync.
- Advanced government deduction engines.
- Complex analytics and forecasting.

## User Roles

- **Admin (HR/Owner)**
	- Manage teachers, schedules, and attendance corrections.
	- Process payroll and generate reports.
- **Teacher**
	- Scan QR for daily attendance.
- **Payroll Viewer (optional)**
	- Read-only view of payroll summaries.

## Core Modules

1. **Authentication**
2. **Teacher Management**
3. **Schedule Management**
4. **QR Attendance Scanning**
5. **Attendance Logs & Approvals**
6. **Payroll Processing**
7. **Reports**

## MVP Screens (Exact List)

1. Login
2. Dashboard
3. Teachers
4. Schedules
5. Scan Attendance
6. Attendance Logs
7. Payroll Cutoff
8. Payroll Report

## Data Model (Simple Schema)

### `users`

- `id` (PK)
- `username`
- `password_hash`
- `role` (`admin`, `payroll_viewer`)
- `created_at`

### `teachers`

- `id` (PK)
- `employee_no` (unique)
- `first_name`
- `last_name`
- `department`
- `hourly_rate` (or `daily_rate`)
- `status` (`active`, `inactive`)
- `qr_token` (unique)
- `created_at`

### `schedules`

- `id` (PK)
- `teacher_id` (FK → teachers.id)
- `day_of_week`
- `time_start`
- `time_end`
- `grace_minutes`

### `attendance_logs`

- `id` (PK)
- `teacher_id` (FK → teachers.id)
- `scan_type` (`in`, `out`)
- `scan_time`
- `remarks` (`present`, `late`, `incomplete`, `manual_adjusted`)
- `source` (`qr`, `manual`)
- `approved_by` (FK → users.id, nullable)
- `created_at`

### `payroll_cutoffs`

- `id` (PK)
- `date_from`
- `date_to`
- `status` (`draft`, `finalized`)
- `created_by` (FK → users.id)
- `created_at`

### `payroll_entries`

- `id` (PK)
- `cutoff_id` (FK → payroll_cutoffs.id)
- `teacher_id` (FK → teachers.id)
- `approved_hours`
- `late_count`
- `gross_pay`
- `deductions`
- `net_pay`
- `updated_at`

## Basic Payroll Rules (MVP)

- `Present`: valid Time In and Time Out on a scheduled day.
- `Late`: Time In beyond schedule start + grace minutes.
- `Incomplete`: missing Time In or Time Out (excluded until corrected).
- Payroll formula:
	- `gross_pay = approved_hours * hourly_rate`
	- `net_pay = gross_pay - deductions`

## QR Attendance Flow

1. Teacher opens scan page or uses campus scanner.
2. QR token is read and matched to teacher record.
3. System determines whether scan is Time In or Time Out.
4. System validates duplicate scans and minimum interval.
5. Attendance record is stored and reflected in logs/dashboard.

## Implementation Plan

### Phase 1: Foundation

- Build login and role access.
- Add teacher and schedule CRUD.
- Configure STI-inspired visual theme.

### Phase 2: Attendance

- Implement QR token generation and scan endpoint.
- Save Time In/Time Out logs with validation.
- Add attendance logs with correction + approval action.

### Phase 3: Payroll

- Add cutoff creation.
- Compute payroll entries from approved attendance.
- Build printable payroll report view.

## STI-Inspired UI Palette

Use these core colors consistently:

- Primary Blue: `#0B3B8F`
- Dark Blue: `#082F72`
- Accent Yellow: `#F4C300`
- Neutrals: `#F5F7FB`, `#FFFFFF`, `#1E293B`

## Suggested Next Build Tasks

1. Implement local mock data for teachers and logs.
2. Create reusable table and form components.
3. Add scan simulation (button/QR text input) before camera integration.
4. Connect attendance logs to payroll calculator function.

## Run the Project

```bash
npm install
npm run db:init
npm run dev:full
```

## Backend (Phase 1)

This project now includes a Node.js + Express backend for Phase 1:

- Token-based authentication (JWT)
- Role access (`admin`, `payroll_viewer`)
- Teacher masterlist CRUD
- Schedule CRUD
- School calendar CRUD
- Attendance settings (singleton)

### Environment Setup

1. Copy `server/.env.example` to `.env` at the project root.
2. Update MySQL values (`DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
3. Set `JWT_SECRET` to a secure value.

### Useful Commands

```bash
npm run db:init       # create DB/tables and seed admin account
npm run dev:server    # run API only (http://localhost:4000)
npm run server        # run API without watch mode
```

Default seeded credentials are controlled by `.env`:

- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin123`
