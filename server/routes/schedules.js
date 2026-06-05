import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const schedulesRouter = Router()

schedulesRouter.get('/', authorizeRoles('admin', 'salary_viewer'), async (_, res) => {
  const rows = await query(
    `SELECT s.id, s.teacher_id, s.day_of_week, s.time_start, s.time_end, s.subject,
            t.employee_no, t.first_name, t.last_name, t.teacher_type
     FROM schedules s
     JOIN teachers t ON t.id = s.teacher_id
     ORDER BY t.last_name, t.first_name, s.day_of_week, s.time_start`,
  )

  res.json(rows)
})

schedulesRouter.get('/my', authorizeRoles('teacher'), async (req, res) => {
  const teacherId = req.user.teacher_id

  if (!teacherId) {
    return res.status(400).json({ message: 'No teacher profile linked to this account' })
  }

  const rows = await query(
    `SELECT s.id, s.day_of_week, s.time_start, s.time_end, s.subject
     FROM schedules s
     WHERE s.teacher_id = ?
     ORDER BY s.day_of_week, s.time_start`,
    [teacherId],
  )

  res.json(rows)
})

schedulesRouter.post('/', authorizeRoles('admin'), async (req, res) => {
  const { teacher_id, day_of_week, time_start, time_end, subject } = req.body

  if (!teacher_id || !time_start || !time_end) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  const [teacher] = await query(
    'SELECT id, teacher_type FROM teachers WHERE id = ?',
    [teacher_id],
  )

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' })
  }

  const isFullTime = teacher.teacher_type === 'full_time'
  const cleanSubject = isFullTime ? null : String(subject || '').trim()
  const scheduleDay = isFullTime ? null : day_of_week

  if (!isFullTime && (scheduleDay === undefined || scheduleDay === null || scheduleDay === '')) {
    return res.status(400).json({ message: 'Day is required for part-time schedules' })
  }

  if (!isFullTime && !cleanSubject) {
    return res.status(400).json({ message: 'Subject is required for part-time schedules' })
  }

  if (isFullTime) {
    const existing = await query(
      'SELECT id FROM schedules WHERE teacher_id = ? LIMIT 1',
      [teacher_id],
    )

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Full-time teachers can only have one fixed schedule' })
    }
  }

  await query(
    `INSERT INTO schedules (teacher_id, day_of_week, time_start, time_end, subject)
     VALUES (?, ?, ?, ?, ?)`,
    [teacher_id, scheduleDay, time_start, time_end, cleanSubject],
  )

  return res.status(201).json({ message: 'Schedule created' })
})

schedulesRouter.put('/:id', authorizeRoles('admin'), async (req, res) => {
  const { teacher_id, day_of_week, time_start, time_end, subject } = req.body

  if (!teacher_id || !time_start || !time_end) {
    return res.status(400).json({ message: 'Missing required fields' })
  }

  const [teacher] = await query(
    'SELECT id, teacher_type FROM teachers WHERE id = ?',
    [teacher_id],
  )

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' })
  }

  const isFullTime = teacher.teacher_type === 'full_time'
  const cleanSubject = isFullTime ? null : String(subject || '').trim()
  const scheduleDay = isFullTime ? null : day_of_week

  if (!isFullTime && (scheduleDay === undefined || scheduleDay === null || scheduleDay === '')) {
    return res.status(400).json({ message: 'Day is required for part-time schedules' })
  }

  if (!isFullTime && !cleanSubject) {
    return res.status(400).json({ message: 'Subject is required for part-time schedules' })
  }

  if (isFullTime) {
    const existing = await query(
      'SELECT id FROM schedules WHERE teacher_id = ? AND id <> ? LIMIT 1',
      [teacher_id, req.params.id],
    )

    if (existing.length > 0) {
      return res.status(400).json({ message: 'Full-time teachers can only have one fixed schedule' })
    }
  }

  const result = await query(
    `UPDATE schedules
     SET teacher_id = ?, day_of_week = ?, time_start = ?, time_end = ?, subject = ?
     WHERE id = ?`,
    [teacher_id, scheduleDay, time_start, time_end, cleanSubject, req.params.id],
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
