import { Router } from 'express'
import { query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const dashboardRouter = Router()

/**
 * GET /api/dashboard/summary
 * Returns KPI data for the admin dashboard:
 * - Teacher counts (total, active, inactive, full_time, part_time)
 * - Department count
 * - Today's attendance stats (present, late, absent from scheduled teachers)
 * - Recent attendance events (last 10)
 * - This month's payroll totals (gross, net, deductions)
 */
dashboardRouter.get('/summary', authorizeRoles('admin', 'salary_viewer'), async (req, res) => {
  const [settings] = await query(
    'SELECT timezone, late_deduction_amount, absence_deduction_amount FROM attendance_settings WHERE id = 1',
  )

  const timezone = settings?.timezone || 'Asia/Manila'
  const now = new Date()
  const todayDate = now.toLocaleDateString('en-CA', { timeZone: timezone })

  // --- Teacher counts ---
  const teacherCounts = await query(`
    SELECT
      COUNT(*) AS total,
      SUM(status = 'active') AS active,
      SUM(status = 'inactive') AS inactive,
      SUM(teacher_type = 'full_time') AS full_time,
      SUM(teacher_type = 'part_time') AS part_time
    FROM teachers
  `)
  const teachers = teacherCounts[0]

  // --- Department count ---
  const [deptRow] = await query(`SELECT COUNT(*) AS total FROM departments WHERE status = 'active'`)
  const departmentCount = Number(deptRow?.total || 0)

  // --- Today's attendance stats ---
  // Teachers who have a schedule today
  const dayOfWeek = new Date(todayDate).getDay()

  const scheduledToday = await query(
    `SELECT DISTINCT teacher_id FROM schedules WHERE day_of_week = ?`,
    [dayOfWeek],
  )
  const scheduledCount = scheduledToday.length

  // Attendance records for today
  const todayAttendance = await query(
    `SELECT a.teacher_id, a.scan_type, a.status, a.scan_time,
            t.first_name, t.last_name, t.department
     FROM attendance a
     JOIN teachers t ON t.id = a.teacher_id
     WHERE DATE(a.scan_time) = ?
     ORDER BY a.scan_time DESC`,
    [todayDate],
  )

  // Count unique teachers who scanned in today
  const presentTeacherIds = new Set(
    todayAttendance
      .filter((r) => r.scan_type === 'time_in')
      .map((r) => r.teacher_id),
  )
  const lateCount = todayAttendance.filter(
    (r) => r.scan_type === 'time_in' && r.status === 'late',
  ).length
  const presentCount = presentTeacherIds.size
  const absentCount = Math.max(0, scheduledCount - presentCount)

  // Recent 10 attendance events (full feed)
  const recentActivity = todayAttendance.slice(0, 10).map((r) => ({
    teacher_name: `${r.first_name} ${r.last_name}`,
    department: r.department,
    scan_type: r.scan_type,
    status: r.status,
    scan_time: r.scan_time,
  }))

  // --- This-month payroll totals ---
  const firstOfMonth = `${todayDate.slice(0, 7)}-01`
  const lastOfMonth = todayDate

  const [payrollSettings] = await query(
    'SELECT late_deduction_amount, absence_deduction_amount FROM attendance_settings WHERE id = 1',
  )

  const allTeachers = await query(
    `SELECT id, teacher_type, monthly_salary, session_rate FROM teachers WHERE status = 'active'`,
  )

  const monthAttendance = await query(
    `SELECT teacher_id, scan_time, scan_type, status
     FROM attendance
     WHERE DATE(scan_time) >= ? AND DATE(scan_time) <= ?
     ORDER BY scan_time ASC`,
    [firstOfMonth, lastOfMonth],
  )

  const attendanceByTeacher = {}
  for (const row of monthAttendance) {
    if (!attendanceByTeacher[row.teacher_id]) attendanceByTeacher[row.teacher_id] = []
    attendanceByTeacher[row.teacher_id].push(row)
  }

  let totalGross = 0
  let totalDeductions = 0

  for (const teacher of allTeachers) {
    const att = attendanceByTeacher[teacher.id] || []

    // Count attended sessions (days with both time_in and time_out)
    const byDate = {}
    for (const row of att) {
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

    const gross =
      teacher.teacher_type === 'full_time'
        ? Number(teacher.monthly_salary || 0)
        : Number(teacher.session_rate || 0) * attended

    const lateDeduction =
      teacher.teacher_type === 'full_time'
        ? late * Number(payrollSettings?.late_deduction_amount || 0)
        : 0

    totalGross += gross
    totalDeductions += lateDeduction
  }

  const totalNet = Math.max(0, totalGross - totalDeductions)

  return res.json({
    teachers: {
      total: Number(teachers.total || 0),
      active: Number(teachers.active || 0),
      inactive: Number(teachers.inactive || 0),
      full_time: Number(teachers.full_time || 0),
      part_time: Number(teachers.part_time || 0),
    },
    departments: departmentCount,
    today: {
      date: todayDate,
      scheduled: scheduledCount,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
    },
    recent_activity: recentActivity,
    this_month: {
      period_from: firstOfMonth,
      period_to: lastOfMonth,
      total_gross: totalGross.toFixed(2),
      total_deductions: totalDeductions.toFixed(2),
      total_net: totalNet.toFixed(2),
    },
  })
})
