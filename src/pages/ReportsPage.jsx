import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0]
}

function firstOfMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function fmtDateTime(str) {
  if (!str) return '—'
  return new Date(str).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtMoney(val) {
  return `₱${Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function toCSV(headers, rows) {
  const escape = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers.map(escape).join(',')]
  for (const row of rows) {
    lines.push(row.map(escape).join(','))
  }
  return lines.join('\r\n')
}

function downloadCSV(filename, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Shared filter bar ───────────────────────────────────────────────────────

function FilterBar({ dateFrom, dateTo, onDateFrom, onDateTo, extra, onRun, loading }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex flex-wrap gap-4 items-end">
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          From
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={dateFrom}
            onChange={(e) => onDateFrom(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          To
          <input
            type="date"
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={dateTo}
            onChange={(e) => onDateTo(e.target.value)}
          />
        </label>
        {extra}
        <Button
          variant="primary"
          icon={<Icon name="search" />}
          onClick={onRun}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Generate'}
        </Button>
      </div>
    </div>
  )
}

// ─── Summary stat card ───────────────────────────────────────────────────────

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub ? <p className="text-xs text-gray-400 mt-0.5">{sub}</p> : null}
    </div>
  )
}

// ─── Tab: Attendance Log ─────────────────────────────────────────────────────

function AttendanceTab({ token, departments }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [dept, setDept] = useState('')
  const [status, setStatus] = useState('')
  const [records, setRecords] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const p = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
      if (dept) p.append('department', dept)
      if (status) p.append('status', status)
      const data = await apiRequest(`/reports/attendance?${p}`, {}, token)
      setRecords(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, dateFrom, dateTo, dept, status])

  const stats = useMemo(() => {
    if (!records) return null
    const timeIns = records.filter((r) => r.scan_type === 'time_in')
    return {
      total: records.length,
      timeIns: timeIns.length,
      timeOuts: records.filter((r) => r.scan_type === 'time_out').length,
      late: timeIns.filter((r) => r.status === 'late').length,
      onTime: timeIns.filter((r) => r.status === 'on_time').length,
    }
  }, [records])

  const exportCSV = () => {
    if (!records || records.length === 0) return
    const headers = ['Date/Time', 'Employee No', 'Last Name', 'First Name', 'Department', 'Teacher Type', 'Scan Type', 'Status']
    const rows = records.map((r) => [
      fmtDateTime(r.scan_time),
      r.employee_no,
      r.last_name,
      r.first_name,
      r.department,
      r.teacher_type === 'full_time' ? 'Full Time' : 'Part Time',
      r.scan_type === 'time_in' ? 'Time In' : 'Time Out',
      r.status === 'on_time' ? 'On Time' : 'Late',
    ])
    downloadCSV(`attendance_${dateFrom}_to_${dateTo}.csv`, toCSV(headers, rows))
  }

  return (
    <div>
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        loading={loading}
        onRun={run}
        extra={
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Department
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Arrival Status
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All</option>
                <option value="on_time">On Time</option>
                <option value="late">Late</option>
              </select>
            </label>
          </>
        }
      />

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      {stats ? (
        <div className="grid grid-cols-5 gap-4 mb-4">
          <StatCard label="Total Scans" value={stats.total} />
          <StatCard label="Time Ins" value={stats.timeIns} />
          <StatCard label="Time Outs" value={stats.timeOuts} />
          <StatCard label="On Time" value={stats.onTime} />
          <StatCard label="Late" value={stats.late} />
        </div>
      ) : null}

      {records !== null ? (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">{records.length} records found</p>
          <Button
            variant="secondary"
            icon={<Icon name="save" />}
            onClick={exportCSV}
            disabled={records.length === 0}
          >
            Export CSV
          </Button>
        </div>
      ) : null}

      {records !== null ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date / Time</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Employee No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Scan</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    No records found for the selected period
                  </td>
                </tr>
              ) : null}
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">{fmtDateTime(r.scan_time)}</td>
                  <td className="px-4 py-3">{r.employee_no}</td>
                  <td className="px-4 py-3 font-medium">{r.last_name}, {r.first_name}</td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${r.teacher_type === 'part_time' ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'}`}>
                      {r.teacher_type === 'part_time' ? 'Part Time' : 'Full Time'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${r.scan_type === 'time_in' ? 'bg-blue-100 text-blue-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {r.scan_type === 'time_in' ? 'Time In' : 'Time Out'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${r.status === 'on_time' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                      {r.status === 'on_time' ? 'On Time' : 'Late'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 p-10 text-center text-gray-400">
          Select a date range and click Generate to load the report.
        </div>
      )}
    </div>
  )
}

