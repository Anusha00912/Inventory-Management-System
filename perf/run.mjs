// Runs the k6 load suite against the production build of the app, wired to a DEDICATED perf database.
//   node perf/run.mjs                       -> 50 VUs, 30s ramp + 4m30s hold (5m total), 2s think, avg<500 p95<1000 err<1%
//   node perf/run.mjs --local               -> use a throwaway embedded Postgres (no .env.perf needed)
//   node perf/run.mjs --vus 100 --duration 2m --p95 800
//   node perf/run.mjs --smoke               -> tiny run to validate the scripts (2 VUs, ~25s)
// Output: perf/results/<timestamp>/{report.html,results.json,summary.json,performance-summary.md,...}
import { spawn, execFileSync, execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseEnv } from 'node:util'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// ---------- parameters ----------
const argv = process.argv.slice(2)
const flag = (n) => argv.includes(`--${n}`)
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`)
  return i >= 0 ? argv[i + 1] : d
}
const smoke = flag('smoke')
const params = {
  vus: Number(opt('vus', smoke ? 2 : 50)),
  ramp: opt('ramp', smoke ? '5s' : '30s'),
  duration: opt('duration', smoke ? '20s' : '4m30s'), // hold after the ramp
  thinkSec: Number(opt('think', smoke ? 0.5 : 2)),
  avgMs: Number(opt('avg', 500)),
  p95Ms: Number(opt('p95', 1000)),
  errRate: Number(opt('err', 0.01)),
}

// ---------- isolation guard (same rule as the e2e suite) ----------
const identity = (url) => {
  const u = new URL(url)
  return `${u.hostname.replace('-pooler', '').toLowerCase()}${u.pathname}`
}
function appDatabaseUrls() {
  const urls = []
  if (process.env.DATABASE_URL) urls.push(process.env.DATABASE_URL)
  const f = path.join(ROOT, '.env')
  if (fs.existsSync(f)) {
    const p = parseEnv(fs.readFileSync(f, 'utf8'))
    if (p.DATABASE_URL) urls.push(p.DATABASE_URL)
  }
  return urls
}
function assertNotAppDatabase(url) {
  const id = identity(url)
  for (const a of appDatabaseUrls()) {
    if (identity(a) === id) throw new Error(`Refusing to run: the perf database is the application's own database (${id}). Use a separate database or Neon branch.`)
  }
}
function loadPerfEnv() {
  const f = path.join(ROOT, '.env.perf')
  if (!fs.existsSync(f)) throw new Error('Missing .env.perf (PERF_DATABASE_URL=<dedicated test database>), or pass --local. See .env.perf.example.')
  const p = parseEnv(fs.readFileSync(f, 'utf8'))
  if (!p.PERF_DATABASE_URL) throw new Error('.env.perf must define PERF_DATABASE_URL')
  assertNotAppDatabase(p.PERF_DATABASE_URL)
  return { databaseUrl: p.PERF_DATABASE_URL, port: Number(p.PERF_PORT || 3200), dbHost: new URL(p.PERF_DATABASE_URL).hostname }
}

// --local: a throwaway Postgres (same major version as Neon) in a temp dir, destroyed after the run.
async function startLocalDb() {
  const { default: EmbeddedPostgres } = await import('embedded-postgres')
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-perf-pg-'))
  const dbPort = 54329
  const pg = new EmbeddedPostgres({
    databaseDir: dir, user: 'perf', password: 'perf', port: dbPort, persistent: false,
    autoRehydrateSymlinks: true, onLog: () => {}, onError: () => {},
  })
  await pg.initialise()
  await pg.start()
  await pg.createDatabase('inventory_perf')
  const databaseUrl = `postgresql://perf:perf@localhost:${dbPort}/inventory_perf`
  assertNotAppDatabase(databaseUrl)
  return {
    databaseUrl, port: 3200, dbHost: 'localhost (embedded Postgres 18.7, throwaway)',
    stop: async () => { await pg.stop().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }) },
  }
}

