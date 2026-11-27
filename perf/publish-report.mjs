// Copies a finished run's shareable files into perf/reports/<run>/ so they can be committed to git.
//   node perf/publish-report.mjs [perf/results/<run>]     (default: the latest run)
// Copies report.html, summary.json and performance-summary.md. Skips results.json (several MB per run),
// server.log and meta.json, and redacts database host names.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resultsDir = path.join(ROOT, 'perf', 'results')

const runs = fs.existsSync(resultsDir) ? fs.readdirSync(resultsDir).filter((d) => fs.existsSync(path.join(resultsDir, d, 'summary.json'))).sort() : []
const src = process.argv[2] ? path.resolve(process.argv[2]) : runs.length ? path.join(resultsDir, runs.at(-1)) : null
if (!src || !fs.existsSync(path.join(src, 'summary.json'))) {
  console.error('No finished run found. Run `npm run perf` first.')
  process.exit(1)
}

const dest = path.join(ROOT, 'perf', 'reports', path.basename(src))
fs.mkdirSync(dest, { recursive: true })

const redact = (text) => text.replace(/ep-[a-z0-9-]+(\.[a-z0-9-]+)*\.neon\.tech/gi, '<neon-test-branch-host>')
for (const f of ['report.html', 'summary.json', 'performance-summary.md']) {
  const from = path.join(src, f)
  if (fs.existsSync(from)) fs.writeFileSync(path.join(dest, f), redact(fs.readFileSync(from, 'utf8')))
}
console.log(`Published to ${dest}\nReview it, then: git add perf/reports && git commit && git push`)
