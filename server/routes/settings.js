import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const settingsRouter = Router()

const DEFAULT_TIMEZONE = 'Asia/Manila'

settingsRouter.get('/attendance', authorizeRoles('admin', 'salary_viewer'), async (_, res) => {
  const rows = await query(
    `SELECT id, late_grace_minutes, duplicate_scan_window_seconds,
            late_deduction_amount, absence_deduction_amount
     FROM attendance_settings
     WHERE id = 1
     LIMIT 1`,
  )

  if (!rows[0]) {
    return res.status(404).json({ message: 'Attendance settings not found' })
  }

  return res.json({ ...rows[0], timezone: DEFAULT_TIMEZONE })
})

settingsRouter.put('/attendance', authorizeRoles('admin'), async (req, res) => {
  const {
    late_grace_minutes,
    duplicate_scan_window_seconds,
    late_deduction_amount,
    absence_deduction_amount,
  } = req.body

  if (
    late_grace_minutes === undefined ||
    duplicate_scan_window_seconds === undefined ||
    late_deduction_amount === undefined ||
    absence_deduction_amount === undefined
  ) {
    return res.status(400).json({ message: 'All fields are required' })
  }

  const numericFields = [
    Number(late_grace_minutes),
    Number(duplicate_scan_window_seconds),
    Number(late_deduction_amount),
    Number(absence_deduction_amount),
  ]

  if (numericFields.some((value) => Number.isNaN(value) || value < 0)) {
    return res.status(400).json({ message: 'Numeric fields must be valid and non-negative' })
  }

  await query(
    `UPDATE attendance_settings
     SET late_grace_minutes = ?, duplicate_scan_window_seconds = ?,
         late_deduction_amount = ?, absence_deduction_amount = ?, timezone = ?
     WHERE id = 1`,
    [
      late_grace_minutes,
      duplicate_scan_window_seconds,
      late_deduction_amount,
      absence_deduction_amount,
      DEFAULT_TIMEZONE,
    ],
  )

  return res.json({ message: 'Attendance settings updated' })
})
