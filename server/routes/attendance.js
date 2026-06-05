import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const attendanceRouter = Router()
export const publicAttendanceRouter = Router()

const EARLY_TIME_IN_WINDOW_MINUTES = 30

/**
 * Get today's date in the configured timezone as YYYY-MM-DD
 */
async function getTodayDate(timezone) {
  const now = new Date()
  return now.toLocaleDateString('en-CA', { timeZone: timezone })
}

/**
 * Get current time in the configured timezone as HH:MM:SS
 */
function getCurrentTime(timezone) {
  const now = new Date()
  return now.toLocaleTimeString('en-GB', { timeZone: timezone, hour12: false })
}

/**
 * Get current datetime in the configured timezone
 */
function getCurrentDateTime(timezone) {
  const now = new Date()
  const date = now.toLocaleDateString('en-CA', { timeZone: timezone })
  const time = now.toLocaleTimeString('en-GB', { timeZone: timezone, hour12: false })
  return `${date} ${time}`
}

/**
 * Convert time string (HH:MM:SS) to minutes since midnight
 */
export function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

export function selectSchedule(currentTimeStr, todaysSchedules) {
  if (!todaysSchedules || todaysSchedules.length === 0) return null

  const nowMinutes = timeToMinutes(currentTimeStr)

  // Schedule that currently covers this time
  const covering = todaysSchedules.find((s) => {
    const start = timeToMinutes(s.time_start)
    const end = timeToMinutes(s.time_end)
    return nowMinutes >= start && nowMinutes <= end
  })
  if (covering) return covering

  // Next upcoming schedule today
  const upcoming = todaysSchedules.find((s) => timeToMinutes(s.time_start) > nowMinutes)
  if (upcoming) return upcoming

  // Fallback to the last past schedule today
  return todaysSchedules[todaysSchedules.length - 1]
}

export function getScheduleValidation(teacherType, schedule, currentTimeStr, scanType) {
  if (!schedule) {
    return { error: 'No schedule found for this teacher today' }
  }

  if (scanType !== 'time_in') {
    return { error: '' }
  }

  const currentMinutes = timeToMinutes(currentTimeStr)
  const scheduleStartMinutes = timeToMinutes(schedule.time_start)
  const earliestTimeInMinutes = scheduleStartMinutes - EARLY_TIME_IN_WINDOW_MINUTES

  if (currentMinutes < earliestTimeInMinutes) {
    return {
      error: `Time in is only allowed ${EARLY_TIME_IN_WINDOW_MINUTES} minutes before the scheduled start time`,
    }
  }

  if (teacherType === 'part_time') {
    const scheduleEndMinutes = timeToMinutes(schedule.time_end)

    if (currentMinutes > scheduleEndMinutes) {
      return { error: 'Part-time attendance can only be recorded during the scheduled time frame' }
    }
  }

  return { error: '' }
}

export function getAttendanceStatus(teacherType, schedule, currentTimeStr, scanType) {
  if (scanType !== 'time_in' || !schedule || teacherType !== 'full_time') {
    return 'on_time'
  }

  const currentMinutes = timeToMinutes(currentTimeStr)
  const scheduleStartMinutes = timeToMinutes(schedule.time_start)

  return currentMinutes > scheduleStartMinutes ? 'late' : 'on_time'
}

async function getTodayContext() {
  const [settings] = await query(
    'SELECT late_grace_minutes, duplicate_scan_window_seconds, timezone FROM attendance_settings WHERE id = 1',
  )

  if (!settings) {
    return { error: { status: 500, message: 'Attendance settings not configured' } }
  }

  const { timezone, duplicate_scan_window_seconds } = settings
  const todayDate = await getTodayDate(timezone)
  const dayOfWeek = new Date(todayDate).getDay()

  return {
    settings,
    timezone,
    lateGraceMinutes: Number(settings.late_grace_minutes || 0),
    duplicate_scan_window_seconds,
    todayDate,
    dayOfWeek,
  }
}

// ── Public endpoints (no auth) ──────────────────────────────────────────────

