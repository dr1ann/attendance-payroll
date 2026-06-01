# STI Ormoc Attendance-Based Salary Management System (MVP)

A simple school system project for STI College Ormoc to:

1. Track teacher attendance through QR code scanning.
2. Compute salary based on approved attendance records.

This project is intentionally minimal and practical for an individual capstone/class requirement.

## Current Implementation Status

The system now has working backend and frontend modules for:

- JWT authentication with role-based access.
- Teacher CRUD with required type (`full_time` or `part_time`).
- Schedule CRUD.
- QR attendance scan flow with duplicate scan protection.
- Attendance settings management.
- Salary computation API with type-based attendance calculation.

## Project Scope (Simple MVP)

### Included

- Admin login and role-based access.
- Teacher masterlist and schedule management.
- QR attendance scanning (Time In / Time Out).
- Attendance logs and basic correction workflow.
- Attendance-based salary computation per cutoff period.
- Printable/exportable salary summary.

### Not Included (for now)

- Biometric attendance devices.
- Multi-campus sync.
- Advanced government deduction engines.
- Complex analytics and forecasting.

## User Roles

- **Admin (HR/Owner)**
	- Manage teachers, schedules, and attendance corrections.
	- Compute attendance-based salaries and generate reports.
- **Teacher**
	- Scan QR for daily attendance.
- **Salary Viewer (optional)**
	- Read-only view of salary computations.

## Core Modules

1. **Authentication**
2. **Teacher Management**
3. **Schedule Management**
4. **QR Attendance Scanning**
5. **Attendance Logs & Approvals**
6. **Salary Computation**
7. **Reports**

## MVP Screens (Exact List)

1. Login
2. Dashboard
3. Teachers
4. Schedules
5. Scan Attendance
6. Attendance Logs
7. Salary Cutoff
8. Salary Report

## Data Model (Simple Schema)

### `users`

- `id` (PK)
- `username`
- `password_hash`
- `role` (`admin`, `salary_viewer`, `teacher`)
- `teacher_id` (nullable FK reference by convention)
- `created_at`

### `teachers`

- `id` (PK)
- `employee_no` (unique)
- `first_name`
- `last_name`
- `department`
- `teacher_type` (`full_time`, `part_time`)
- `monthly_salary`
- `session_rate`
- `hourly_rate` (legacy field, still present)
- `status` (`active`, `inactive`)
- `created_at`

### `schedules`

- `id` (PK)
- `teacher_id` (FK → teachers.id)
- `day_of_week`
- `time_start`
- `time_end`

### `attendance`

- `id` (PK)
- `teacher_id` (FK → teachers.id)
- `schedule_id` (FK → schedules.id, nullable)
- `scan_time`
- `scan_type` (`time_in`, `time_out`)
- `status` (`on_time`, `late`)
- `created_at`

### `attendance_settings`

- `id` (singleton = 1)
- `late_grace_minutes`
- `duplicate_scan_window_minutes`
- `late_deduction_amount`
- `absence_deduction_amount`
- `timezone`

Late grace for attendance is configured globally in `attendance_settings.late_grace_minutes`.

## Basic Salary Computation Rules (Current)

- `Present`: valid Time In and Time Out on a scheduled day.
- `Late`: Time In beyond schedule start + configured late grace minutes.
- `Absence`: expected schedule session with no complete attendance pair.
- Overtime: disabled for now.
- Salary formulas:
	- Full-time: `gross_pay = monthly_salary`
	- Part-time: `gross_pay = attended_sessions * session_rate`
	- Deductions (both types):
		- `late_deduction_total = late_count * late_deduction_amount`
		- `absence_deduction_total = absence_count * absence_deduction_amount`
	- `net_pay = max(0, gross_pay - late_deduction_total - absence_deduction_total)`

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

### Phase 3: Salary Computation

- Add cutoff creation.
- Compute salary entries from approved attendance.
- Build printable salary report view.

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
4. Connect attendance logs to salary calculator function.

## Run the Project

```bash
npm install
npm run db:init
npm run dev:full
```

## Backend (Phase 1)

This project now includes a Node.js + Express backend for Phase 1:

- Token-based authentication (JWT)
- Role access (`admin`, `salary_viewer`, `teacher`)
- Teacher masterlist CRUD with type-specific compensation fields
- Schedule CRUD
- Attendance scan and logs
- Attendance settings (singleton) including salary computation deduction amounts
- Salary computation summary and teacher breakdown APIs

### Current API Modules

- `/api/auth` - login, profile, account management
- `/api/teachers` - teacher CRUD and teacher profile
- `/api/schedules` - schedule CRUD and teacher schedule view
- `/api/attendance` - scan flow and attendance logs
- `/api/settings/attendance` - attendance and deduction configuration
- `/api/salary-computation/summary` - salary results by period
- `/api/salary-computation/teacher/:id/breakdown` - per-teacher attendance breakdown by period

### Environment Setup

1. Create a `.env` file at the project root.
2. Add the required values: `PORT`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD`.
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
