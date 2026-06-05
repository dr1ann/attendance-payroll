import dotenv from 'dotenv'
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
  database: process.env.DB_NAME,
}

async function clearData() {
  if (!process.env.DB_NAME) {
    throw new Error('DB_NAME is not set in .env')
  }

  const connection = await mysql.createConnection(config)

  try {
    const [tables] = await connection.query(
      `SELECT table_name AS tableName
       FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [process.env.DB_NAME],
    )

    if (tables.length === 0) {
      console.log(`No tables found in database ${process.env.DB_NAME}`)
      return
    }

    const tableNames = tables.map(({ tableName }) => tableName)

    await connection.query('SET FOREIGN_KEY_CHECKS = 0')

    for (const tableName of tableNames) {
      await connection.query(`TRUNCATE TABLE \`${tableName}\``)
    }

    await connection.query('SET FOREIGN_KEY_CHECKS = 1')

    console.log(`Cleared data from ${tableNames.length} tables in database ${process.env.DB_NAME}`)
  } finally {
    await connection.end()
  }
}

clearData().catch((error) => {
  console.error('Failed to clear database data:', error.message)
  process.exit(1)
})