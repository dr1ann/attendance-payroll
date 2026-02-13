import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Icon from '../components/ui/Icon'

const defaultForm = { calendar_date: '', is_school_day: true, note: '' }

export default function CalendarPage() {
  const { token, isAdmin } = useAuth()
  const [rows, setRows] = useState([])
  const [form, setForm] = useState(defaultForm)
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadCalendar = useCallback(async () => {
    const data = await apiRequest('/calendar', {}, token)
    setRows(data)
  }, [token])

  useEffect(() => {
    loadCalendar().catch((err) => setError(err.message))
  }, [loadCalendar])

  const saveCalendarDay = async () => {
    if (!isAdmin) {
      return
    }

    setError('')
    setLoading(true)
    try {
      await apiRequest(
        '/calendar',
        {
          method: 'POST',
          body: JSON.stringify({
            ...form,
            is_school_day: Boolean(form.is_school_day),
          }),
        },
        token,
      )
      setForm(defaultForm)
      setFormOpen(false)
      await loadCalendar()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteCalendarDay = async () => {
    if (!isAdmin || !deleteTarget) {
      return
    }

    setError('')
    setLoading(true)
    try {
      await apiRequest(`/calendar/${deleteTarget.id}`, { method: 'DELETE' }, token)
      setDeleteTarget(null)
      await loadCalendar()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredRows = rows.filter((row) => {
    if (!query.trim()) {
      return true
    }

    const text = `${row.calendar_date} ${row.note || ''}`.toLowerCase()
    return text.includes(query.toLowerCase())
  })

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Calendar</h2>
        {isAdmin ? <Button onClick={() => setFormOpen(true)} icon={<Icon name="plus" />}>Add day</Button> : null}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by date or note"
        />
        <Button variant="secondary" icon={<Icon name="search" />}>Search</Button>
      </div>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">School Day</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Note</th>
              {isAdmin ? <th className="px-4 py-3 text-left font-medium text-gray-600 w-[1%] whitespace-nowrap">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 4 : 3} className="px-4 py-8 text-center text-gray-500">No calendar days found</td>
              </tr>
            ) : null}
            {filteredRows.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{String(row.calendar_date).slice(0, 10)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${Number(row.is_school_day) === 1 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {Number(row.is_school_day) === 1 ? 'Yes' : 'No'}
                  </span>
                </td>
                <td className="px-4 py-3">{row.note || '-'}</td>
                {isAdmin ? (
                  <td className="px-4 py-3">
                    <Button variant="danger" onClick={() => setDeleteTarget(row)} disabled={loading} icon={<Icon name="delete" />}>
                      Delete
                    </Button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        title="Add Calendar Day"
        onClose={() => setFormOpen(false)}
        onConfirm={saveCalendarDay}
        confirmLabel="Save Day"
        busy={loading}
      >
        <div className="grid gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Date
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="date"
              value={form.calendar_date}
              onChange={(event) => setForm((prev) => ({ ...prev, calendar_date: event.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Is School Day
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.is_school_day ? '1' : '0'}
              onChange={(event) => setForm((prev) => ({ ...prev, is_school_day: event.target.value === '1' }))}
            >
              <option value="1">Yes</option>
              <option value="0">No</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Note
            <input className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.note} onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))} />
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Calendar Day"
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteCalendarDay}
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={loading}
      >
        <p>Delete calendar day for <strong>{deleteTarget ? String(deleteTarget.calendar_date).slice(0, 10) : ''}</strong>?</p>
      </Modal>
    </section>
  )
}
