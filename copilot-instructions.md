# Copilot Agent Instructions — Attendance-Based Salary Computation

## Stack & Language Rules
- **Frontend:** Vite + React. All frontend files use `.jsx` for components and `.js` for utilities/constants.
- **Backend:** Node.js + Express. All backend files use `.js` only.
- **Database:** MySQL with **raw SQL queries** using the `db.js` connection pool. Never suggest or introduce Prisma, Sequelize, TypeORM, or any ORM/query builder.
- **Language:** JavaScript only — `.js` and `.jsx`. Never use TypeScript, never add type annotations, `.ts`, `.tsx`, or `tsconfig` files.

---

## Project Structure — Follow This Exactly

```
attendance-salary-computation/
├── server/
│   ├── middleware/        # Express middlewares (e.g., auth guards)
│   ├── routes/            # One file per domain: attendance.js, auth.js, salaryComputation.js, schedules.js, settings.js, teachers.js
│   ├── scripts/
│   │   └── initDb.js      # DB seed/init scripts
│   ├── db.js              # MySQL connection pool — import this for all queries
│   └── server.js          # Express app entry point
└── src/
    ├── app/               # App-level config (router setup, etc.)
    ├── assets/            # Static assets
    ├── components/        # Reusable UI components (shared across pages)
    ├── constants/         # Shared constants and enums
    ├── context/
    │   ├── AuthContext.jsx        # React context provider
    │   ├── authContextObject.jsx  # Context object definition
    │   └── useAuth.jsx            # Custom hook for auth context
    ├── layout/
    │   └── AppLayout.jsx  # Main layout wrapper (nav, shell, etc.)
    └── pages/             # One file per route/page
        ├── AttendancePage.jsx
        ├── DashboardPage.jsx
        ├── LoginPage.jsx
        ├── MyAttendancePage.jsx
        └── ScanPage.jsx
```

---

## Architecture Patterns to Always Follow

### Backend
- All routes live in `server/routes/`. Each file maps to one domain. Register new routes in `server.js`.
- All database access uses the pool from `server/db.js`. Pattern:
  ```js
  const db = require('../db');
  const [rows] = await db.query('SELECT * FROM table WHERE id = ?', [id]);
  ```
- Always use parameterized queries — never string-interpolate user input into SQL.
- Middleware (auth checks, etc.) goes in `server/middleware/` and is applied per-route or per-router.

### Frontend
- **Pages** go in `src/pages/`. One file per route. Pages are responsible for data fetching and layout composition.
- **Reusable UI** goes in `src/components/`. Components should be stateless or self-contained where possible.
- **Auth state** is accessed only via the `useAuth` hook from `src/context/useAuth.jsx`. Never read auth state directly from localStorage or props drilling across pages.
- **Constants and enums** (roles, statuses, config values) go in `src/constants/`. Never hardcode magic strings in components or pages.
- **App layout** is handled by `AppLayout.jsx`. Pages are rendered inside it via the router — don't re-implement nav or shell inside individual pages.
- API calls from the frontend are plain `fetch()` calls. No Axios unless it already exists in the project.

---

## Code Style Rules
- Use `const` and `let` — never `var`.
- Use `async/await` — no raw `.then()` chains unless already present in surrounding code.
- Arrow functions for component definitions and callbacks.
- No semicolons if the existing code omits them — match the file's existing style.
- Keep components focused. If a page file is getting long, extract sections into `src/components/`.

---

## What NOT to Do
- Do not add TypeScript or JSDoc type annotations.
- Do not install or reference Prisma, Sequelize, Mongoose, or any ORM.
- Do not create new top-level folders outside the established structure without asking.
- Do not move existing files or rename them unless explicitly asked.
- Do not add a state management library (Redux, Zustand, Jotai, etc.) unless explicitly asked.
- Do not change the database connection pattern in `db.js`.
- Do not add CSS-in-JS libraries — match whatever styling approach (plain CSS, modules, etc.) is already in use in the file being edited.

---

## When Adding Something New

| What | Where to put it |
|---|---|
| New API endpoint | `server/routes/<domain>.js`, registered in `server.js` |
| New page/route | `src/pages/<PageName>.jsx`, add route in `src/app/` |
| New reusable component | `src/components/<ComponentName>.jsx` |
| New shared constant | `src/constants/` |
| New middleware | `server/middleware/` |
| DB schema changes | `server/scripts/initDb.js` |

---

Always preserve existing patterns in whichever file you are editing. When in doubt, match the style and structure of the nearest existing file in the same folder.
