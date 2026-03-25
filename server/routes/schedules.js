import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const schedulesRouter = Router()

schedulesRouter.get('/', authorizeRoles('admin', 'payroll_viewer'), async (_, res) => {
  const rows = await query(
    `SELECT s.id, s.teacher_id, s.day_of_week, s.time_start, s.time_end, s.grace_minutes,
            t.employee_no, t.first_name, t.last_name
     FROM schedules s
     JOIN teachers t ON t.id = s.teacher_id
     ORDER BY t.last_name, t.first_name, s.day_of_week`,
  )

  res.json(rows)
})

schedulesRouter.get('/my', authorizeRoles('teacher'), async (req, res) => {
  const teacherId = req.user.teacher_id

  if (!teacherId) {
    return res.status(400).json({ message: 'No teacher profile linked to this account' })
  }

  const rows = await query(
    `SELECT s.id, s.day_of_week, s.time_start, s.time_end, s.grace_minutes
     FROM schedules s
     WHERE s.teacher_id = ?
     ORDER BY s.day_of_week`,
    [teacherId],
  )

  res.json(rows)
})

schedulesRouter.post('/', authorizeRoles('admin'), async (req, res) => {
  const { teacher_id, day_of_week, time_start, time_end, grace_minutes } = req.body

  if (
    !teacher_id ||
    day_of_week === undefined ||
    !time_start ||
    !time_end ||
    grace_minutes === undefined
  ) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  await query(
    `INSERT INTO schedules (teacher_id, day_of_week, time_start, time_end, grace_minutes)
     VALUES (?, ?, ?, ?, ?)`,
    [teacher_id, day_of_week, time_start, time_end, grace_minutes],
  )

  return res.status(201).json({ message: 'Schedule created' })
})

schedulesRouter.put('/:id', authorizeRoles('admin'), async (req, res) => {
  const { teacher_id, day_of_week, time_start, time_end, grace_minutes } = req.body

  if (
    !teacher_id ||
    day_of_week === undefined ||
    !time_start ||
    !time_end ||
    grace_minutes === undefined
  ) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  const result = await query(
    `UPDATE schedules
     SET teacher_id = ?, day_of_week = ?, time_start = ?, time_end = ?, grace_minutes = ?
     WHERE id = ?`,
    [teacher_id, day_of_week, time_start, time_end, grace_minutes, req.params.id],
  )

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Schedule not found' })
  }

  return res.json({ message: 'Schedule updated' })
})

schedulesRouter.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  const result = await query('DELETE FROM schedules WHERE id = ?', [req.params.id])

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Schedule not found' })
  }

  return res.json({ message: 'Schedule deleted' })
})
