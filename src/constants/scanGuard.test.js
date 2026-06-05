import test from 'node:test'
import assert from 'node:assert/strict'
import { SCAN_REPEAT_WINDOW_MS, shouldAcceptScan } from './scanGuard.js'

test('shouldAcceptScan accepts a new scan when no scan flow is active', () => {
  const accepted = shouldAcceptScan(
    'TCHR-001',
    false,
    { value: 'TCHR-002', scannedAt: 1000 },
    1200,
  )

  assert.equal(accepted, true)
})

test('shouldAcceptScan rejects scans while another scan flow is active', () => {
  const accepted = shouldAcceptScan(
    'TCHR-001',
    true,
    { value: 'TCHR-002', scannedAt: 1000 },
    1200,
  )

  assert.equal(accepted, false)
})

test('shouldAcceptScan rejects the same employee number inside the repeat window', () => {
  const accepted = shouldAcceptScan(
    'TCHR-001',
    false,
    { value: 'TCHR-001', scannedAt: 1000 },
    1000 + SCAN_REPEAT_WINDOW_MS - 1,
  )

  assert.equal(accepted, false)
})

test('shouldAcceptScan accepts the same employee number after the repeat window', () => {
  const accepted = shouldAcceptScan(
    'TCHR-001',
    false,
    { value: 'TCHR-001', scannedAt: 1000 },
    1000 + SCAN_REPEAT_WINDOW_MS,
  )

  assert.equal(accepted, true)
})
