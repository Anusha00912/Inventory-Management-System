// Loads the e2e-only environment and enforces the isolation guard.
// The suite must NEVER touch the application's own database.
import fs from 'node:fs'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const ROOT = path.resolve(__dirname, '../../..')

// Identity of a database = host (minus Neon's "-pooler" suffix) + database name.
function dbIdentity(url) {
  const u = new URL(url)
  return `${u.hostname.replace('-pooler', '').toLowerCase()}${u.pathname}`
}

// Every place the app could get its own DB URL from. Extend if the app reads other files.
function appDatabaseUrls() {
  const urls = []
  if (process.env.DATABASE_URL) urls.push(process.env.DATABASE_URL)
  const appEnv = path.join(ROOT, '.env')
  if (fs.existsSync(appEnv)) {
    const parsed = parseEnv(fs.readFileSync(appEnv, 'utf8'))
    if (parsed.DATABASE_URL) urls.push(parsed.DATABASE_URL)
  }
  return urls
}

export function loadE2eEnv() {
  const file = path.join(ROOT, '.env.e2e')
  if (!fs.existsSync(file)) {
    throw new Error(
      'Missing .env.e2e. Create it with E2E_DATABASE_URL=<a database dedicated to tests> ' +
        '(see .env.e2e.example). Never reuse the application database.'
    )
  }
  const parsed = parseEnv(fs.readFileSync(file, 'utf8'))
  const databaseUrl = parsed.E2E_DATABASE_URL
  if (!databaseUrl) throw new Error('.env.e2e must define E2E_DATABASE_URL')

  const identity = dbIdentity(databaseUrl)
  for (const appUrl of appDatabaseUrls()) {
    if (dbIdentity(appUrl) === identity) {
      throw new Error(
        `Refusing to run: E2E_DATABASE_URL points at the same database as the application's DATABASE_URL (${identity}). ` +
          'Create a separate database or Neon branch for e2e tests.'
      )
    }
  }

  const port = Number(parsed.E2E_PORT || 3100)
  return {
    databaseUrl,
    port,
    baseURL: `http://localhost:${port}`,
    // Env passed to the app server under test; overrides anything in the app's .env
    // (process.loadEnvFile never overwrites variables that are already set).
    serverEnv: {
      DATABASE_URL: databaseUrl,
      PORT: String(port),
      NODE_ENV: 'production',
      ALLOW_RESET: 'true', // the e2e suite resets its own test database
    },
  }
}
