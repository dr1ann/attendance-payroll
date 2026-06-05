export const QR_CODE_OPTIONS = {
  margin: 4,
  scale: 10,
  errorCorrectionLevel: 'M',
}

export function getScannerQrBox(viewfinderWidth, viewfinderHeight) {
  const minEdge = Math.min(viewfinderWidth, viewfinderHeight)
  const size = Math.min(minEdge, Math.max(120, Math.floor(minEdge * 0.78)))

  return {
    width: size,
    height: size,
  }
}

export function getEmployeeNoFromQr(decodedText) {
  const value = typeof decodedText === 'string' ? decodedText.trim() : ''

  if (!value) {
    return ''
  }

  try {
    const url = new URL(value)
    return (
      url.searchParams.get('employee_no')
      || url.searchParams.get('employeeNo')
      || url.searchParams.get('employee')
      || url.pathname.split('/').filter(Boolean).pop()
      || value
    ).trim()
  } catch {
    return value
  }
}
