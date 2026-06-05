import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { apiRequest } from '../api'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'
import AppLogo from '../components/ui/AppLogo'
import { EMPLOYEE_NO_HELP_TEXT, EMPLOYEE_NO_MAX_LENGTH, validateEmployeeNo } from '../constants/employeeNo'
import { getEmployeeNoFromQr, getScannerQrBox } from '../constants/qrAttendance'
import { shouldAcceptScan } from '../constants/scanGuard'

const SCANNER_CONFIG = {
  fps: 15,
  qrbox: getScannerQrBox,
  aspectRatio: 1.0,
  disableFlip: false,
}

export default function TeacherScanPage() {
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)
  const [manualInput, setManualInput] = useState('')
  const [scheduleOptions, setScheduleOptions] = useState([])
  const [scheduleSelection, setScheduleSelection] = useState(null)
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [pendingEmployeeNo, setPendingEmployeeNo] = useState('')
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleError, setScheduleError] = useState('')
  const [manualInputError, setManualInputError] = useState('')

  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)
  const scanFlowActiveRef = useRef(false)
  const lastScanRef = useRef({ value: '', scannedAt: 0 })

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current?.isScanning) {
      await html5QrCodeRef.current.stop()
    }
    setScanning(false)
  }, [])

  const processScan = useCallback(
    async (employeeNo, scheduleId = null) => {
      if (processing || !employeeNo) return

      setProcessing(true)
      setError('')
      setResult(null)

      try {
        const response = await apiRequest(
          '/public/attendance/scan',
          {
            method: 'POST',
            body: JSON.stringify({ employee_no: employeeNo.trim(), schedule_id: scheduleId }),
          },
        )

        setResult({
          success: true,
          message: response.message,
          data: response.attendance,
        })
      } catch (err) {
        setError(err.message)
        setResult({
          success: false,
          message: err.message,
        })
      } finally {
        setProcessing(false)
        scanFlowActiveRef.current = false
        setScheduleModalOpen(false)
        setPendingEmployeeNo('')
        setScheduleSelection(null)
        setScheduleOptions([])
        setScheduleError('')
      }
    },
    [processing],
  )

  const confirmScheduleChoice = useCallback(() => {
    if (!pendingEmployeeNo) return
    if (scheduleOptions.length > 0 && !scheduleSelection) {
      setScheduleError('Select a schedule before continuing')
      return
    }
    processScan(pendingEmployeeNo, scheduleSelection)
  }, [pendingEmployeeNo, processScan, scheduleOptions.length, scheduleSelection])

  const loadSchedulesForToday = useCallback(async (employeeNo) => {
    setScheduleLoading(true)
    setScheduleError('')
    try {
      const data = await apiRequest(
        `/public/attendance/today-schedules?employee_no=${encodeURIComponent(employeeNo.trim())}`,
      )
      return data
    } catch (err) {
      setScheduleError(err.message)
      setError(err.message)
      setResult({
        success: false,
        message: err.message,
      })
      return null
    } finally {
      setScheduleLoading(false)
    }
  }, [])

  const handleScanFlow = useCallback(
    async (rawEmployeeNo) => {
      const scannedEmployeeNo = getEmployeeNoFromQr(rawEmployeeNo)
      const validation = validateEmployeeNo(scannedEmployeeNo)

      if (validation.error) {
        setError(validation.error)
        setResult({
          success: false,
          message: validation.error,
        })
        return
      }

      const employeeNo = validation.value
      const now = Date.now()

      if (!shouldAcceptScan(employeeNo, scanFlowActiveRef.current, lastScanRef.current, now)) {
        return
      }

      scanFlowActiveRef.current = true
      lastScanRef.current = { value: employeeNo, scannedAt: now }
      setManualInputError('')

      const data = await loadSchedulesForToday(employeeNo)
      if (!data) {
        scanFlowActiveRef.current = false
        return
      }

      const todaysSchedules = data.schedules || []

      if (todaysSchedules.length === 0) {
        const message = 'No schedule found for this teacher today'
        setError(message)
        setResult({
          success: false,
          message,
        })
        scanFlowActiveRef.current = false
        return
      }

      if (todaysSchedules.length <= 1) {
        const scheduleId = todaysSchedules[0]?.id || null
        processScan(employeeNo, scheduleId)
        return
      }

      setPendingEmployeeNo(employeeNo)
      setScheduleOptions(todaysSchedules)
      setScheduleSelection(todaysSchedules[0]?.id || null)
      setScheduleModalOpen(true)
    },
    [loadSchedulesForToday, processScan],
  )

  const startScanner = useCallback(async () => {
    if (!scannerRef.current) return

    setError('')
    setResult(null)

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-scanner-public')
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        SCANNER_CONFIG,
        (decodedText) => {
          handleScanFlow(decodedText)
        },
        () => {
          // Ignore per-frame scan errors (no QR found)
        },
      )

      setScanning(true)
    } catch (err) {
      setError(`Camera error: ${err.message || 'Unable to access camera'}`)
    }
  }, [handleScanFlow])

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => { })
      }
    }
  }, [])

  const handleManualSubmit = (event) => {
    event.preventDefault()

    const validation = validateEmployeeNo(manualInput)

    if (validation.error) {
      setManualInputError(validation.error)
      setError(validation.error)
      setResult({
        success: false,
        message: validation.error,
      })
      return
    }

    setManualInputError('')
    handleScanFlow(validation.value)
    setManualInput('')
  }

  const clearResult = () => {
    setResult(null)
    setError('')
  }

  const closeScheduleModal = () => {
    setScheduleModalOpen(false)
    setPendingEmployeeNo('')
    setScheduleSelection(null)
    setScheduleOptions([])
    setScheduleError('')
    scanFlowActiveRef.current = false
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f1f5f9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      {/* Branding */}
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <AppLogo />
        <p style={{ color: '#1e293b', fontSize: '14px', margin: 0 }}>
          Teacher Attendance Scanner
        </p>
      </div>

      {/* Result / Error banner */}
      {(result || error) && (
        <div
          style={{
            width: '100%',
            maxWidth: '480px',
            marginBottom: '16px',
            borderRadius: '12px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            background: result?.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${result?.success ? '#bbf7d0' : '#fecaca'}`,
          }}
          role="status"
          aria-live="polite"
        >
          <div
            style={{
              padding: '6px',
              borderRadius: '50%',
              background: result?.success ? '#dcfce7' : '#fee2e2',
              flexShrink: 0,
            }}
          >
            <Icon
              name={result?.success ? 'check' : 'alert'}
              className={`w-5 h-5 ${result?.success ? 'text-green-700' : 'text-red-700'}`}
            />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 2px', fontWeight: 600, color: result?.success ? '#166534' : '#991b1b', fontSize: '14px' }}>
              {result?.success ? 'Scan Successful' : 'Scan Failed'}
            </p>
            <p style={{ margin: 0, color: result?.success ? '#15803d' : '#b91c1c', fontSize: '13px' }}>
              {result?.message || error}
            </p>
          </div>
          <Button variant="ghost" onClick={clearResult} className="!p-2">
            <Icon name="close" />
          </Button>
        </div>
      )}

      {/* Main card */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'white',
          borderRadius: '16px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Scanner area */}
        <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9' }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
            QR Code Scanner
          </h2>
          <div
            id="qr-scanner-public"
            ref={scannerRef}
            style={{
              width: '100%',
              aspectRatio: '1',
              background: '#f8fafc',
              borderRadius: '10px',
              overflow: 'hidden',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            {!scanning ? (
              <Button onClick={startScanner} className="flex-1" icon={<Icon name="qr-scan" />}>
                Start Scanner
              </Button>
            ) : (
              <Button onClick={stopScanner} variant="secondary" className="flex-1">
                Stop Scanner
              </Button>
            )}
          </div>
        </div>

        {/* Manual entry */}
        <div style={{ padding: '24px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Manual Entry
          </h3>
          <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '8px' }}>
            <input
              id="teacher-scan-manual-input"
              className={`flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 ${manualInputError
                ? 'border-red-300 focus:ring-red-500'
                : 'border-gray-300 focus:ring-blue-500'
                }`}
              placeholder="Enter employee number"
              value={manualInput}
              onChange={(e) => {
                setManualInput(e.target.value)
                if (manualInputError) {
                  setManualInputError('')
                }
              }}
              disabled={processing}
              maxLength={EMPLOYEE_NO_MAX_LENGTH + 1}
              aria-invalid={Boolean(manualInputError)}
              aria-describedby="teacher-scan-manual-help"
            />
            <Button type="submit" disabled={processing || !manualInput.trim()}>
              Submit
            </Button>
          </form>
          <p
            id="teacher-scan-manual-help"
            style={{
              margin: '8px 0 0',
              fontSize: '12px',
              color: manualInputError ? '#dc2626' : '#64748b',
            }}
          >
            {manualInputError || `${EMPLOYEE_NO_MAX_LENGTH} characters max. ${EMPLOYEE_NO_HELP_TEXT}`}
          </p>
        </div>

        {/* Success detail */}
        {result?.success && result?.data && (
          <div style={{ margin: '0 24px 24px', borderRadius: '10px', background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Teacher', value: result.data.teacher.name },
                { label: 'Type', value: result.data.scan_type === 'time_in' ? 'Time In' : 'Time Out' },
                {
                  label: 'Status',
                  value: result.data.status === 'on_time' ? 'On Time' : 'Late',
                  valueStyle: { color: result.data.status === 'on_time' ? '#166534' : '#92400e' },
                },
                { label: 'Time', value: result.data.scan_time },
              ].map(({ label, value, valueStyle }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                  <span style={{ color: '#15803d' }}>{label}</span>
                  <span style={{ fontWeight: 600, color: '#166534', ...valueStyle }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {processing && (
          <div style={{ textAlign: 'center', padding: '16px', color: '#64748b', fontSize: '14px' }}>
            Processing scan…
          </div>
        )}
      </div>

      {/* Schedule selection modal */}
      <Modal
        open={scheduleModalOpen}
        title="Select Schedule"
        onClose={closeScheduleModal}
        onConfirm={confirmScheduleChoice}
        confirmLabel="Use Schedule"
        busy={processing}
      >
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Choose which schedule to record for employee <strong>{pendingEmployeeNo}</strong>.
          </p>

          {scheduleError ? (
            <p className="text-sm text-red-600">{scheduleError}</p>
          ) : null}

          {scheduleLoading ? (
            <p className="text-sm text-gray-600">Loading schedules...</p>
          ) : scheduleOptions.length === 0 ? (
            <p className="text-sm text-red-600">No schedule found for this teacher today.</p>
          ) : (
            <div className="space-y-2">
              {scheduleOptions.map((opt) => {
                const selected = scheduleSelection === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScheduleSelection(opt.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${selected
                      ? 'border-blue-500 bg-blue-50 text-blue-800'
                      : 'border-gray-200 hover:border-blue-200 text-gray-800'
                    }`}
                  >
                    <span className="text-left">
                      {opt.subject ? `${opt.subject} - ` : ''}
                      {opt.time_start} - {opt.time_end}
                    </span>
                    {selected ? <Icon name="check" className="w-4 h-4" /> : null}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
