import { useEffect, useState } from 'react'
import { apiRequest, getSalaryComputationSummary, getAttendanceSalaryBreakdown } from '../api'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Icon from '../components/ui/Icon'

function formatDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export default function SalaryComputationPage() {
  const { token } = useAuth()
  const today = new Date()
  const prior = new Date()
  prior.setDate(today.getDate() - 6)

  const [dateFrom, setDateFrom] = useState(formatDate(prior))
  const [dateTo, setDateTo] = useState(formatDate(today))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)

  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [breakdown, setBreakdown] = useState(null)
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [breakdownError, setBreakdownError] = useState('')

  const loadSummary = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await getSalaryComputationSummary(dateFrom, dateTo, token)
      setSummary(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSummary().catch((err) => setError(err.message))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openBreakdown = async (teacherId) => {
    setBreakdownError('')
    setBreakdown(null)
    setSelectedTeacher(null)
    setBreakdownLoading(true)
    setBreakdownOpen(true)
    try {
      const data = await getAttendanceSalaryBreakdown(teacherId, dateFrom, dateTo, token)
      setBreakdown(data)
      setSelectedTeacher(data.teacher)
    } catch (err) {
      setBreakdownError(err.message)
    } finally {
      setBreakdownLoading(false)
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Attendance-Based Salary Computation</h2>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">From</label>
          <input className="px-3 py-2 border border-gray-300 rounded-lg" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <label className="text-sm text-gray-600">To</label>
          <input className="px-3 py-2 border border-gray-300 rounded-lg" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <Button onClick={loadSummary} variant="primary" icon={<Icon name="search" />}>{loading ? 'Loading...' : 'Compute'}</Button>
        </div>
      </div>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Teacher</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Expected</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Attended</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Gross Salary</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Deductions</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Net</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {!summary ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No data loaded</td>
              </tr>
            ) : null}

            {summary && summary.summary.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No salary entries for the selected period</td>
              </tr>
            ) : null}

            {summary && summary.summary.map((row) => (
              <tr key={row.teacher.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{row.teacher.last_name}, {row.teacher.first_name}</td>
                <td className="px-4 py-3">{row.teacher.department}</td>
                <td className="px-4 py-3">{row.teacher_type}</td>
                <td className="px-4 py-3">{row.metrics.expected_sessions}</td>
                <td className="px-4 py-3">{row.metrics.attended_sessions}</td>
                <td className="px-4 py-3">₱{Number(row.salary.gross_salary).toFixed(2)}</td>
                <td className="px-4 py-3">₱{Number(row.deductions.total).toFixed(2)}</td>
                <td className="px-4 py-3">₱{Number(row.salary.net_salary).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <Button variant="secondary" onClick={() => openBreakdown(row.teacher.id)}>View</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={breakdownOpen}
        title={selectedTeacher ? `${selectedTeacher.last_name}, ${selectedTeacher.first_name}` : 'Attendance-based salary breakdown'}
        onClose={() => setBreakdownOpen(false)}
        confirmLabel="Close"
        onConfirm={() => setBreakdownOpen(false)}
        busy={breakdownLoading}
      >
        {breakdownLoading ? (
          <p className="text-sm text-gray-600">Loading...</p>
        ) : breakdownError ? (
          <p className="text-sm text-red-600">{breakdownError}</p>
        ) : breakdown ? (
          <div className="grid gap-3">
            <p className="text-sm text-gray-700">Period: {breakdown.period.date_from} → {breakdown.period.date_to}</p>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Scan Time</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {breakdown.attendance.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-4 text-center text-gray-500">No attendance records</td>
                    </tr>
                  ) : null}
                  {breakdown.attendance.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{r.scan_time}</td>
                      <td className="px-4 py-3">{r.scan_type}</td>
                      <td className="px-4 py-3">{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  )
}
