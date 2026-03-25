import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const attendanceRouter = Router()

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
function timeToMinutes(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number)
  return hours * 60 + minutes
}

function selectSchedule(currentTimeStr, todaysSchedules) {
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

async function getTodayContext() {
  const [settings] = await query(
    'SELECT late_grace_minutes, duplicate_scan_window_minutes, timezone FROM attendance_settings WHERE id = 1',
  )

  if (!settings) {
    return { error: { status: 500, message: 'Attendance settings not configured' } }
  }

  const { timezone, duplicate_scan_window_minutes } = settings
  const todayDate = await getTodayDate(timezone)
  const dayOfWeek = new Date(todayDate).getDay()

  return {
    settings,
    timezone,
    duplicate_scan_window_minutes,
    todayDate,
    dayOfWeek,
  }
}

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
    'SELECT id, first_name, last_name, status FROM teachers WHERE employee_no = ?',
    [employee_no],
  )

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found', employee_no })
  }

  if (teacher.status !== 'active') {
    return res.status(400).json({ message: 'Teacher is inactive' })
  }

  const schedules = await query(
    `SELECT id, time_start, time_end, grace_minutes FROM schedules 
     WHERE teacher_id = ? AND day_of_week = ?
     ORDER BY time_start ASC`,
    [teacher.id, dayOfWeek],
  )

  return res.json({
    teacher: { id: teacher.id, name: `${teacher.first_name} ${teacher.last_name}` },
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

  const { timezone, duplicate_scan_window_minutes, todayDate, dayOfWeek } = context

  // Find the teacher
  const [teacher] = await query(
    'SELECT id, first_name, last_name, status FROM teachers WHERE employee_no = ?',
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
     AND scan_time > DATE_SUB(?, INTERVAL ? MINUTE)
     ORDER BY scan_time DESC
     LIMIT 1`,
    [teacher.id, currentDateTime, duplicate_scan_window_minutes],
  )

  if (duplicateWindow.length > 0) {
    const lastScan = duplicateWindow[0]
    return res.status(400).json({
      message: 'Duplicate scan detected',
      lastScan: {
        type: lastScan.scan_type,
        time: lastScan.scan_time,
      },
      windowMinutes: duplicate_scan_window_minutes,
    })
  }

  // Find matching schedules for today (could be multiple slots)
  const schedules = await query(
    `SELECT id, time_start, time_end, grace_minutes FROM schedules 
     WHERE teacher_id = ? AND day_of_week = ?
     ORDER BY time_start ASC`,
    [teacher.id, dayOfWeek],
  )


  // Check if both time_in and time_out already exist for today
  const todayScans = await query(
    `SELECT scan_type FROM attendance 
     WHERE teacher_id = ? AND DATE(scan_time) = ?
     ORDER BY scan_time DESC`,
    [teacher.id, todayDate],
  )

  const hasTimeIn = todayScans.some(s => s.scan_type === 'time_in')
  const hasTimeOut = todayScans.some(s => s.scan_type === 'time_out')
  if (hasTimeIn && hasTimeOut) {
    return res.status(400).json({
      message: 'Attendance already recorded for today (time in and out)',
    })
  }

  let scanType = 'time_in'
  if (todayScans.length > 0) {
    // If last scan was time_in, this should be time_out
    scanType = todayScans[0].scan_type === 'time_in' ? 'time_out' : 'time_in'
  }

  // Determine status (on_time or late)
  let status = 'on_time'

  let schedule = selectSchedule(currentTime, schedules)

  if (schedule_id) {
    const match = schedules.find((s) => s.id === Number(schedule_id))
    if (!match) {
      return res.status(400).json({ message: 'Selected schedule is not valid for today' })
    }
    schedule = match
  }

  if (scanType === 'time_in' && schedule) {
    const currentMinutes = timeToMinutes(currentTime)
    const scheduleStartMinutes = timeToMinutes(schedule.time_start)
    const graceMinutes = schedule.grace_minutes

    if (currentMinutes > scheduleStartMinutes + graceMinutes) {
      status = 'late'
    }
  }

  // Insert the attendance record
  await query(
    `INSERT INTO attendance (teacher_id, schedule_id, scan_time, scan_type, status)
     VALUES (?, ?, ?, ?, ?)`,
    [teacher.id, schedule?.id || null, currentDateTime, scanType, status],
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
        ? { time_start: schedule.time_start, time_end: schedule.time_end }
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
attendanceRouter.get('/', authorizeRoles('admin', 'payroll_viewer'), async (req, res) => {
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
attendanceRouter.get('/teacher/:id', authorizeRoles('admin', 'payroll_viewer'), async (req, res) => {
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
attendanceRouter.get('/today', authorizeRoles('admin', 'payroll_viewer'), async (req, res) => {
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
