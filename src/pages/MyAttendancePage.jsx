import { useCallback, useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import Icon from '../components/ui/Icon'
import { days } from '../constants/days'

function formatTime(dateString) {
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatTimeSlot(time) {
  const [h, m] = time.split(':')
  const d = new Date()
  d.setHours(Number(h), Number(m))
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export default function MyAttendancePage() {
  const { token } = useAuth()
  const [records, setRecords] = useState([])
  const [schedule, setSchedule] = useState([])
  const [teacher, setTeacher] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrError, setQrError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const [attendanceRows, scheduleRows, teacherRow] = await Promise.all([
        apiRequest('/attendance/my', {}, token),
        apiRequest('/schedules/my', {}, token),
        apiRequest('/teachers/me', {}, token),
      ])
      setRecords(attendanceRows)
      setSchedule(scheduleRows)
      setTeacher(teacherRow)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    if (!teacher) {
      setQrDataUrl('')
      setQrError('')
      return
    }

    let cancelled = false
    setQrGenerating(true)
    setQrDataUrl('')
    setQrError('')

    QRCode.toDataURL(teacher.employee_no, { margin: 1, scale: 8 })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQrError(err?.message || 'Unable to generate QR code')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQrGenerating(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [teacher])

  const downloadQrCode = () => {
    if (!qrDataUrl || !teacher) return

    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${teacher.employee_no}-qr.png`
    link.click()
  }

  // Group records by date
  const groupedRecords = {}
  for (const record of records) {
    const date = formatDate(record.scan_time)
    if (!groupedRecords[date]) {
      groupedRecords[date] = []
    }
    groupedRecords[date].push(record)
  }

  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">My Dashboard</h2>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* My QR Code */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-medium text-gray-800">My QR Code</h3>
            <p className="text-sm text-gray-600">
              Scan this when recording attendance. Employee no: {teacher?.employee_no || '—'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              onClick={downloadQrCode}
              disabled={!qrDataUrl || qrGenerating}
            >
              {qrGenerating ? 'Generating...' : 'Download QR'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex justify-center">
          {qrGenerating ? (
            <span className="text-gray-500 text-sm">Generating QR...</span>
          ) : qrError ? (
            <span className="text-red-600 text-sm">{qrError}</span>
          ) : qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR code for ${teacher?.employee_no || 'teacher'}`}
              className="w-48 h-48 border border-gray-200 rounded-lg shadow-sm bg-white p-3"
            />
          ) : (
            <span className="text-gray-500 text-sm">QR code unavailable</span>
          )}
        </div>
      </div>

      {/* My Schedule */}
      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-800 mb-3">My Schedule</h3>
        {schedule.length === 0 ? (
          <p className="text-gray-500 text-sm">No schedule assigned.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Day</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Start</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">End</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Grace (min)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {schedule.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{days[s.day_of_week]}</td>
                    <td className="px-4 py-3">{formatTimeSlot(s.time_start)}</td>
                    <td className="px-4 py-3">{formatTimeSlot(s.time_end)}</td>
                    <td className="px-4 py-3">{s.grace_minutes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* My Attendance */}
      <div>
        <h3 className="text-lg font-medium text-gray-800 mb-3">Recent Attendance</h3>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Loading...</p>
        ) : records.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Icon name="history" className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No attendance records yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedRecords).map(([date, dateRecords]) => (
              <div key={date} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">{date}</h4>
                </div>
                <div className="divide-y divide-gray-100">
                  {dateRecords.map((record) => (
                    <div key={record.id} className="flex items-center justify-between px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            record.scan_type === 'time_in'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {record.scan_type === 'time_in' ? 'Time In' : 'Time Out'}
                        </span>
                        <span className="text-sm text-gray-700">{formatTime(record.scan_time)}</span>
                      </div>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          record.status === 'on_time'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {record.status === 'on_time' ? 'On Time' : 'Late'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
