import { useCallback, useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'

const SCANNER_CONFIG = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0,
}

export default function ScanPage() {
  const { token, isAdmin } = useAuth()
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

  const scannerRef = useRef(null)
  const html5QrCodeRef = useRef(null)

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
          '/attendance/scan',
          {
            method: 'POST',
            body: JSON.stringify({ employee_no: employeeNo.trim(), schedule_id: scheduleId }),
          },
          token,
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
        setScheduleModalOpen(false)
        setPendingEmployeeNo('')
        setScheduleSelection(null)
        setScheduleOptions([])
      }
    },
    [processing, token],
  )
  
  const confirmScheduleChoice = useCallback(() => {
    if (!pendingEmployeeNo || !scheduleSelection) return
    processScan(pendingEmployeeNo, scheduleSelection)
  }, [pendingEmployeeNo, processScan, scheduleSelection])



  const loadSchedulesForToday = useCallback(
    async (employeeNo) => {
      setScheduleLoading(true)
      setScheduleError('')
      try {
        const data = await apiRequest(
          `/attendance/today-schedules?employee_no=${encodeURIComponent(employeeNo.trim())}`,
          {},
          token,
        )
        return data
      } catch (err) {
        setScheduleError(err.message)
        return null
      } finally {
        setScheduleLoading(false)
      }
    },
    [token],
  )

  const handleScanFlow = useCallback(
    async (employeeNo) => {
      if (!employeeNo) return

      // Fetch schedules for today and prompt if more than one
      const data = await loadSchedulesForToday(employeeNo)
      if (!data) return

      const todaysSchedules = data.schedules || []

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
    if (!scannerRef.current || !isAdmin) return

    setError('')
    setResult(null)

    try {
      if (!html5QrCodeRef.current) {
        html5QrCodeRef.current = new Html5Qrcode('qr-scanner')
      }

      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        SCANNER_CONFIG,
        (decodedText) => {
          handleScanFlow(decodedText)
        },
        () => {
          // Ignore scan errors (no QR found)
        },
      )

      setScanning(true)
    } catch (err) {
      setError(`Camera error: ${err.message || 'Unable to access camera'}`)
    }
  }, [isAdmin, processScan])

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current?.isScanning) {
        html5QrCodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  const handleManualSubmit = (event) => {
    event.preventDefault()
    if (manualInput.trim()) {
      handleScanFlow(manualInput.trim())
      setManualInput('')
    }
  }

  const clearResult = () => {
    setResult(null)
    setError('')
  }

  const closeScheduleModal = () => {
    setScheduleModalOpen(false)
    setPendingEmployeeNo('')
    setScheduleSelection(null)
  }

  if (!isAdmin) {
    return (
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Scan Attendance</h2>
        <p className="text-gray-600">Only administrators can scan attendance.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Scan Attendance</h2>
      </div>

      {(result || error) && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 flex items-start gap-3 ${
            result?.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}
          role="status"
          aria-live="polite"
        >
          <div
            className={`p-2 rounded-full ${
              result?.success ? 'bg-green-100' : 'bg-red-100'
            }`}
          >
            <Icon
              name={result?.success ? 'check' : 'alert'}
              className={`w-5 h-5 ${result?.success ? 'text-green-700' : 'text-red-700'}`}
            />
          </div>
          <div className="flex-1">
            <p className={`font-medium ${result?.success ? 'text-green-800' : 'text-red-800'}`}>
              {result?.success ? 'Scan Successful' : 'Scan Failed'}
            </p>
            <p className={`text-sm ${result?.success ? 'text-green-700' : 'text-red-700'}`}>
              {result?.message || error}
            </p>
          </div>
          <Button variant="ghost" onClick={clearResult} className="!p-2">
            <Icon name="close" />
          </Button>
        </div>
      )}

      <div className="max-w-lg mx-auto space-y-6">
        {/* Scanner Area */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div
            id="qr-scanner"
            ref={scannerRef}
            className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden"
          />

          <div className="flex gap-2 mt-4">
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

        {/* Manual Input */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Manual Entry</h3>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter employee number"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              disabled={processing}
            />
            <Button type="submit" disabled={processing || !manualInput.trim()}>
              Submit
            </Button>
          </form>
        </div>

        {/* Result Display */}
        {result?.success && result?.data && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-6">
            <div className="mt-0 pt-0 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Teacher</span>
                <span className="font-medium text-green-800">{result.data.teacher.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Type</span>
                <span className="font-medium text-green-800">
                  {result.data.scan_type === 'time_in' ? 'Time In' : 'Time Out'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Status</span>
                <span
                  className={`font-medium ${
                    result.data.status === 'on_time' ? 'text-green-800' : 'text-amber-600'
                  }`}
                >
                  {result.data.status === 'on_time' ? 'On Time' : 'Late'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-green-700">Time</span>
                <span className="font-medium text-green-800">{result.data.scan_time}</span>
              </div>
            </div>
          </div>
        )}

        {processing && (
          <div className="text-center py-4">
            <p className="text-gray-600">Processing scan...</p>
          </div>
        )}
      </div>

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
            <p className="text-sm text-gray-600">No schedules for today. Proceeding will record without a schedule.</p>
          ) : (
            <div className="space-y-2">
              {scheduleOptions.map((opt) => {
                const selected = scheduleSelection === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setScheduleSelection(opt.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded border text-sm ${
                      selected
                        ? 'border-blue-500 bg-blue-50 text-blue-800'
                        : 'border-gray-200 hover:border-blue-200 text-gray-800'
                    }`}
                  >
                    <span>
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
    </section>
  )
}