// ─── Tab: Tardiness Report ────────────────────────────────────────────────────

function TardinessTab({ token, departments }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [dept, setDept] = useState('')
  const [teacherType, setTeacherType] = useState('')
  const [records, setRecords] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const p = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
      if (dept) p.append('department', dept)
      if (teacherType) p.append('teacher_type', teacherType)
      const data = await apiRequest(`/reports/tardiness?${p}`, {}, token)
      setRecords(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, dateFrom, dateTo, dept, teacherType])

  const stats = useMemo(() => {
    if (!records) return null
    const withLate = records.filter((r) => r.late_count > 0)
    const totalLate = records.reduce((s, r) => s + r.late_count, 0)
    const totalDays = records.reduce((s, r) => s + r.attended_days, 0)
    return { withLate: withLate.length, totalLate, totalDays }
  }, [records])

  const exportCSV = () => {
    if (!records || records.length === 0) return
    const headers = ['Employee No', 'Last Name', 'First Name', 'Department', 'Type', 'Status', 'Days Attended', 'Late Count', 'On Time Count', 'Late Rate (%)']
    const rows = records.map((r) => [
      r.employee_no, r.last_name, r.first_name, r.department,
      r.teacher_type === 'full_time' ? 'Full Time' : 'Part Time',
      r.status,
      r.attended_days, r.late_count, r.on_time_count, r.late_rate,
    ])
    downloadCSV(`tardiness_${dateFrom}_to_${dateTo}.csv`, toCSV(headers, rows))
  }

  // Sort by late_count desc for display
  const sorted = useMemo(() => {
    if (!records) return []
    return [...records].sort((a, b) => b.late_count - a.late_count)
  }, [records])

  return (
    <div>
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        loading={loading}
        onRun={run}
        extra={
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Department
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Teacher Type
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={teacherType}
                onChange={(e) => setTeacherType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
              </select>
            </label>
          </>
        }
      />

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      {stats ? (
        <div className="grid grid-cols-3 gap-4 mb-4">
          <StatCard label="Teachers with Late Arrivals" value={stats.withLate} sub={`out of ${records.length} total`} />
          <StatCard label="Total Late Instances" value={stats.totalLate} />
          <StatCard label="Total Days Attended" value={stats.totalDays} />
        </div>
      ) : null}

      {records !== null ? (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">{records.length} teachers</p>
          <Button
            variant="secondary"
            icon={<Icon name="save" />}
            onClick={exportCSV}
            disabled={records.length === 0}
          >
            Export CSV
          </Button>
        </div>
      ) : null}

      {records !== null ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Employee No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Days Attended</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Late</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">On Time</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Late Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                    No records found for the selected period
                  </td>
                </tr>
              ) : null}
              {sorted.map((r) => (
                <tr key={r.employee_no} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{r.employee_no}</td>
                  <td className="px-4 py-3 font-medium">{r.last_name}, {r.first_name}</td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${r.teacher_type === 'part_time' ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'}`}>
                      {r.teacher_type === 'part_time' ? 'Part Time' : 'Full Time'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${r.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{r.attended_days}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={r.late_count > 0 ? 'font-semibold text-amber-700' : 'text-gray-500'}>
                      {r.late_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{r.on_time_count}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${Number(r.late_rate) === 0 ? 'bg-green-100 text-green-800' : Number(r.late_rate) < 30 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
                      {r.late_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 p-10 text-center text-gray-400">
          Select a date range and click Generate to load the report.
        </div>
      )}
    </div>
  )
}

// ─── Tab: Payroll Report ──────────────────────────────────────────────────────

function PayrollTab({ token, departments }) {
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [dept, setDept] = useState('')
  const [teacherType, setTeacherType] = useState('')
  const [records, setRecords] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const p = new URLSearchParams({ date_from: dateFrom, date_to: dateTo })
      if (dept) p.append('department', dept)
      if (teacherType) p.append('teacher_type', teacherType)
      const data = await apiRequest(`/reports/payroll?${p}`, {}, token)
      setRecords(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token, dateFrom, dateTo, dept, teacherType])

  const totals = useMemo(() => {
    if (!records) return null
    return {
      gross: records.reduce((s, r) => s + Number(r.gross_salary), 0),
      deductions: records.reduce((s, r) => s + Number(r.total_deductions), 0),
      net: records.reduce((s, r) => s + Number(r.net_salary), 0),
      count: records.length,
    }
  }, [records])

  const exportCSV = () => {
    if (!records || records.length === 0) return
    const headers = [
      'Employee No', 'Last Name', 'First Name', 'Department', 'Type', 'Status',
      'Expected Sessions', 'Attended Sessions', 'Absences', 'Late Count',
      'Gross Salary', 'Late Deduction', 'Absence Deduction', 'Total Deductions', 'Net Salary',
    ]
    const rows = records.map((r) => [
      r.employee_no, r.last_name, r.first_name, r.department,
      r.teacher_type === 'full_time' ? 'Full Time' : 'Part Time',
      r.status,
      r.expected_sessions, r.attended_sessions, r.absences, r.late_count,
      r.gross_salary, r.late_deduction, r.absence_deduction, r.total_deductions, r.net_salary,
    ])
    downloadCSV(`payroll_${dateFrom}_to_${dateTo}.csv`, toCSV(headers, rows))
  }

  return (
    <div>
      <FilterBar
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFrom={setDateFrom}
        onDateTo={setDateTo}
        loading={loading}
        onRun={run}
        extra={
          <>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Department
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={dept}
                onChange={(e) => setDept(e.target.value)}
              >
                <option value="">All Departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Teacher Type
              <select
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={teacherType}
                onChange={(e) => setTeacherType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="full_time">Full Time</option>
                <option value="part_time">Part Time</option>
              </select>
            </label>
          </>
        }
      />

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      {totals ? (
        <div className="grid grid-cols-4 gap-4 mb-4">
          <StatCard label="Teachers" value={totals.count} />
          <StatCard label="Total Gross" value={fmtMoney(totals.gross)} />
          <StatCard label="Total Deductions" value={fmtMoney(totals.deductions)} />
          <StatCard label="Total Net Payout" value={fmtMoney(totals.net)} />
        </div>
      ) : null}

      {records !== null ? (
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">{records.length} teachers</p>
          <Button
            variant="secondary"
            icon={<Icon name="save" />}
            onClick={exportCSV}
            disabled={records.length === 0}
          >
            Export CSV
          </Button>
        </div>
      ) : null}

      {records !== null ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Employee No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Dept</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Type</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Expected</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Attended</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Absences</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Late</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Gross</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Deductions</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Net</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-gray-500">
                    No records found for the selected period
                  </td>
                </tr>
              ) : null}
              {records.map((r) => (
                <tr key={r.employee_no} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{r.employee_no}</td>
                  <td className="px-4 py-3 font-medium">{r.last_name}, {r.first_name}</td>
                  <td className="px-4 py-3">{r.department}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${r.teacher_type === 'part_time' ? 'bg-purple-100 text-purple-800' : 'bg-sky-100 text-sky-800'}`}>
                      {r.teacher_type === 'part_time' ? 'PT' : 'FT'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{r.expected_sessions}</td>
                  <td className="px-4 py-3 text-right">{r.attended_sessions}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={r.absences > 0 ? 'text-red-700 font-semibold' : 'text-gray-500'}>
                      {r.absences}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={r.late_count > 0 ? 'text-amber-700 font-semibold' : 'text-gray-500'}>
                      {r.late_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">{fmtMoney(r.gross_salary)}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={Number(r.total_deductions) > 0 ? 'text-red-700' : 'text-gray-500'}>
                      {fmtMoney(r.total_deductions)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">
                    {fmtMoney(r.net_salary)}
                  </td>
                </tr>
              ))}
              {records.length > 0 && totals ? (
                <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                  <td colSpan={8} className="px-4 py-3 text-right text-gray-700">Totals</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(totals.gross)}</td>
                  <td className="px-4 py-3 text-right text-red-700">{fmtMoney(totals.deductions)}</td>
                  <td className="px-4 py-3 text-right">{fmtMoney(totals.net)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 p-10 text-center text-gray-400">
          Select a date range and click Generate to load the report.
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'attendance', label: 'Attendance Log', icon: 'history' },
  { id: 'tardiness', label: 'Tardiness', icon: 'clock' },
  { id: 'payroll', label: 'Payroll', icon: 'calendar' },
]

export default function ReportsPage() {
  const { token } = useAuth()
  const [activeTab, setActiveTab] = useState('attendance')
  const [departments, setDepartments] = useState([])

  useEffect(() => {
    apiRequest('/reports/departments', {}, token)
      .then(setDepartments)
      .catch(() => {})
  }, [token])

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Reports &amp; Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Generate and export attendance, tardiness, and payroll reports</p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
              activeTab === tab.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon name={tab.icon} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'attendance' ? (
        <AttendanceTab token={token} departments={departments} />
      ) : activeTab === 'tardiness' ? (
        <TardinessTab token={token} departments={departments} />
      ) : (
        <PayrollTab token={token} departments={departments} />
      )}
    </section>
  )
}