// ---------- k6 binary ----------
function findK6() {
  const candidates = [process.env.K6_BIN, 'k6', 'C:/Program Files/k6/k6.exe', 'C:/Program Files/k6/bin/k6.exe'].filter(Boolean)
  for (const c of candidates) {
    try {
      const v = execFileSync(c, ['version'], { encoding: 'utf8' }).trim()
      return { bin: c, version: v }
    } catch { /* try next */ }
  }
  throw new Error('k6 not found. Install it (winget install k6 / brew install k6) or set K6_BIN.')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function main() {
  const k6 = findK6()
  const env = flag('local') ? await startLocalDb() : loadPerfEnv()
  const stopDb = async () => { if (env.stop) await env.stop() }
  const baseURL = `http://localhost:${env.port}`
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const resultDir = path.join(ROOT, 'perf', 'results', stamp)
  fs.mkdirSync(resultDir, { recursive: true })

  console.log(`\nk6 load test -> ${baseURL}  (test DB host: ${env.dbHost})`)
  console.log(`params: ${JSON.stringify(params)}\nresults: ${resultDir}\n`)

  if (!flag('no-build')) execSync('npm run build', { cwd: ROOT, stdio: 'ignore', shell: true })

  // Server under test: production build, pointed at the PERF database on its own port.
  const log = fs.openSync(path.join(resultDir, 'server.log'), 'w')
  const server = spawn(process.execPath, ['server/index.js', '--prod'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: env.databaseUrl, PORT: String(env.port), NODE_ENV: 'production', ALLOW_RESET: 'true' },
    stdio: ['ignore', log, log],
  })
  let serverExited = false
  server.on('exit', () => (serverExited = true))

  const stopServer = () => { if (!serverExited) server.kill() }
  process.on('SIGINT', async () => { stopServer(); await stopDb(); process.exit(130) })

  try {
    let ready = false
    for (let i = 0; i < 60 && !ready && !serverExited; i++) {
      try { ready = (await fetch(`${baseURL}/api/state`)).ok } catch { await sleep(1000) }
    }
    if (!ready) throw new Error(`Server did not become ready; see ${path.join(resultDir, 'server.log')}`)

    // Known baseline: reset (wipe + seed) the TEST database through the app.
    const reset = await fetch(`${baseURL}/api/reset`, { method: 'POST' })
    if (!reset.ok) throw new Error(`reset failed: ${reset.status}`)
    const before = await (await fetch(`${baseURL}/api/state`)).json()

    // Best-effort resource sampling of the server process.
    const samples = []
    let lastCpu = null
    const sampler = setInterval(async () => {
      try {
        const s = await sampleProcess(server.pid)
        if (lastCpu) samples.push({ t: Date.now(), cpuPct: ((s.cpuSec - lastCpu.cpuSec) / ((s.t - lastCpu.t) / 1000)) * 100, rssMB: s.rssMB })
        lastCpu = s
      } catch { /* sampling is optional */ }
    }, 5000)

    const k6env = {
      ...process.env,
      BASE_URL: baseURL,
      RESULT_DIR: resultDir.replace(/\\/g, '/'),
      VUS: String(params.vus), RAMP: params.ramp, DURATION: params.duration, THINK_SEC: String(params.thinkSec),
      THRESH_AVG_MS: String(params.avgMs), THRESH_P95_MS: String(params.p95Ms), THRESH_ERR_RATE: String(params.errRate),
      // k6's built-in web dashboard exports a self-contained HTML report at the end of the run.
      K6_WEB_DASHBOARD: 'true',
      K6_WEB_DASHBOARD_PORT: '-1',
      K6_WEB_DASHBOARD_EXPORT: path.join(resultDir, 'report.html'),
    }
    const started = new Date()
    const k6Exit = await new Promise((resolve) => {
      const p = spawn(k6.bin, ['run', '--out', `json=${path.join(resultDir, 'results.json')}`, path.join(ROOT, 'perf', 'k6', 'load.test.js')], {
        cwd: ROOT, env: k6env, stdio: 'inherit',
      })
      p.on('exit', (code) => resolve(code ?? 1))
    })
    clearInterval(sampler)

    const afterRes = await fetch(`${baseURL}/api/state`)
    const afterText = await afterRes.text()
    const after = JSON.parse(afterText)
    const counts = (s) => ({ products: s.products.length, purchases: s.purchases.length, sales: s.sales.length, movements: s.movements.length })

    fs.writeFileSync(path.join(resultDir, 'meta.json'), JSON.stringify({
      params, k6: k6.version, node: process.version, os: `${os.type()} ${os.release()}`, cpus: os.cpus().length,
      dbHost: env.dbHost, startedAt: started.toISOString(), finishedAt: new Date().toISOString(),
      k6ExitCode: k6Exit, dataBefore: counts(before), dataAfter: counts(after), finalStatePayloadBytes: Buffer.byteLength(afterText),
    }, null, 2))
    fs.writeFileSync(path.join(resultDir, 'resources.json'), JSON.stringify(samples, null, 2))

    stopServer()
    execFileSync(process.execPath, [path.join(ROOT, 'perf', 'summarize.mjs'), resultDir], { stdio: 'inherit' })
    console.log(`\nHTML report : ${path.join(resultDir, 'report.html')}`)
    console.log(`JSON results: ${path.join(resultDir, 'results.json')}  (summary: summary.json)`)
    process.exitCode = k6Exit // 0 = all thresholds passed, 99 = a threshold failed
  } finally {
    stopServer()
    await stopDb()
  }
}

// CPU seconds + RSS of a process (best effort, per platform).
function sampleProcess(pid) {
  return new Promise((resolve, reject) => {
    const t = Date.now()
    if (process.platform === 'win32') {
      const cmd = `$p=Get-Process -Id ${pid}; "$($p.CPU) $($p.WorkingSet64)"`
      spawn('powershell', ['-NoProfile', '-Command', cmd]).stdout.once('data', (d) => {
        const [cpu, ws] = String(d).trim().split(/\s+/).map(Number)
        Number.isFinite(cpu) ? resolve({ t, cpuSec: cpu, rssMB: ws / 1048576 }) : reject(new Error('parse'))
      }).on('error', reject)
    } else {
      spawn('ps', ['-o', 'cputimes=,rss=', '-p', String(pid)]).stdout.once('data', (d) => {
        const [cpu, rss] = String(d).trim().split(/\s+/).map(Number)
        Number.isFinite(cpu) ? resolve({ t, cpuSec: cpu, rssMB: rss / 1024 }) : reject(new Error('parse'))
      }).on('error', reject)
    }
  })
}

main().catch((e) => {
  console.error(`\n${e.message}`)
  process.exit(2)
})
