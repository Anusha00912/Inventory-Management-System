// Turns a result directory into performance-summary.md (and prints it).
//   node perf/summarize.mjs perf/results/<timestamp>
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'

const dir = path.resolve(process.argv[2] || '')
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
const data = read('summary.json')
const meta = fs.existsSync(path.join(dir, 'meta.json')) ? read('meta.json') : null
const resources = fs.existsSync(path.join(dir, 'resources.json')) ? read('resources.json') : []

const WORKFLOWS = ['dashboard', 'product_listing', 'search_products', 'add_product', 'edit_product', 'stock_in', 'stock_out', 'transaction_history', 'reports', 'delete_product']
const mv = (name) => {
  const m = data.metrics[name]
  return m ? (m.values ?? m) : undefined
}
const ms = (n) => (n === undefined || n === null ? '–' : `${n.toFixed(1)} ms`)
const pct = (n) => (n === undefined ? '–' : `${(n * 100).toFixed(2)}%`)
const okOf = (t) => (typeof t === 'boolean' ? t : t?.ok)

// Threshold verdicts (overall + per workflow).
const verdicts = []
for (const [name, m] of Object.entries(data.metrics)) {
  for (const [expr, t] of Object.entries(m.thresholds || {})) verdicts.push({ metric: name, expr, ok: okOf(t) !== false })
}
const failed = verdicts.filter((v) => !v.ok)
const overallPass = failed.length === 0

const dur = mv('http_req_duration')
const reqs = mv('http_reqs')
const fail = mv('http_req_failed')
const checks = mv('checks')
const payload = mv('state_payload_bytes')
const recv = mv('data_received')
const lines = []
const L = (s = '') => lines.push(s)

L(`# Performance summary${meta ? ` — ${meta.startedAt}` : ''}`)
L()
L(`**Result: ${overallPass ? 'PASS ✅' : 'FAIL ❌'}**${failed.length ? ` — ${failed.length} threshold(s) crossed` : ' — all thresholds met'}`)
L()
if (meta) {
  const p = meta.params
  L(`Profile: ${p.vus} VUs · ramp ${p.ramp} · hold ${p.duration} · think time ${p.thinkSec}s · thresholds avg<${p.avgMs}ms, p95<${p.p95Ms}ms, errors<${p.errRate * 100}%`)
  L(`Environment: ${meta.os}, ${meta.cpus} CPUs, Node ${meta.node}, ${meta.k6}, test DB host ${meta.dbHost}. Load generator and server share this machine.`)
  L()
}
L('## Headline')
L('| Metric | Value | Threshold | Status |')
L('|---|---|---|---|')
const st = (metric, expr) => (verdicts.find((v) => v.metric === metric && v.expr === expr)?.ok === false ? '❌' : '✅')
const p0 = meta?.params
L(`| Average response time | ${ms(dur?.avg)} | < ${p0?.avgMs ?? 500} ms | ${st('http_req_duration', `avg<${p0?.avgMs ?? 500}`)} |`)
L(`| P95 response time | ${ms(dur?.['p(95)'])} | < ${p0?.p95Ms ?? 1000} ms | ${st('http_req_duration', `p(95)<${p0?.p95Ms ?? 1000}`)} |`)
L(`| P99 / max | ${ms(dur?.['p(99)'])} / ${ms(dur?.max)} | – | – |`)
L(`| Requests per second | ${reqs ? reqs.rate.toFixed(2) : '–'} (${reqs?.count ?? '–'} requests) | – | – |`)
L(`| Error rate (failed requests) | ${pct(fail?.rate ?? fail?.value)} | < ${(p0?.errRate ?? 0.01) * 100}% | ${st('http_req_failed', `rate<${p0?.errRate ?? 0.01}`)} |`)
L(`| Functional checks passed | ${pct(checks?.rate ?? checks?.value)} | > 99% | ${st('checks', 'rate>0.99')} |`)
L()

L('## Per workflow')
L('| Workflow | Requests | Avg | P95 | Max | Errors | Status |')
L('|---|---|---|---|---|---|---|')
const rows = []
for (const w of WORKFLOWS) {
  const d = mv(`http_req_duration{workflow:${w}}`)
  const f = mv(`http_req_failed{workflow:${w}}`)
  if (!d) continue
  const bad = verdicts.some((v) => v.metric.includes(`workflow:${w}}`) && !v.ok)
  rows.push({ w, avg: d.avg, p95: d['p(95)'], max: d.max })
  L(`| ${w} | ${f?.passes !== undefined ? f.passes + f.fails : '–'} | ${ms(d.avg)} | ${ms(d['p(95)'])} | ${ms(d.max)} | ${pct(f?.rate ?? f?.value)} | ${bad ? '❌' : '✅'} |`)
}
L()
if (failed.length) {
  L('### Thresholds crossed')
  for (const v of failed) L(`- \`${v.metric}\` ${v.expr}`)
  L()
}

