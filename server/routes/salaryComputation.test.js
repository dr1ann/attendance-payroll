import test from 'node:test'
import assert from 'node:assert/strict'
import {
  computeAttendanceStats,
  computeSalaryForTeacher,
} from './salaryComputation.js'

test('computeAttendanceStats counts attended sessions by schedule', () => {
  const stats = computeAttendanceStats([
    {
      teacher_id: 1,
      schedule_id: 10,
      scan_time: '2026-06-04 08:00:00',
      scan_type: 'time_in',
      status: 'on_time',
    },
    {
      teacher_id: 1,
      schedule_id: 10,
      scan_time: '2026-06-04 12:00:00',
      scan_type: 'time_out',
      status: 'on_time',
    },
    {
      teacher_id: 1,
      schedule_id: 11,
      scan_time: '2026-06-04 13:01:00',
      scan_type: 'time_in',
      status: 'late',
    },
    {
      teacher_id: 1,
      schedule_id: 11,
      scan_time: '2026-06-04 17:00:00',
      scan_type: 'time_out',
      status: 'on_time',
    },
  ])

  assert.deepEqual(stats, {
    attendedSessions: 2,
    lateCount: 1,
  })
})

test('computeAttendanceStats counts part-time attendance from time in only', () => {
  const stats = computeAttendanceStats([
    {
      teacher_id: 1,
      schedule_id: 10,
      scan_time: '2026-06-04 08:00:00',
      scan_type: 'time_in',
      status: 'on_time',
    },
  ], 'part_time')

  assert.deepEqual(stats, {
    attendedSessions: 1,
    lateCount: 0,
  })
})

test('computeSalaryForTeacher applies late deduction only to full-time teachers', () => {
  const settings = {
    late_deduction_amount: 100,
    absence_deduction_amount: 250,
  }
  const periodStats = {
    attendedSessions: 2,
    lateCount: 1,
    absenceCount: 1,
  }

  const fullTimeSalary = computeSalaryForTeacher(
    { teacher_type: 'full_time', monthly_salary: 20000 },
    periodStats,
    settings,
  )
  const partTimeSalary = computeSalaryForTeacher(
    { teacher_type: 'part_time', session_rate: 500 },
    periodStats,
    settings,
  )

  assert.equal(fullTimeSalary.lateDeduction, 100)
  assert.equal(fullTimeSalary.absenceDeduction, 250)
  assert.equal(partTimeSalary.lateDeduction, 0)
  assert.equal(partTimeSalary.absenceDeduction, 250)
})
