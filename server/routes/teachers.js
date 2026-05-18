import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const teachersRouter = Router()

function validateTeacherPayload(payload) {
  const {
    employee_no,
    first_name,
    last_name,
    department,
    teacher_type,
    monthly_salary,
    session_rate,
  } = payload

  if (!employee_no || !first_name || !last_name || !department) {
    return 'Missing required fields'
  }

  if (!['full_time', 'part_time'].includes(teacher_type)) {
    return 'Teacher type must be either full_time or part_time'
  }

  if (teacher_type === 'full_time') {
    if (monthly_salary === '' || Number.isNaN(Number(monthly_salary))) {
      return 'Monthly salary is required for full-time teachers'
    }
    if (Number(monthly_salary) < 0) {
      return 'Monthly salary cannot be negative'
    }
  }

  if (teacher_type === 'part_time') {
    if (session_rate === '' || Number.isNaN(Number(session_rate))) {
      return 'Session rate is required for part-time teachers'
    }
    if (Number(session_rate) < 0) {
      return 'Session rate cannot be negative'
    }
  }

  return null
}

teachersRouter.get('/', authorizeRoles('admin', 'payroll_viewer'), async (req, res) => {
  const search = req.query.q?.trim()

  const rows = search
    ? await query(
        `SELECT t.id, t.employee_no, t.first_name, t.last_name, t.department, t.hourly_rate, t.status, t.created_at,
          t.teacher_type, t.monthly_salary, t.session_rate,
                u.id AS user_id, u.username AS account_username
         FROM teachers t
         LEFT JOIN users u ON u.teacher_id = t.id AND u.role = 'teacher'
         WHERE t.employee_no LIKE ? OR t.first_name LIKE ? OR t.last_name LIKE ? OR t.department LIKE ?
         ORDER BY t.created_at DESC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
      )
    : await query(
        `SELECT t.id, t.employee_no, t.first_name, t.last_name, t.department, t.hourly_rate, t.status, t.created_at,
          t.teacher_type, t.monthly_salary, t.session_rate,
                u.id AS user_id, u.username AS account_username
         FROM teachers t
         LEFT JOIN users u ON u.teacher_id = t.id AND u.role = 'teacher'
         ORDER BY t.created_at DESC`,
      )

  const mapped = rows.map((r) => ({
    ...r,
    has_account: Boolean(r.user_id),
    user_id: undefined,
    account_username: r.account_username || null,
  }))

  res.json(mapped)
})

teachersRouter.get('/me', authorizeRoles('teacher'), async (req, res) => {
  const teacherId = req.user.teacher_id

  if (!teacherId) {
    return res.status(400).json({ message: 'No teacher profile linked to this account' })
  }

  const rows = await query(
      `SELECT t.id, t.employee_no, t.first_name, t.last_name, t.department, t.hourly_rate, t.status, t.created_at,
        t.teacher_type, t.monthly_salary, t.session_rate,
            u.id AS user_id, u.username AS account_username
     FROM teachers t
     LEFT JOIN users u ON u.teacher_id = t.id AND u.role = 'teacher'
     WHERE t.id = ?
     LIMIT 1`,
    [teacherId],
  )

  const teacher = rows[0]

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' })
  }

  const payload = {
    ...teacher,
    has_account: Boolean(teacher.user_id),
    user_id: undefined,
    account_username: teacher.account_username || null,
  }

  res.json(payload)
})

teachersRouter.post('/', authorizeRoles('admin'), async (req, res) => {
  const {
    employee_no,
    first_name,
    last_name,
    department,
    teacher_type,
    monthly_salary,
    session_rate,
    hourly_rate,
    status,
  } = req.body

  const validationMessage = validateTeacherPayload(req.body)
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage })
  }

  try {
    await query(
      `INSERT INTO teachers (employee_no, first_name, last_name, department, teacher_type, monthly_salary, session_rate, hourly_rate, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ,
      [
        employee_no,
        first_name,
        last_name,
        department,
        teacher_type,
        teacher_type === 'full_time' ? Number(monthly_salary || 0) : 0,
        teacher_type === 'part_time' ? Number(session_rate || 0) : 0,
        hourly_rate ?? 0,
        status || 'active',
      ],
    )
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Employee number already exists' })
    }
    throw err
  }

  return res.status(201).json({ message: 'Teacher created' })
})

teachersRouter.put('/:id', authorizeRoles('admin'), async (req, res) => {
  const {
    employee_no,
    first_name,
    last_name,
    department,
    teacher_type,
    monthly_salary,
    session_rate,
    hourly_rate,
    status,
  } = req.body

  const validationMessage = validateTeacherPayload(req.body)
  if (validationMessage) {
    return res.status(400).json({ message: validationMessage })
  }

  try {
    const result = await query(
      `UPDATE teachers
       SET employee_no = ?, first_name = ?, last_name = ?, department = ?, teacher_type = ?,
           monthly_salary = ?, session_rate = ?, hourly_rate = ?, status = ?
       WHERE id = ?`,
      [
        employee_no,
        first_name,
        last_name,
        department,
        teacher_type,
        teacher_type === 'full_time' ? Number(monthly_salary || 0) : 0,
        teacher_type === 'part_time' ? Number(session_rate || 0) : 0,
        hourly_rate ?? 0,
        status || 'active',
        req.params.id,
      ],
    )

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Teacher not found' })
    }
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Employee number already exists' })
    }
    throw err
  }

  return res.json({ message: 'Teacher updated' })
})

teachersRouter.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  const result = await query('DELETE FROM teachers WHERE id = ?', [req.params.id])

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Teacher not found' })
  }

  return res.json({ message: 'Teacher deleted' })
})