// Latency over time (per minute) from the raw JSON stream: reveals degradation during the hold.
const perMinute = new Map()
const rl = readline.createInterface({ input: fs.createReadStream(path.join(dir, 'results.json')) })
for await (const line of rl) {
  if (!line.includes('"http_req_duration"') || !line.includes('"type":"Point"')) continue
  const o = JSON.parse(line)
  if (o.metric !== 'http_req_duration') continue
  const minute = o.data.time.slice(0, 16)
  if (!perMinute.has(minute)) perMinute.set(minute, [])
  perMinute.get(minute).push(o.data.value)
}
const q = (arr, p) => arr.sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))]
const timeline = [...perMinute.entries()].sort().map(([t, v]) => ({ t, n: v.length, avg: v.reduce((a, b) => a + b, 0) / v.length, p95: q(v, 0.95) }))
if (timeline.length) {
  L('## Latency over time')
  L('| Minute (UTC) | Requests | Avg | P95 |')
  L('|---|---|---|---|')
  for (const r of timeline) L(`| ${r.t.slice(11)} | ${r.n} | ${ms(r.avg)} | ${ms(r.p95)} |`)
  L()
}

// Data volume + server resources.
L('## Data and resources')
if (meta) L(`- Data before → after: ${JSON.stringify(meta.dataBefore)} → ${JSON.stringify(meta.dataAfter)} (each iteration cleans up after itself; a drift means leftovers)`)
if (payload) L(`- \`GET /api/state\` payload: avg ${(payload.avg / 1024).toFixed(1)} KB, max ${(payload.max / 1024).toFixed(1)} KB. Every mutation returns the same full state.`)
const avgBytes = recv && reqs ? recv.count / reqs.count : undefined
if (avgBytes) L(`- Average response size across all requests: ${(avgBytes / 1024).toFixed(1)} KB`)
if (resources.length) {
  const cpu = resources.map((r) => r.cpuPct), mem = resources.map((r) => r.rssMB)
  L(`- App server process: CPU avg ${(cpu.reduce((a, b) => a + b, 0) / cpu.length).toFixed(0)}% / peak ${Math.max(...cpu).toFixed(0)}% of one core; memory peak ${Math.max(...mem).toFixed(0)} MB`)
}
L()

// Automatic observations (starting points for the bottleneck analysis, not conclusions).
L('## Observations')
if (rows.length) {
  const slow = [...rows].sort((a, b) => b.p95 - a.p95)
  L(`- Slowest by P95: ${slow.slice(0, 3).map((r) => `${r.w} (${ms(r.p95)})`).join(', ')}; fastest: ${slow.at(-1).w} (${ms(slow.at(-1).p95)}).`)
  const writes = rows.filter((r) => ['add_product', 'edit_product', 'stock_in', 'stock_out', 'delete_product'].includes(r.w))
  const reads = rows.filter((r) => !writes.includes(r))
  const mean = (a) => a.reduce((s, r) => s + r.avg, 0) / (a.length || 1)
  if (writes.length && reads.length) L(`- Writes average ${ms(mean(writes))} vs reads ${ms(mean(reads))} (${(mean(writes) / mean(reads)).toFixed(1)}x).`)
}
if (timeline.length >= 3) {
  const mid = timeline.slice(1, -1)
  L(`- First vs last full minute: avg ${ms(mid[0].avg)} → ${ms(mid.at(-1).avg)}${mid.at(-1).avg > mid[0].avg * 1.3 ? ' — latency is climbing under sustained load (queueing/saturation)' : ' — stable'}.`)
}
if (resources.length) {
  const c = resources.map((r) => r.cpuPct)
  const avgC = c.reduce((a, b) => a + b, 0) / c.length
  L(avgC > 80 ? '- The Node process is near one full core: CPU-bound (single-threaded event loop).' : `- The Node process averaged only ${avgC.toFixed(0)}% of a core: time is going to waiting (database round-trips / network), not CPU.`)
}
const fcheck = Object.entries(data.metrics).filter(([k]) => k === 'checks')
if (fcheck.length && (checks?.fails ?? 0) > 0) L(`- ${checks.fails} functional check(s) failed — correctness problems under load, not only latency.`)
L()

if (meta) {
  const prev = fs.readdirSync(path.dirname(dir)).filter((d) => d < path.basename(dir) && fs.existsSync(path.join(path.dirname(dir), d, 'summary.json'))).sort().at(-1)
  if (prev) {
    const pd = JSON.parse(fs.readFileSync(path.join(path.dirname(dir), prev, 'summary.json'), 'utf8')).metrics
    const g = (m, k) => (pd[m]?.values ?? pd[m])?.[k]
    const pr = g('http_req_duration', 'avg'), pp = g('http_req_duration', 'p(95)'), prr = g('http_reqs', 'rate')
    L(`## Change since previous run (${prev})`)
    L(`- Avg ${ms(pr)} → ${ms(dur?.avg)}; P95 ${ms(pp)} → ${ms(dur?.['p(95)'])}; req/s ${prr?.toFixed(2)} → ${reqs?.rate.toFixed(2)}`)
    L()
  }
}

const out = lines.join('\n')
fs.writeFileSync(path.join(dir, 'performance-summary.md'), out)
console.log('\n' + out)