/**
 * Validate employee_no from public endpoints: trim, length, alphanumeric only.
 * Returns the cleaned value or null if invalid.
 */
function validateEmployeeNo(raw) {
  if (typeof raw !== 'string') return null
  const cleaned = raw.trim()
  if (!cleaned || cleaned.length > 20) return null
  if (!/^[A-Za-z0-9-_]+$/.test(cleaned)) return null
  return cleaned
}

// GET /api/public/attendance/today-schedules
publicAttendanceRouter.get('/today-schedules', async (req, res) => {
  const employee_no = validateEmployeeNo(req.query.employee_no)

  if (!employee_no) {
    return res.status(400).json({ message: 'Employee number is required' })
  }

  const context = await getTodayContext()
  if (context.error) {
    return res.status(context.error.status).json({ message: context.error.message })
  }

  const { timezone, todayDate, dayOfWeek } = context

  const [teacher] = await query(
    'SELECT id, first_name, last_name, status, teacher_type FROM teachers WHERE employee_no = ?',
    [employee_no],
  )

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found', employee_no })
  }

  if (teacher.status !== 'active') {
    return res.status(400).json({ message: 'Teacher is inactive' })
  }

  const schedules = await query(
    `SELECT id, day_of_week, time_start, time_end, subject FROM schedules 
     WHERE teacher_id = ? AND (day_of_week = ? OR (? = 'full_time' AND day_of_week IS NULL))
     ORDER BY time_start ASC`,
    [teacher.id, dayOfWeek, teacher.teacher_type],
  )

  return res.json({
    teacher: { id: teacher.id, name: `${teacher.first_name} ${teacher.last_name}`, teacher_type: teacher.teacher_type },
    timezone,
    todayDate,
    dayOfWeek,
    schedules,
  })
})

