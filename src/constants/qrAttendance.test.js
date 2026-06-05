import test from 'node:test'
import assert from 'node:assert/strict'
import { getEmployeeNoFromQr, getScannerQrBox } from './qrAttendance.js'

test('getEmployeeNoFromQr trims plain employee numbers', () => {
  assert.equal(getEmployeeNoFromQr('  TCHR-001  '), 'TCHR-001')
})

test('getEmployeeNoFromQr reads employee number from URL query params', () => {
  assert.equal(
    getEmployeeNoFromQr('https://example.test/scan?employee_no=TCHR-002'),
    'TCHR-002',
  )
})

test('getEmployeeNoFromQr falls back to the final URL path segment', () => {
  assert.equal(getEmployeeNoFromQr('https://example.test/teachers/TCHR-003'), 'TCHR-003')
})

test('getScannerQrBox sizes the scan box inside the camera viewport', () => {
  assert.deepEqual(getScannerQrBox(300, 400), {
    width: 234,
    height: 234,
  })

  assert.deepEqual(getScannerQrBox(100, 120), {
    width: 100,
    height: 100,
  })
})
