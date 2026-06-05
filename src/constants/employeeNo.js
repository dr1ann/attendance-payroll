export const EMPLOYEE_NO_MAX_LENGTH = 20
export const EMPLOYEE_NO_ALLOWED_PATTERN = /^[A-Za-z0-9_-]+$/
export const EMPLOYEE_NO_HELP_TEXT = 'Use letters, numbers, hyphen, or underscore only.'

export function validateEmployeeNo(rawValue) {
  if (typeof rawValue !== 'string') {
    return { value: '', error: 'Employee number is required' }
  }

  const value = rawValue.trim()

  if (!value) {
    return { value, error: 'Employee number is required' }
  }

  if (value.length > EMPLOYEE_NO_MAX_LENGTH) {
    return { value, error: `Employee number must be ${EMPLOYEE_NO_MAX_LENGTH} characters or fewer` }
  }

  if (!EMPLOYEE_NO_ALLOWED_PATTERN.test(value)) {
    return { value, error: EMPLOYEE_NO_HELP_TEXT }
  }

  return { value, error: '' }
}
