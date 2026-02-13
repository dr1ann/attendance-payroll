import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const settingsRouter = Router()

settingsRouter.get('/attendance', authorizeRoles('admin', 'payroll_viewer'), async (_, res) => {
  const rows = await query(
    `SELECT id, late_grace_minutes, duplicate_scan_window_minutes, timezone
     FROM attendance_settings
     WHERE id = 1
     LIMIT 1`,
  )

  if (!rows[0]) {
    return res.status(404).json({ message: 'Attendance settings not found' })
  }

  return res.json(rows[0])
})

settingsRouter.put('/attendance', authorizeRoles('admin'), async (req, res) => {
  const { late_grace_minutes, duplicate_scan_window_minutes, timezone } = req.body

  if (
    late_grace_minutes === undefined ||
    duplicate_scan_window_minutes === undefined ||
    !timezone
  ) {
    return res.status(400).json({ message: 'All fields are required' })
  }

  await query(
    `UPDATE attendance_settings
     SET late_grace_minutes = ?, duplicate_scan_window_minutes = ?, timezone = ?
     WHERE id = 1`,
    [late_grace_minutes, duplicate_scan_window_minutes, timezone],
  )

  return res.json({ message: 'Attendance settings updated' })
})
