import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const reportsRouter = Router()

/**
 * GET /api/reports/attendance
 * Full attendance log for a date range. Supports optional teacher_id, department, status filters.
 */
reportsRouter.get('/attendance', authorizeRoles('admin'), async (req, res) => {
  const { date_from, date_to, teacher_id, department, status } = req.query

  if (!date_from || !date_to) {
    return res.status(400).json({ message: 'date_from and date_to are required' })
  }

  let sql = `
    SELECT
      a.id,
      a.scan_time,
      a.scan_type,
      a.status,
      t.employee_no,
      t.first_name,
      t.last_name,
      t.department,
      t.teacher_type
    FROM attendance a
    JOIN teachers t ON t.id = a.teacher_id
    WHERE DATE(a.scan_time) >= ? AND DATE(a.scan_time) <= ?
  `
  const params = [date_from, date_to]

  if (teacher_id) {
    sql += ' AND a.teacher_id = ?'
    params.push(teacher_id)
  }

  if (department) {
    sql += ' AND t.department = ?'
    params.push(department)
  }

  if (status) {
    sql += ' AND a.status = ?'
    params.push(status)
  }

  sql += ' ORDER BY a.scan_time DESC'

  const rows = await query(sql, params)
  return res.json(rows)
})

/**
 * GET /api/reports/tardiness
 * Per-teacher late count, total sessions attended, and late rate for a date range.
 */
reportsRouter.get('/tardiness', authorizeRoles('admin'), async (req, res) => {
  const { date_from, date_to, department, teacher_type } = req.query

  if (!date_from || !date_to) {
    return res.status(400).json({ message: 'date_from and date_to are required' })
  }

  let teacherSql = `
    SELECT id, employee_no, first_name, last_name, department, teacher_type, status
    FROM teachers
    WHERE 1=1
  `
  const teacherParams = []

  if (department) {
    teacherSql += ' AND department = ?'
    teacherParams.push(department)
  }

  if (teacher_type) {
    teacherSql += ' AND teacher_type = ?'
    teacherParams.push(teacher_type)
  }

  teacherSql += ' ORDER BY last_name ASC, first_name ASC'

  const teachers = await query(teacherSql, teacherParams)

  if (teachers.length === 0) {
    return res.json([])
  }

  const teacherIds = teachers.map((t) => t.id)
  const placeholders = teacherIds.map(() => '?').join(', ')

  const attendanceRows = await query(
    `SELECT teacher_id, scan_type, status, DATE(scan_time) AS scan_date
     FROM attendance
     WHERE teacher_id IN (${placeholders})
       AND DATE(scan_time) >= ? AND DATE(scan_time) <= ?
     ORDER BY scan_time ASC`,
    [...teacherIds, date_from, date_to],
  )

  // Build per-teacher stats
  const statsMap = {}
  for (const row of attendanceRows) {
    if (!statsMap[row.teacher_id]) {
      statsMap[row.teacher_id] = { dates: new Set(), late_count: 0, time_in_count: 0 }
    }
    if (row.scan_type === 'time_in') {
      statsMap[row.teacher_id].time_in_count += 1
      statsMap[row.teacher_id].dates.add(row.scan_date)
      if (row.status === 'late') {
        statsMap[row.teacher_id].late_count += 1
      }
    }
  }

  const result = teachers.map((teacher) => {
    const s = statsMap[teacher.id] || { dates: new Set(), late_count: 0, time_in_count: 0 }
    const attended_days = s.dates.size
    const late_rate = attended_days > 0 ? ((s.late_count / attended_days) * 100).toFixed(1) : '0.0'
    return {
      employee_no: teacher.employee_no,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      department: teacher.department,
      teacher_type: teacher.teacher_type,
      status: teacher.status,
      attended_days,
      late_count: s.late_count,
      on_time_count: attended_days - s.late_count,
      late_rate,
    }
  })

  return res.json(result)
})

/**
 * GET /api/reports/payroll
 * Payroll summary per teacher: gross, deductions, net for a date range.
 * Re-uses the same computation logic as salaryComputation.js.
 */
