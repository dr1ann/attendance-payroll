import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const teachersRouter = Router()

teachersRouter.get('/', authorizeRoles('admin', 'payroll_viewer'), async (req, res) => {
  const search = req.query.q?.trim()

  const rows = search
    ? await query(
        `SELECT id, employee_no, first_name, last_name, department, hourly_rate, status, created_at
         FROM teachers
         WHERE employee_no LIKE ? OR first_name LIKE ? OR last_name LIKE ? OR department LIKE ?
         ORDER BY created_at DESC`,
        [`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
      )
    : await query(
        `SELECT id, employee_no, first_name, last_name, department, hourly_rate, status, created_at
         FROM teachers
         ORDER BY created_at DESC`,
      )

  res.json(rows)
})

teachersRouter.post('/', authorizeRoles('admin'), async (req, res) => {
  const { employee_no, first_name, last_name, department, hourly_rate, status } = req.body

  if (!employee_no || !first_name || !last_name || !department) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  await query(
    `INSERT INTO teachers (employee_no, first_name, last_name, department, hourly_rate, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [employee_no, first_name, last_name, department, hourly_rate ?? 0, status || 'active'],
  )

  return res.status(201).json({ message: 'Teacher created' })
})

teachersRouter.put('/:id', authorizeRoles('admin'), async (req, res) => {
  const { employee_no, first_name, last_name, department, hourly_rate, status } = req.body

  if (!employee_no || !first_name || !last_name || !department) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

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

  return res.json({ message: 'Teacher updated' })
})

teachersRouter.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  const result = await query('DELETE FROM teachers WHERE id = ?', [req.params.id])

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Teacher not found' })
  }

  return res.json({ message: 'Teacher deleted' })
})
