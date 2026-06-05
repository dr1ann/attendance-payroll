import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '..', '..', '.env')

dotenv.config({ path: envPath })

const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
}

const dbName = process.env.DB_NAME
const adminUsername = process.env.ADMIN_USERNAME
const adminPassword = process.env.ADMIN_PASSWORD

async function init() {
  const connection = await mysql.createConnection(config)

  await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`)
  await connection.query(`USE ${dbName}`)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'salary_viewer', 'teacher') NOT NULL DEFAULT 'admin',
      teacher_id INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Ensure existing table has teacher role and teacher_id column
  await connection.query(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('admin', 'salary_viewer', 'teacher') NOT NULL DEFAULT 'admin'
  `)

  const [cols] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'teacher_id'
  `, [dbName])

  if (cols.length === 0) {
    await connection.query(`
      ALTER TABLE users ADD COLUMN teacher_id INT NULL
    `)
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      employee_no VARCHAR(50) NOT NULL UNIQUE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      department VARCHAR(100) NOT NULL,
      teacher_type ENUM('full_time', 'part_time') NOT NULL DEFAULT 'full_time',
      monthly_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
      session_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL UNIQUE,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  const [teacherTypeCols] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'teacher_type'`,
    [dbName],
  )

  if (teacherTypeCols.length === 0) {
    await connection.query(`
      ALTER TABLE teachers
      ADD COLUMN teacher_type ENUM('full_time', 'part_time') NOT NULL DEFAULT 'full_time'
      AFTER department
    `)
  }

  const [monthlySalaryCols] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'monthly_salary'`,
    [dbName],
  )

  if (monthlySalaryCols.length === 0) {
    await connection.query(`
      ALTER TABLE teachers
      ADD COLUMN monthly_salary DECIMAL(10,2) NOT NULL DEFAULT 0
      AFTER teacher_type
    `)
  }

  const [sessionRateCols] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'teachers' AND COLUMN_NAME = 'session_rate'`,
    [dbName],
  )

  if (sessionRateCols.length === 0) {
    await connection.query(`
      ALTER TABLE teachers
      ADD COLUMN session_rate DECIMAL(10,2) NOT NULL DEFAULT 0
      AFTER monthly_salary
    `)
  }

  await connection.query(`
    ALTER TABLE teachers
    MODIFY COLUMN teacher_type ENUM('full_time', 'part_time') NOT NULL DEFAULT 'full_time'
  `)

  await connection.query(`
    INSERT IGNORE INTO departments (name)
    SELECT DISTINCT TRIM(department)
    FROM teachers
    WHERE department IS NOT NULL AND TRIM(department) <> ''
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INT PRIMARY KEY AUTO_INCREMENT,
      teacher_id INT NOT NULL,
      day_of_week TINYINT NULL,
      time_start TIME NOT NULL,
      time_end TIME NOT NULL,
      subject VARCHAR(150) NULL,
      CONSTRAINT fk_schedules_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        ON DELETE CASCADE
    )
  `)

  await connection.query(`
    ALTER TABLE schedules
    MODIFY COLUMN day_of_week TINYINT NULL
  `)

  const [scheduleSubjectCols] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schedules' AND COLUMN_NAME = 'subject'`,
    [dbName],
  )

  if (scheduleSubjectCols.length === 0) {
    await connection.query(`
      ALTER TABLE schedules
      ADD COLUMN subject VARCHAR(150) NULL
      AFTER time_end
    `)
  }

  await connection.query(`
    DELETE s FROM schedules s
    JOIN teachers t ON t.id = s.teacher_id
    JOIN schedules keep_schedule
      ON keep_schedule.teacher_id = s.teacher_id
      AND keep_schedule.id < s.id
    WHERE t.teacher_type = 'full_time'
  `)

  await connection.query(`
    UPDATE schedules s
    JOIN teachers t ON t.id = s.teacher_id
    SET s.day_of_week = NULL,
        s.subject = NULL
    WHERE t.teacher_type = 'full_time'
  `)

  const [scheduleGraceCols] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'schedules' AND COLUMN_NAME = 'grace_minutes'`,
    [dbName],
  )

  if (scheduleGraceCols.length > 0) {
    await connection.query('ALTER TABLE schedules DROP COLUMN grace_minutes')
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance_settings (
      id INT PRIMARY KEY,
      late_grace_minutes INT NOT NULL DEFAULT 15,
      duplicate_scan_window_seconds INT NOT NULL DEFAULT 30,
      late_deduction_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      absence_deduction_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila'
    )
  `)

  const [duplicateWindowSecondsCols] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_settings' AND COLUMN_NAME = 'duplicate_scan_window_seconds'`,
    [dbName],
  )

  if (duplicateWindowSecondsCols.length === 0) {
    await connection.query(`
      ALTER TABLE attendance_settings
      ADD COLUMN duplicate_scan_window_seconds INT NOT NULL DEFAULT 30
      AFTER late_grace_minutes
    `)

    const [duplicateWindowMinutesCols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_settings' AND COLUMN_NAME = 'duplicate_scan_window_minutes'`,
      [dbName],
    )

    if (duplicateWindowMinutesCols.length > 0) {
      await connection.query(`
        UPDATE attendance_settings
        SET duplicate_scan_window_seconds =
          CASE
            WHEN duplicate_scan_window_minutes = 5 THEN 30
            ELSE duplicate_scan_window_minutes * 60
          END
      `)
    }
  }

  const [lateDeductionCols] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_settings' AND COLUMN_NAME = 'late_deduction_amount'`,
    [dbName],
  )

  if (lateDeductionCols.length === 0) {
    await connection.query(`
      ALTER TABLE attendance_settings
      ADD COLUMN late_deduction_amount DECIMAL(10,2) NOT NULL DEFAULT 0
      AFTER duplicate_scan_window_seconds
    `)
  }

  const [absenceDeductionCols] = await connection.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'attendance_settings' AND COLUMN_NAME = 'absence_deduction_amount'`,
    [dbName],
  )

  if (absenceDeductionCols.length === 0) {
    await connection.query(`
      ALTER TABLE attendance_settings
      ADD COLUMN absence_deduction_amount DECIMAL(10,2) NOT NULL DEFAULT 0
      AFTER late_deduction_amount
    `)
  }

  await connection.query(
    `INSERT IGNORE INTO attendance_settings (
      id,
      late_grace_minutes,
      duplicate_scan_window_seconds,
      late_deduction_amount,
      absence_deduction_amount,
      timezone
    )
     VALUES (1, 15, 30, 0, 0, 'Asia/Manila')`,
  )

  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT PRIMARY KEY AUTO_INCREMENT,
      teacher_id INT NOT NULL,
      schedule_id INT,
      scan_time DATETIME NOT NULL,
      scan_type ENUM('time_in', 'time_out') NOT NULL,
      status ENUM('on_time', 'late') NOT NULL DEFAULT 'on_time',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_attendance_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_attendance_schedule
        FOREIGN KEY (schedule_id) REFERENCES schedules(id)
        ON DELETE SET NULL
    )
  `)

  const passwordHash = await bcrypt.hash(adminPassword, 10)
  await connection.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, 'admin')
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       role = 'admin',
       teacher_id = NULL`,
    [adminUsername, passwordHash],
  )

  await connection.end()

  console.log('Database initialized successfully')
  console.log(`Admin user: ${adminUsername}`)
}

init().catch((error) => {
  console.error('Failed to initialize database:', error.message)
  process.exit(1)
})
