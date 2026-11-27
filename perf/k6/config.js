// Load profile + threshold configuration. Every value can be overridden with an env var
// (the runner, perf/run.mjs, passes them through from its CLI flags).
const num = (k, d) => (__ENV[k] !== undefined && __ENV[k] !== '' ? Number(__ENV[k]) : d)
const str = (k, d) => (__ENV[k] !== undefined && __ENV[k] !== '' ? __ENV[k] : d)

export const PROFILE = {
  vus: num('VUS', 50), // concurrent users
  ramp: str('RAMP', '30s'), // ramp-up from 0 to vus
  duration: str('DURATION', '4m30s'), // time held at full load after the 30s ramp (5m total)
  thinkSec: num('THINK_SEC', 2), // pause after every workflow step
  avgMs: num('THRESH_AVG_MS', 500), // average response time must be below
  p95Ms: num('THRESH_P95_MS', 1000), // 95th percentile must be below
  errRate: num('THRESH_ERR_RATE', 0.01), // failed-request rate must be below (0.01 = 1%)
}

// One entry per business workflow; each request is tagged with it so results are reported per workflow.
export const WORKFLOWS = [
  'dashboard',
  'product_listing',
  'search_products',
  'add_product',
  'edit_product',
  'stock_in',
  'stock_out',
  'transaction_history',
  'reports',
  'delete_product',
]

export const scenarios = {
  load: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [
      { duration: PROFILE.ramp, target: PROFILE.vus },
      { duration: PROFILE.duration, target: PROFILE.vus },
    ],
    gracefulRampDown: '0s',
    // A full journey is ~10 think-times long; let in-flight iterations finish so they clean up their data.
    gracefulStop: '60s',
  },
}

export function buildThresholds(p = PROFILE) {
  const latency = [`avg<${p.avgMs}`, `p(95)<${p.p95Ms}`]
  const errors = [`rate<${p.errRate}`]
  const t = {
    // Overall benchmark
    http_req_duration: latency,
    http_req_failed: errors,
    checks: ['rate>0.99'], // functional correctness under load
  }
  // Same limits per workflow, so a failure points at the workflow that regressed.
  for (const w of WORKFLOWS) {
    t[`http_req_duration{workflow:${w}}`] = latency
    t[`http_req_failed{workflow:${w}}`] = errors
  }
  return t
}