// POST /api/public/attendance/scan
publicAttendanceRouter.post('/scan', async (req, res) => {
  const employee_no = validateEmployeeNo(req.body?.employee_no)
  const { schedule_id } = req.body || {}

  if (!employee_no) {
    return res.status(400).json({ message: 'Employee number is required' })
  }

  const context = await getTodayContext()
  if (context.error) {
    return res.status(context.error.status).json({ message: context.error.message })
  }

  const { timezone, duplicate_scan_window_seconds, todayDate, dayOfWeek } = context

  const [teacher] = await query(
    'SELECT id, first_name, last_name, status, teacher_type FROM teachers WHERE employee_no = ?',
    [employee_no],
  )

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found', employee_no })
  }

  if (teacher.status !== 'active') {
    return res.status(400).json({
      message: 'Teacher is inactive',
      teacher: { name: `${teacher.first_name} ${teacher.last_name}` },
    })
  }

  const currentDateTime = getCurrentDateTime(timezone)
  const currentTime = getCurrentTime(timezone)

  const duplicateWindow = await query(
    `SELECT id, scan_type, scan_time FROM attendance 
     WHERE teacher_id = ? 
     AND scan_time > DATE_SUB(?, INTERVAL ? SECOND)
     ORDER BY scan_time DESC
     LIMIT 1`,
    [teacher.id, currentDateTime, duplicate_scan_window_seconds],
  )

  if (duplicateWindow.length > 0) {
    const lastScan = duplicateWindow[0]
    return res.status(400).json({
      message: 'Duplicate scan detected',
      lastScan: { type: lastScan.scan_type, time: lastScan.scan_time },
      windowSeconds: duplicate_scan_window_seconds,
    })
  }

  const schedules = await query(
    `SELECT id, day_of_week, time_start, time_end, subject FROM schedules 
     WHERE teacher_id = ? AND (day_of_week = ? OR (? = 'full_time' AND day_of_week IS NULL))
     ORDER BY time_start ASC`,
    [teacher.id, dayOfWeek, teacher.teacher_type],
  )

  if (schedules.length === 0) {
    return res.status(400).json({ message: 'No schedule found for this teacher today' })
  }

  const todayScans = await query(
    `SELECT scan_type, schedule_id FROM attendance
     WHERE teacher_id = ? AND DATE(scan_time) = ?
     ORDER BY scan_time DESC`,
    [teacher.id, todayDate],
  )

  let schedule = selectSchedule(currentTime, schedules)

  if (schedule_id) {
    const match = schedules.find((s) => s.id === Number(schedule_id))
    if (!match) {
      return res.status(400).json({ message: 'Selected schedule is not valid for today' })
    }
    schedule = match
  }

  const scheduleScans = todayScans.filter((scan) => scan.schedule_id === schedule.id)
  const hasTimeIn = scheduleScans.some(s => s.scan_type === 'time_in')
  const hasTimeOut = scheduleScans.some(s => s.scan_type === 'time_out')
  if (teacher.teacher_type === 'part_time' && hasTimeIn) {
    return res.status(400).json({
      message: 'Attendance already recorded for this part-time schedule today',
    })
  }

  if (hasTimeIn && hasTimeOut) {
    return res.status(400).json({
      message: 'Attendance already recorded for this schedule today (time in and out)',
    })
  }

  let scanType = 'time_in'
  if (scheduleScans.length > 0) {
    scanType = scheduleScans[0].scan_type === 'time_in' ? 'time_out' : 'time_in'
  }

  const scheduleValidation = getScheduleValidation(teacher.teacher_type, schedule, currentTime, scanType)
  if (scheduleValidation.error) {
    return res.status(400).json({ message: scheduleValidation.error })
  }

  const status = getAttendanceStatus(teacher.teacher_type, schedule, currentTime, scanType)

  await query(
    `INSERT INTO attendance (teacher_id, schedule_id, scan_time, scan_type, status)
     VALUES (?, ?, ?, ?, ?)`,
    [teacher.id, schedule.id, currentDateTime, scanType, status],
  )

  return res.status(201).json({
    message: 'Scan recorded successfully',
    attendance: {
      teacher: { id: teacher.id, name: `${teacher.first_name} ${teacher.last_name}` },
      scan_type: scanType,
      scan_time: currentDateTime,
      status,
      schedule: schedule
        ? { id: schedule.id, day_of_week: schedule.day_of_week, time_start: schedule.time_start, time_end: schedule.time_end, subject: schedule.subject }
        : null,
    },
  })
})

// ── Admin-protected endpoints ─────────────────────────────────────────────────

attendanceRouter.get('/today-schedules', authorizeRoles('admin'), async (req, res) => {
  const { employee_no } = req.query

  if (!employee_no) {
    return res.status(400).json({ message: 'Employee number is required' })
  }

  const context = await getTodayContext()
  if (context.error) {
    return res.status(context.error.status).json({ message: context.error.message })
  }

  const { timezone, todayDate, dayOfWeek } = context

  const [teacher] = await query(
    'SELECT id, first_name, last_name, status, teacher_type FROM teachers WHERE employee_no = ?',
    [employee_no],
  )

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found', employee_no })
  }

  if (teacher.status !== 'active') {
    return res.status(400).json({ message: 'Teacher is inactive' })
  }

  const schedules = await query(
    `SELECT id, day_of_week, time_start, time_end, subject FROM schedules 
     WHERE teacher_id = ? AND (day_of_week = ? OR (? = 'full_time' AND day_of_week IS NULL))
     ORDER BY time_start ASC`,
    [teacher.id, dayOfWeek, teacher.teacher_type],
  )

  return res.json({
    teacher: { id: teacher.id, name: `${teacher.first_name} ${teacher.last_name}`, teacher_type: teacher.teacher_type },
    timezone,
    todayDate,
    dayOfWeek,
    schedules,
  })
})

