import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getAttendanceStatus,
  getScheduleValidation,
  selectSchedule,
} from './attendance.js'

const schedule = {
  id: 1,
  time_start: '08:00:00',
  time_end: '12:00:00',
}

test('getScheduleValidation rejects teachers without a schedule today', () => {
  assert.deepEqual(getScheduleValidation('full_time', null, '08:00:00', 'time_in'), {
    error: 'No schedule found for this teacher today',
  })
})

test('getScheduleValidation allows time in within 30 minutes before schedule start', () => {
  assert.deepEqual(getScheduleValidation('full_time', schedule, '07:30:00', 'time_in'), {
    error: '',
  })
})

test('getScheduleValidation rejects time in earlier than 30 minutes before schedule start', () => {
  assert.deepEqual(getScheduleValidation('full_time', schedule, '07:29:00', 'time_in'), {
    error: 'Time in is only allowed 30 minutes before the scheduled start time',
  })
})

test('getScheduleValidation rejects part-time time in after the schedule time frame', () => {
  assert.deepEqual(getScheduleValidation('part_time', schedule, '12:01:00', 'time_in'), {
    error: 'Part-time attendance can only be recorded during the scheduled time frame',
  })
})

test('getAttendanceStatus marks full-time teacher late immediately after schedule start', () => {
  assert.equal(getAttendanceStatus('full_time', schedule, '08:01:00', 'time_in'), 'late')
})

test('getAttendanceStatus does not mark part-time teacher late', () => {
  assert.equal(getAttendanceStatus('part_time', schedule, '08:30:00', 'time_in'), 'on_time')
})

test('selectSchedule picks the currently active schedule', () => {
  const selected = selectSchedule('09:00:00', [
    { id: 1, time_start: '08:00:00', time_end: '10:00:00' },
    { id: 2, time_start: '13:00:00', time_end: '15:00:00' },
  ])

  assert.equal(selected.id, 1)
})
