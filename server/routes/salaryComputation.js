import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const salaryRouter = Router()

function parseDateRange(dateFrom, dateTo) {
  if (!dateFrom || !dateTo) {
    return { error: 'date_from and date_to are required (YYYY-MM-DD)' }
  }

  const start = new Date(`${dateFrom}T00:00:00`)
  const end = new Date(`${dateTo}T00:00:00`)

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: 'Invalid date range format' }
  }

  if (start > end) {
    return { error: 'date_from cannot be later than date_to' }
  }

  return { start, end }
}

function getDatesInRange(start, end) {
  const dates = []
  const cursor = new Date(start)

  while (cursor <= end) {
    dates.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function mapTeacherSchedules(schedules) {
  const byTeacher = new Map()

  for (const row of schedules) {
    const list = byTeacher.get(row.teacher_id) || []
    list.push({ id: row.id, day_of_week: Number(row.day_of_week) })
    byTeacher.set(row.teacher_id, list)
  }

  return byTeacher
}

function computeExpectedSessions(scheduleRows, start, end) {
  if (!scheduleRows || scheduleRows.length === 0) return 0

  const dates = getDatesInRange(start, end)
  let expectedSessions = 0

  for (const date of dates) {
    const dayOfWeek = date.getDay()
    expectedSessions += scheduleRows.filter((s) => s.day_of_week === dayOfWeek).length
  }

  return expectedSessions
}

function computeAttendanceStats(attendanceRows) {
  const rowsByDate = new Map()

  for (const row of attendanceRows) {
    const date = String(row.scan_time).slice(0, 10)
    const list = rowsByDate.get(date) || []
    list.push(row)
    rowsByDate.set(date, list)
  }

  let attendedSessions = 0
  let lateCount = 0

  for (const rows of rowsByDate.values()) {
    rows.sort((a, b) => new Date(a.scan_time) - new Date(b.scan_time))

    const hasTimeIn = rows.some((r) => r.scan_type === 'time_in')
    const hasTimeOut = rows.some((r) => r.scan_type === 'time_out')
    if (hasTimeIn && hasTimeOut) attendedSessions += 1

    const lateTimeIns = rows.filter((r) => r.scan_type === 'time_in' && r.status === 'late').length
    lateCount += lateTimeIns
  }

  return { attendedSessions, lateCount }
}

function computeSalaryForTeacher(teacher, periodStats, settings) {
  const grossSalary =
    teacher.teacher_type === 'full_time'
      ? Number(teacher.monthly_salary || 0)
      : Number(teacher.session_rate || 0) * periodStats.attendedSessions

  const lateDeduction =
    teacher.teacher_type === 'full_time'
      ? periodStats.lateCount * Number(settings.late_deduction_amount || 0)
      : 0
  const absenceDeduction = periodStats.absenceCount * Number(settings.absence_deduction_amount || 0)
  const totalDeductions = lateDeduction + absenceDeduction
  const netSalary = Math.max(0, grossSalary - totalDeductions)

  return {
    grossSalary,
    lateDeduction,
    absenceDeduction,
    totalDeductions,
    netSalary,
  }
}

salaryRouter.get('/summary', authorizeRoles('admin', 'salary_viewer'), async (req, res) => {
  const { date_from, date_to } = req.query
  const parsedRange = parseDateRange(date_from, date_to)

  if (parsedRange.error) {
    return res.status(400).json({ message: parsedRange.error })
  }

  const { start, end } = parsedRange

  const [settings] = await query(
    `SELECT late_deduction_amount, absence_deduction_amount
     FROM attendance_settings
     WHERE id = 1
     LIMIT 1`,
  )

  if (!settings) {
    return res.status(500).json({ message: 'Attendance settings not configured' })
  }

  const teachers = await query(
    `SELECT id, employee_no, first_name, last_name, department, teacher_type, monthly_salary, session_rate, status
     FROM teachers
     ORDER BY last_name ASC, first_name ASC`,
  )

  const schedules = await query(
    `SELECT id, teacher_id, day_of_week
     FROM schedules`,
  )

  const attendance = await query(
    `SELECT id, teacher_id, scan_time, scan_type, status
     FROM attendance
     WHERE DATE(scan_time) >= ? AND DATE(scan_time) <= ?
     ORDER BY scan_time ASC`,
    [date_from, date_to],
  )

  const schedulesByTeacher = mapTeacherSchedules(schedules)
  const attendanceByTeacher = new Map()

  for (const row of attendance) {
    const list = attendanceByTeacher.get(row.teacher_id) || []
    list.push(row)
    attendanceByTeacher.set(row.teacher_id, list)
  }

  const summary = teachers.map((teacher) => {
    const teacherSchedules = schedulesByTeacher.get(teacher.id) || []
    const expectedSessions = computeExpectedSessions(teacherSchedules, start, end)
    const teacherAttendance = attendanceByTeacher.get(teacher.id) || []
    const stats = computeAttendanceStats(teacherAttendance)
    const absenceCount = Math.max(0, expectedSessions - stats.attendedSessions)

    const salary = computeSalaryForTeacher(
      teacher,
      {
        attendedSessions: stats.attendedSessions,
        lateCount: stats.lateCount,
        absenceCount,
      },
      settings,
    )

    return {
      teacher: {
        id: teacher.id,
        employee_no: teacher.employee_no,
        first_name: teacher.first_name,
        last_name: teacher.last_name,
        department: teacher.department,
        status: teacher.status,
      },
      teacher_type: teacher.teacher_type,
      rates: {
        monthly_salary: Number(teacher.monthly_salary || 0),
        session_rate: Number(teacher.session_rate || 0),
      },
      period: {
        date_from,
        date_to,
      },
      metrics: {
        expected_sessions: expectedSessions,
        attended_sessions: stats.attendedSessions,
        late_count: stats.lateCount,
        absence_count: absenceCount,
      },
      deductions: {
        late_deduction_amount: Number(settings.late_deduction_amount || 0),
        absence_deduction_amount: Number(settings.absence_deduction_amount || 0),
        late_deduction_total: salary.lateDeduction,
        absence_deduction_total: salary.absenceDeduction,
        total: salary.totalDeductions,
      },
      salary: {
        gross_salary: salary.grossSalary,
        net_salary: salary.netSalary,
      },
      formula:
        teacher.teacher_type === 'full_time'
          ? 'gross = monthly_salary; net = gross - (late_count * late_deduction) - (absence_count * absence_deduction)'
          : 'gross = session_rate * attended_sessions; net = gross - (absence_count * absence_deduction)',
    }
  })

  return res.json({
    period: { date_from, date_to },
    settings: {
      late_deduction_amount: Number(settings.late_deduction_amount || 0),
      absence_deduction_amount: Number(settings.absence_deduction_amount || 0),
      overtime: 'disabled',
    },
    summary,
  })
})

salaryRouter.get('/teacher/:id/breakdown', authorizeRoles('admin', 'salary_viewer'), async (req, res) => {
  const { date_from, date_to } = req.query
  const parsedRange = parseDateRange(date_from, date_to)

  if (parsedRange.error) {
    return res.status(400).json({ message: parsedRange.error })
  }

  const teacherId = Number(req.params.id)

  const [teacher] = await query(
    `SELECT id, employee_no, first_name, last_name, department, teacher_type, monthly_salary, session_rate, status
     FROM teachers
     WHERE id = ?
     LIMIT 1`,
    [teacherId],
  )

  if (!teacher) {
    return res.status(404).json({ message: 'Teacher not found' })
  }

  const attendanceRows = await query(
    `SELECT id, schedule_id, scan_time, scan_type, status
     FROM attendance
     WHERE teacher_id = ? AND DATE(scan_time) >= ? AND DATE(scan_time) <= ?
     ORDER BY scan_time ASC`,
    [teacherId, date_from, date_to],
  )

  return res.json({
    teacher,
    period: { date_from, date_to },
    attendance: attendanceRows,
  })
})
