import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const teachersRouter = Router()

teachersRouter.get('/', authorizeRoles('admin', 'payroll_viewer'), async (req, res) => {
  const search = req.query.q?.trim()

  const rows = search
    ? await query(
        `SELECT t.id, t.employee_no, t.first_name, t.last_name, t.department, t.hourly_rate, t.status, t.created_at,
                u.id AS user_id, u.username AS account_username
         FROM teachers t
         LEFT JOIN users u ON u.teacher_id = t.id AND u.role = 'teacher'
         WHERE t.employee_no LIKE ? OR t.first_name LIKE ? OR t.last_name LIKE ? OR t.department LIKE ?
         ORDER BY t.created_at DESC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
      )
    : await query(
        `SELECT t.id, t.employee_no, t.first_name, t.last_name, t.department, t.hourly_rate, t.status, t.created_at,
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
  const { employee_no, first_name, last_name, department, hourly_rate, status } = req.body

  if (!employee_no || !first_name || !last_name || !department) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  try {
    await query(
      `INSERT INTO teachers (employee_no, first_name, last_name, department, hourly_rate, status)
       VALUES (?, ?, ?, ?, ?, ?)`
      ,
      [employee_no, first_name, last_name, department, hourly_rate ?? 0, status || 'active'],
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
  const { employee_no, first_name, last_name, department, hourly_rate, status } = req.body

  if (!employee_no || !first_name || !last_name || !department) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  try {
    const result = await query(
      `UPDATE teachers
       SET employee_no = ?, first_name = ?, last_name = ?, department = ?, hourly_rate = ?, status = ?
       WHERE id = ?`,
      [
        employee_no,
        first_name,
        last_name,
        department,
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
