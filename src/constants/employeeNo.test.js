import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EMPLOYEE_NO_HELP_TEXT,
  EMPLOYEE_NO_MAX_LENGTH,
  validateEmployeeNo,
} from './employeeNo.js'

test('validateEmployeeNo accepts and trims a valid employee number', () => {
  assert.deepEqual(validateEmployeeNo('  TCHR-001_A  '), {
    value: 'TCHR-001_A',
    error: '',
  })
})

test('validateEmployeeNo rejects missing employee numbers', () => {
  assert.deepEqual(validateEmployeeNo('   '), {
    value: '',
    error: 'Employee number is required',
  })

  assert.deepEqual(validateEmployeeNo(null), {
    value: '',
    error: 'Employee number is required',
  })
})

test('validateEmployeeNo rejects employee numbers that are too long', () => {
  const employeeNo = 'A'.repeat(EMPLOYEE_NO_MAX_LENGTH + 1)

  assert.deepEqual(validateEmployeeNo(employeeNo), {
    value: employeeNo,
    error: `Employee number must be ${EMPLOYEE_NO_MAX_LENGTH} characters or fewer`,
  })
})

test('validateEmployeeNo rejects unsupported characters', () => {
  assert.deepEqual(validateEmployeeNo('TCHR 001'), {
    value: 'TCHR 001',
    error: EMPLOYEE_NO_HELP_TEXT,
  })

  assert.deepEqual(validateEmployeeNo('TCHR/001'), {
    value: 'TCHR/001',
    error: EMPLOYEE_NO_HELP_TEXT,
  })
})
