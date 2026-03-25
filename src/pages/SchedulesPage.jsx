import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import { days } from '../constants/days'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ActionButtons from '../components/ui/ActionButtons'
import Icon from '../components/ui/Icon'

const emptySchedule = {
  teacher_id: '',
  day_of_week: 1,
  time_start: '08:00',
  time_end: '17:00',
  grace_minutes: 15,
}

export default function SchedulesPage() {
  const { token, isAdmin } = useAuth()
  const [teachers, setTeachers] = useState([])
  const [schedules, setSchedules] = useState([])
  const [scheduleForm, setScheduleForm] = useState(emptySchedule)
  const [editScheduleId, setEditScheduleId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [formErrors, setFormErrors] = useState({})

  const teacherOptions = useMemo(
    () => teachers.map((teacher) => ({ id: teacher.id, name: `${teacher.last_name}, ${teacher.first_name}` })),
    [teachers],
  )

  const filteredSchedules = useMemo(() => {
    if (!query.trim()) {
      return schedules
    }

    const search = query.toLowerCase()
    return schedules.filter((schedule) =>
      [schedule.first_name, schedule.last_name, schedule.employee_no, days[schedule.day_of_week]]
        .join(' ')
        .toLowerCase()
        .includes(search),
    )
  }, [query, schedules])

  const loadData = useCallback(async () => {
    const [teacherRows, scheduleRows] = await Promise.all([
      apiRequest('/teachers', {}, token),
      apiRequest('/schedules', {}, token),
    ])

    setTeachers(teacherRows)
    setSchedules(scheduleRows)
  }, [token])

  useEffect(() => {
    loadData().catch((err) => setError(err.message))
  }, [loadData])

  const saveSchedule = async () => {
    if (!isAdmin) {
      return
    }

    setError('')
    setFormErrors({})

    const errs = {}
    if (!scheduleForm.teacher_id) errs.teacher_id = 'Teacher is required'
    if (scheduleForm.day_of_week === '' || scheduleForm.day_of_week === null || scheduleForm.day_of_week === undefined) {
      errs.day_of_week = 'Day is required'
    }
    if (!scheduleForm.time_start) errs.time_start = 'Start time is required'
    if (!scheduleForm.time_end) errs.time_end = 'End time is required'

    const startMinutes = scheduleForm.time_start ? Number(scheduleForm.time_start.split(':')[0]) * 60 + Number(scheduleForm.time_start.split(':')[1]) : 0
    const endMinutes = scheduleForm.time_end ? Number(scheduleForm.time_end.split(':')[0]) * 60 + Number(scheduleForm.time_end.split(':')[1]) : 0
    if (scheduleForm.time_start && scheduleForm.time_end && endMinutes <= startMinutes) {
      errs.time_end = 'End time must be after start time'
    }

    if (scheduleForm.grace_minutes === '' || Number.isNaN(Number(scheduleForm.grace_minutes))) {
      errs.grace_minutes = 'Grace minutes is required'
    } else if (Number(scheduleForm.grace_minutes) < 0) {
      errs.grace_minutes = 'Grace minutes cannot be negative'
    }

    if (Object.keys(errs).length) {
      setFormErrors(errs)
      return
    }

    setLoading(true)
    try {
      const path = editScheduleId ? `/schedules/${editScheduleId}` : '/schedules'
      await apiRequest(
        path,
        {
          method: editScheduleId ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...scheduleForm,
            teacher_id: Number(scheduleForm.teacher_id),
            day_of_week: Number(scheduleForm.day_of_week),
            grace_minutes: Number(scheduleForm.grace_minutes),
          }),
        },
        token,
      )

      setScheduleForm(emptySchedule)
      setEditScheduleId(null)
      setFormOpen(false)
      setFormErrors({})
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteSchedule = async () => {
    if (!isAdmin || !deleteTarget) {
      return
    }

    setError('')
    setLoading(true)
    try {
      await apiRequest(`/schedules/${deleteTarget.id}`, { method: 'DELETE' }, token)
      setDeleteTarget(null)
      await loadData()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Schedules</h2>
        {isAdmin ? (
          <Button
            icon={<Icon name="plus" />}
            onClick={() => {
              setEditScheduleId(null)
              setScheduleForm(emptySchedule)
              setFormOpen(true)
            }}
          >
            Add schedule
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by teacher or day"
        />
        <Button variant="secondary" icon={<Icon name="search" />}>Search</Button>
      </div>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Teacher</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Day</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Start</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">End</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Grace (min)</th>
              {isAdmin ? <th className="px-4 py-3 text-left font-medium text-gray-600 w-[1%] whitespace-nowrap">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredSchedules.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-500">No schedules found</td>
              </tr>
            ) : null}
            {filteredSchedules.map((schedule) => (
              <tr key={schedule.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{schedule.last_name}, {schedule.first_name}</td>
                <td className="px-4 py-3">{days[schedule.day_of_week]}</td>
                <td className="px-4 py-3">{String(schedule.time_start).slice(0, 5)}</td>
                <td className="px-4 py-3">{String(schedule.time_end).slice(0, 5)}</td>
                <td className="px-4 py-3">{schedule.grace_minutes}</td>
                {isAdmin ? (
                  <td className="px-4 py-3">
                    <ActionButtons
                      onEdit={() => {
                        setEditScheduleId(schedule.id)
                        setScheduleForm({
                          teacher_id: String(schedule.teacher_id),
                          day_of_week: schedule.day_of_week,
                          time_start: String(schedule.time_start).slice(0, 5),
                          time_end: String(schedule.time_end).slice(0, 5),
                          grace_minutes: schedule.grace_minutes,
                        })
                        setFormOpen(true)
                      }}
                      onDelete={() => setDeleteTarget(schedule)}
                      disabled={loading}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        title={editScheduleId ? 'Edit Schedule' : 'Add Schedule'}
        onClose={() => setFormOpen(false)}
        onConfirm={saveSchedule}
        confirmLabel={editScheduleId ? 'Save Changes' : 'Create Schedule'}
        confirmVariant="primary"
        busy={loading}
      >
        <div className="grid gap-4">
          {Object.keys(formErrors).length ? (
            <p className="text-sm text-red-600">Please fix the highlighted fields.</p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Teacher
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={scheduleForm.teacher_id}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, teacher_id: event.target.value }))}
            >
              <option value="">Select teacher</option>
              {teacherOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            {formErrors.teacher_id ? (
              <span className="text-xs text-red-600">{formErrors.teacher_id}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Day
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={scheduleForm.day_of_week}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, day_of_week: event.target.value }))}
            >
              {days.map((name, index) => (
                <option key={name} value={index}>
                  {name}
                </option>
              ))}
            </select>
            {formErrors.day_of_week ? (
              <span className="text-xs text-red-600">{formErrors.day_of_week}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Start
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="time"
              value={scheduleForm.time_start}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, time_start: event.target.value }))}
            />
            {formErrors.time_start ? (
              <span className="text-xs text-red-600">{formErrors.time_start}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            End
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="time"
              value={scheduleForm.time_end}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, time_end: event.target.value }))}
            />
            {formErrors.time_end ? (
              <span className="text-xs text-red-600">{formErrors.time_end}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Grace Minutes
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              min="0"
              value={scheduleForm.grace_minutes}
              onChange={(event) => setScheduleForm((prev) => ({ ...prev, grace_minutes: event.target.value }))}
            />
            {formErrors.grace_minutes ? (
              <span className="text-xs text-red-600">{formErrors.grace_minutes}</span>
            ) : null}
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Schedule"
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteSchedule}
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={loading}
      >
        <p>
          Delete this schedule for <strong>{deleteTarget ? `${deleteTarget.last_name}, ${deleteTarget.first_name}` : ''}</strong>?
        </p>
      </Modal>
    </section>
  )
}
