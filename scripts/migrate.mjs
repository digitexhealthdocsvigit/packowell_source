import { createClient } from '@libsql/client'
import { readFileSync } from 'node:fs'

const url = process.env.DATABASE_URL || process.argv[2]
const authToken = process.env.LIBSQL_AUTH_TOKEN || process.argv[3]

if (!url) {
  console.error('Error: Turso database URL is required.')
  console.error('Usage: bun scripts/migrate.mjs "<DATABASE_URL>" "<AUTH_TOKEN>"')
  process.exit(1)
}

try {
  console.log(`Connecting to Turso database: ${url}...`)
  const client = createClient({ url, authToken })

  let sql = readFileSync('migration.sql', 'utf8')
  // Strip UTF-8 Byte Order Mark (BOM) if present
  if (sql.charCodeAt(0) === 0xfeff) {
    sql = sql.slice(1)
  }
  sql = sql.trim()
  console.log('Executing migration.sql...')
  await client.executeMultiple(sql)

  console.log('✅ Migration executed successfully!\n')

  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream_%' ORDER BY name ASC",
  )
  console.log(`Provisioned tables (${result.rows.length}):`)
  for (const row of result.rows) {
    console.log(`  - ${row.name}`)
  }
} catch (error) {
  console.error('❌ Migration failed:', error)
  process.exit(1)
}