reportsRouter.get('/payroll', authorizeRoles('admin'), async (req, res) => {
  const { date_from, date_to, department, teacher_type } = req.query

  if (!date_from || !date_to) {
    return res.status(400).json({ message: 'date_from and date_to are required' })
  }

  const [settings] = await query(
    'SELECT late_deduction_amount, absence_deduction_amount FROM attendance_settings WHERE id = 1',
  )

  if (!settings) {
    return res.status(500).json({ message: 'Attendance settings not configured' })
  }

  let teacherSql = `
    SELECT id, employee_no, first_name, last_name, department, teacher_type,
           monthly_salary, session_rate, status
    FROM teachers
    WHERE 1=1
  `
  const teacherParams = []

  if (department) {
    teacherSql += ' AND department = ?'
    teacherParams.push(department)
  }

  if (teacher_type) {
    teacherSql += ' AND teacher_type = ?'
    teacherParams.push(teacher_type)
  }

  teacherSql += ' ORDER BY last_name ASC, first_name ASC'

  const teachers = await query(teacherSql, teacherParams)

  if (teachers.length === 0) {
    return res.json([])
  }

  // Compute date range
  const start = new Date(`${date_from}T00:00:00`)
  const end = new Date(`${date_to}T00:00:00`)

  const teacherIds = teachers.map((t) => t.id)
  const placeholders = teacherIds.map(() => '?').join(', ')

  const schedules = await query(
    `SELECT id, teacher_id, day_of_week FROM schedules WHERE teacher_id IN (${placeholders})`,
    teacherIds,
  )

  const attendanceRows = await query(
    `SELECT teacher_id, scan_time, scan_type, status
     FROM attendance
     WHERE teacher_id IN (${placeholders})
       AND DATE(scan_time) >= ? AND DATE(scan_time) <= ?
     ORDER BY scan_time ASC`,
    [...teacherIds, date_from, date_to],
  )

  // Group schedules and attendance by teacher
  const schedulesByTeacher = {}
  for (const s of schedules) {
    if (!schedulesByTeacher[s.teacher_id]) schedulesByTeacher[s.teacher_id] = []
    schedulesByTeacher[s.teacher_id].push({ day_of_week: Number(s.day_of_week) })
  }

  const attendanceByTeacher = {}
  for (const row of attendanceRows) {
    if (!attendanceByTeacher[row.teacher_id]) attendanceByTeacher[row.teacher_id] = []
    attendanceByTeacher[row.teacher_id].push(row)
  }

  // Compute expected sessions for date range
  function getDates(s, e) {
    const dates = []
    const cur = new Date(s)
    while (cur <= e) {
      dates.push(new Date(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  }

  function expectedSessions(teacherSchedules) {
    if (!teacherSchedules || teacherSchedules.length === 0) return 0
    const dates = getDates(start, end)
    let count = 0
    for (const d of dates) {
      count += teacherSchedules.filter((s) => s.day_of_week === d.getDay()).length
    }
    return count
  }

  function attendanceStats(rows) {
    const byDate = {}
    for (const row of rows) {
      const date = String(row.scan_time).slice(0, 10)
      if (!byDate[date]) byDate[date] = []
      byDate[date].push(row)
    }
    let attended = 0
    let late = 0
    for (const dayRows of Object.values(byDate)) {
      const hasIn = dayRows.some((r) => r.scan_type === 'time_in')
      const hasOut = dayRows.some((r) => r.scan_type === 'time_out')
      if (hasIn && hasOut) attended += 1
      late += dayRows.filter((r) => r.scan_type === 'time_in' && r.status === 'late').length
    }
    return { attended, late }
  }

  const result = teachers.map((teacher) => {
    const ts = schedulesByTeacher[teacher.id] || []
    const att = attendanceByTeacher[teacher.id] || []
    const expected = expectedSessions(ts)
    const { attended, late } = attendanceStats(att)
    const absences = Math.max(0, expected - attended)

    const gross =
      teacher.teacher_type === 'full_time'
        ? Number(teacher.monthly_salary || 0)
        : Number(teacher.session_rate || 0) * attended

    const lateDeduction =
      teacher.teacher_type === 'full_time'
        ? late * Number(settings.late_deduction_amount || 0)
        : 0
    const absenceDeduction = absences * Number(settings.absence_deduction_amount || 0)
    const totalDeductions = lateDeduction + absenceDeduction
    const net = Math.max(0, gross - totalDeductions)

    return {
      employee_no: teacher.employee_no,
      first_name: teacher.first_name,
      last_name: teacher.last_name,
      department: teacher.department,
      teacher_type: teacher.teacher_type,
      status: teacher.status,
      expected_sessions: expected,
      attended_sessions: attended,
      absences,
      late_count: late,
      gross_salary: gross.toFixed(2),
      late_deduction: lateDeduction.toFixed(2),
      absence_deduction: absenceDeduction.toFixed(2),
      total_deductions: totalDeductions.toFixed(2),
      net_salary: net.toFixed(2),
    }
  })

  return res.json(result)
})

/**
 * GET /api/reports/departments
 * Distinct departments for filter dropdowns.
 */
reportsRouter.get('/departments', authorizeRoles('admin'), async (req, res) => {
  const rows = await query('SELECT DISTINCT department FROM teachers ORDER BY department ASC')
  return res.json(rows.map((r) => r.department))
})
