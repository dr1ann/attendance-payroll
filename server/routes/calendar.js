import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const calendarRouter = Router()

calendarRouter.get('/', authorizeRoles('admin', 'payroll_viewer'), async (req, res) => {
  const from = req.query.from
  const to = req.query.to

  const rows = from && to
    ? await query(
        `SELECT id, calendar_date, is_school_day, note
         FROM school_calendar
         WHERE calendar_date BETWEEN ? AND ?
         ORDER BY calendar_date`,
        [from, to],
      )
    : await query(
        `SELECT id, calendar_date, is_school_day, note
         FROM school_calendar
         ORDER BY calendar_date DESC
         LIMIT 200`,
      )

  res.json(rows)
})

calendarRouter.post('/', authorizeRoles('admin'), async (req, res) => {
  const { calendar_date, is_school_day, note } = req.body

  if (!calendar_date || is_school_day === undefined) {
    return res.status(400).json({ message: 'calendar_date and is_school_day are required' })
  }

  await query(
    `INSERT INTO school_calendar (calendar_date, is_school_day, note)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE is_school_day = VALUES(is_school_day), note = VALUES(note)`,
    [calendar_date, Number(is_school_day), note || null],
  )

  return res.status(201).json({ message: 'Calendar day saved' })
})

calendarRouter.put('/:id', authorizeRoles('admin'), async (req, res) => {
  const { calendar_date, is_school_day, note } = req.body

  if (!calendar_date || is_school_day === undefined) {
    return res.status(400).json({ message: 'calendar_date and is_school_day are required' })
  }

  const result = await query(
    `UPDATE school_calendar
     SET calendar_date = ?, is_school_day = ?, note = ?
     WHERE id = ?`,
    [calendar_date, Number(is_school_day), note || null, req.params.id],
  )

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Calendar entry not found' })
  }

  return res.json({ message: 'Calendar day updated' })
})

calendarRouter.delete('/:id', authorizeRoles('admin'), async (req, res) => {
  const result = await query('DELETE FROM school_calendar WHERE id = ?', [req.params.id])

  if (!result.affectedRows) {
    return res.status(404).json({ message: 'Calendar entry not found' })
  }

  return res.json({ message: 'Calendar day deleted' })
})
