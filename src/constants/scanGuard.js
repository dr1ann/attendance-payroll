export const SCAN_REPEAT_WINDOW_MS = 2500

export function shouldAcceptScan(employeeNo, scanFlowActive, lastScan, now = Date.now()) {
  if (scanFlowActive) {
    return false
  }

  if (
    lastScan?.value === employeeNo
    && now - lastScan.scannedAt < SCAN_REPEAT_WINDOW_MS
  ) {
    return false
  }

  return true
}