// POST /api/attendance/scan - Process a QR code scan
attendanceRouter.post('/scan', authorizeRoles('admin'), async (req, res) => {
  const { employee_no, schedule_id } = req.body

  if (!employee_no) {
    return res.status(400).json({ message: 'Employee number is required' })
  }

  const context = await getTodayContext()
  if (context.error) {
    return res.status(context.error.status).json({ message: context.error.message })
  }

  const { timezone, duplicate_scan_window_seconds, todayDate, dayOfWeek } = context

  // Find the teacher
  const [teacher] = await query(
    'SELECT id, first_name, last_name, status, teacher_type FROM teachers WHERE employee_no = ?',
    [employee_no],
  )

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found', employee_no })
  }

  if (teacher.status !== 'active') {
    return res.status(400).json({
      message: 'Teacher is inactive',
      teacher: { name: `${teacher.first_name} ${teacher.last_name}` },
    })
  }

  const currentDateTime = getCurrentDateTime(timezone)
  const currentTime = getCurrentTime(timezone)

  // Check for duplicate scan within the window
  const duplicateWindow = await query(
    `SELECT id, scan_type, scan_time FROM attendance 
     WHERE teacher_id = ? 
     AND scan_time > DATE_SUB(?, INTERVAL ? SECOND)
     ORDER BY scan_time DESC
     LIMIT 1`,
    [teacher.id, currentDateTime, duplicate_scan_window_seconds],
  )

  if (duplicateWindow.length > 0) {
    const lastScan = duplicateWindow[0]
    return res.status(400).json({
      message: 'Duplicate scan detected',
      lastScan: {
        type: lastScan.scan_type,
        time: lastScan.scan_time,
      },
      windowSeconds: duplicate_scan_window_seconds,
    })
  }

  // Find matching schedules for today (could be multiple slots)
  const schedules = await query(
    `SELECT id, day_of_week, time_start, time_end, subject FROM schedules 
     WHERE teacher_id = ? AND (day_of_week = ? OR (? = 'full_time' AND day_of_week IS NULL))
     ORDER BY time_start ASC`,
    [teacher.id, dayOfWeek, teacher.teacher_type],
  )

  if (schedules.length === 0) {
    return res.status(400).json({ message: 'No schedule found for this teacher today' })
  }

  // Check if both time_in and time_out already exist for today
  const todayScans = await query(
    `SELECT scan_type, schedule_id FROM attendance
     WHERE teacher_id = ? AND DATE(scan_time) = ?
     ORDER BY scan_time DESC`,
    [teacher.id, todayDate],
  )

  let schedule = selectSchedule(currentTime, schedules)

  if (schedule_id) {
    const match = schedules.find((s) => s.id === Number(schedule_id))
    if (!match) {
      return res.status(400).json({ message: 'Selected schedule is not valid for today' })
    }
    schedule = match
  }

  const scheduleScans = todayScans.filter((scan) => scan.schedule_id === schedule.id)
  const hasTimeIn = scheduleScans.some(s => s.scan_type === 'time_in')
  const hasTimeOut = scheduleScans.some(s => s.scan_type === 'time_out')
  if (teacher.teacher_type === 'part_time' && hasTimeIn) {
    return res.status(400).json({
      message: 'Attendance already recorded for this part-time schedule today',
    })
  }

  if (hasTimeIn && hasTimeOut) {
    return res.status(400).json({
      message: 'Attendance already recorded for this schedule today (time in and out)',
    })
  }

  let scanType = 'time_in'
  if (scheduleScans.length > 0) {
    scanType = scheduleScans[0].scan_type === 'time_in' ? 'time_out' : 'time_in'
  }

  const scheduleValidation = getScheduleValidation(teacher.teacher_type, schedule, currentTime, scanType)
  if (scheduleValidation.error) {
    return res.status(400).json({ message: scheduleValidation.error })
  }

  const status = getAttendanceStatus(teacher.teacher_type, schedule, currentTime, scanType)

  // Insert the attendance record
  await query(
    `INSERT INTO attendance (teacher_id, schedule_id, scan_time, scan_type, status)
     VALUES (?, ?, ?, ?, ?)`,
    [teacher.id, schedule.id, currentDateTime, scanType, status],
  )

  return res.status(201).json({
    message: 'Scan recorded successfully',
    attendance: {
      teacher: {
        id: teacher.id,
        name: `${teacher.first_name} ${teacher.last_name}`,
      },
      scan_type: scanType,
      scan_time: currentDateTime,
      status,
      schedule: schedule
        ? { id: schedule.id, day_of_week: schedule.day_of_week, time_start: schedule.time_start, time_end: schedule.time_end, subject: schedule.subject }
        : null,
    },
  })
})

