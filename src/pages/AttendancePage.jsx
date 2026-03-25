import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getTodayDate() {
  return new Date().toISOString().split('T')[0]
}

export default function AttendancePage() {
  const { token } = useAuth()
  const [records, setRecords] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filters
  const [dateFrom, setDateFrom] = useState(getTodayDate())
  const [dateTo, setDateTo] = useState(getTodayDate())
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')

  const loadTeachers = useCallback(async () => {
    const rows = await apiRequest('/teachers', {}, token)
    setTeachers(rows)
  }, [token])

  const loadRecords = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      if (dateFrom) params.append('date_from', dateFrom)
      if (dateTo) params.append('date_to', dateTo)
      if (selectedTeacher) params.append('teacher_id', selectedTeacher)
      if (selectedStatus) params.append('status', selectedStatus)

      const queryString = params.toString()
      const path = queryString ? `/attendance?${queryString}` : '/attendance'

      const rows = await apiRequest(path, {}, token)
      setRecords(rows)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, dateFrom, dateTo, selectedTeacher, selectedStatus])

  useEffect(() => {
    loadTeachers().catch((err) => setError(err.message))
  }, [loadTeachers])

  useEffect(() => {
    loadRecords()
  }, [loadRecords])

  // Group records by date for display
  const groupedRecords = useMemo(() => {
    const grouped = {}
    for (const record of records) {
      const date = formatDate(record.scan_time)
      if (!grouped[date]) {
        grouped[date] = []
      }
      grouped[date].push(record)
    }
    return grouped
  }, [records])

  const clearFilters = () => {
    setDateFrom(getTodayDate())
    setDateTo(getTodayDate())
    setSelectedTeacher('')
    setSelectedStatus('')
  }

  // Stats for today
  const stats = useMemo(() => {
    const today = getTodayDate()
    const todayRecords = records.filter((r) => r.scan_time.startsWith(today))
    const timeIns = todayRecords.filter((r) => r.scan_type === 'time_in')
    const lateCount = timeIns.filter((r) => r.status === 'late').length

    return {
      totalScans: todayRecords.length,
      timeIns: timeIns.length,
      timeOuts: todayRecords.filter((r) => r.scan_type === 'time_out').length,
      lateArrivals: lateCount,
    }
  }, [records])

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Attendance History</h2>
      </div>

      {/* Stats Cards - Show only when viewing today */}
      {dateFrom === getTodayDate() && dateTo === getTodayDate() && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total Scans</p>
            <p className="text-2xl font-bold text-gray-900">{stats.totalScans}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Time Ins</p>
            <p className="text-2xl font-bold text-blue-600">{stats.timeIns}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Time Outs</p>
            <p className="text-2xl font-bold text-green-600">{stats.timeOuts}</p>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Late Arrivals</p>
            <p className="text-2xl font-bold text-amber-600">{stats.lateArrivals}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="grid grid-cols-5 gap-4 items-end">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            From Date
            <input
              type="date"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            To Date
            <input
              type="date"
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Teacher
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
            >
              <option value="">All Teachers</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.last_name}, {t.first_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Status
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="on_time">On Time</option>
              <option value="late">Late</option>
            </select>
          </label>
          <Button variant="secondary" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-gray-500 text-center py-8">Loading...</p>
      ) : records.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <Icon name="history" className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No attendance records found</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedRecords).map(([date, dateRecords]) => (
            <div key={date} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                <h3 className="font-medium text-gray-900">{date}</h3>
                <p className="text-sm text-gray-500">{dateRecords.length} record(s)</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Time</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Employee No</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {dateRecords.map((record) => (
                    <tr key={record.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{formatTime(record.scan_time)}</td>
                      <td className="px-4 py-3">{record.employee_no}</td>
                      <td className="px-4 py-3">
                        {record.last_name}, {record.first_name}
                      </td>
                      <td className="px-4 py-3">{record.department}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            record.scan_type === 'time_in'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {record.scan_type === 'time_in' ? 'Time In' : 'Time Out'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            record.status === 'on_time'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {record.status === 'on_time' ? 'On Time' : 'Late'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