// GET /api/attendance/my - Teacher's own attendance records
attendanceRouter.get('/my', authorizeRoles('teacher'), async (req, res) => {
  const teacherId = req.user.teacher_id

  if (!teacherId) {
    return res.status(400).json({ message: 'No teacher profile linked to this account' })
  }

  const { date_from, date_to } = req.query

  let sql = `
    SELECT a.id, a.scan_time, a.scan_type, a.status, a.created_at
    FROM attendance a
    WHERE a.teacher_id = ?
  `
  const params = [teacherId]

  if (date_from) {
    sql += ' AND DATE(a.scan_time) >= ?'
    params.push(date_from)
  }

  if (date_to) {
    sql += ' AND DATE(a.scan_time) <= ?'
    params.push(date_to)
  }

  sql += ' ORDER BY a.scan_time DESC'

  const rows = await query(sql, params)
  res.json(rows)
})

// GET /api/attendance - Get attendance records with filters
attendanceRouter.get('/', authorizeRoles('admin', 'salary_viewer'), async (req, res) => {
  const { date_from, date_to, teacher_id, status } = req.query

  let sql = `
    SELECT a.id, a.teacher_id, a.schedule_id, a.scan_time, a.scan_type, a.status, a.created_at,
           t.employee_no, t.first_name, t.last_name, t.department
    FROM attendance a
    JOIN teachers t ON t.id = a.teacher_id
    WHERE 1=1
  `
  const params = []

  if (date_from) {
    sql += ' AND DATE(a.scan_time) >= ?'
    params.push(date_from)
  }

  if (date_to) {
    sql += ' AND DATE(a.scan_time) <= ?'
    params.push(date_to)
  }

  if (teacher_id) {
    sql += ' AND a.teacher_id = ?'
    params.push(teacher_id)
  }

  if (status) {
    sql += ' AND a.status = ?'
    params.push(status)
  }

  sql += ' ORDER BY a.scan_time DESC'

  const rows = await query(sql, params)
  res.json(rows)
})

// GET /api/attendance/teacher/:id - Get attendance for a specific teacher
attendanceRouter.get('/teacher/:id', authorizeRoles('admin', 'salary_viewer'), async (req, res) => {
  const { date_from, date_to } = req.query
  const teacherId = req.params.id

  let sql = `
    SELECT a.id, a.schedule_id, a.scan_time, a.scan_type, a.status, a.created_at
    FROM attendance a
    WHERE a.teacher_id = ?
  `
  const params = [teacherId]

  if (date_from) {
    sql += ' AND DATE(a.scan_time) >= ?'
    params.push(date_from)
  }

  if (date_to) {
    sql += ' AND DATE(a.scan_time) <= ?'
    params.push(date_to)
  }

  sql += ' ORDER BY a.scan_time DESC'

  const rows = await query(sql, params)
  res.json(rows)
})

// GET /api/attendance/today - Get today's attendance summary
attendanceRouter.get('/today', authorizeRoles('admin', 'salary_viewer'), async (req, res) => {
  const [settings] = await query(
    'SELECT timezone FROM attendance_settings WHERE id = 1',
  )

  const timezone = settings?.timezone || 'Asia/Manila'
  const todayDate = await getTodayDate(timezone)

  const rows = await query(
    `SELECT a.id, a.teacher_id, a.scan_time, a.scan_type, a.status,
            t.employee_no, t.first_name, t.last_name, t.department
     FROM attendance a
     JOIN teachers t ON t.id = a.teacher_id
     WHERE DATE(a.scan_time) = ?
     ORDER BY a.scan_time DESC`,
    [todayDate],
  )

  res.json(rows)
})
