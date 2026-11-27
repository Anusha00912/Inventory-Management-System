// Builds docs/Inventory-Management-System-Capstone.pptx  (run: node build.mjs)
import pptxgen from 'pptxgenjs'

const NAVY = '1E293B', BLUE = '3B82F6', LIGHT = 'F4F6F9', GREY = '64748B', RED = 'DC2626', GREEN = '059669'
const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 in
pptx.title = 'Inventory Management System - Capstone'

const slides = [
  { t: 'Business Problem', b: [
    'Small businesses track stock in spreadsheets, so counts drift and nobody knows why',
    'No audit trail: "where did 3 keyboards go?" has no answer',
    'Low stock is noticed only after a sale is lost',
    'Overselling happens when two people sell the same item at once',
    'Future changes risk silently breaking working features'],
    n: 'The core issue is trust in the numbers. Stock must be explainable, and changes must not silently break it.',
    v: 'Before/after sketch: spreadsheet chaos vs. one ledger' },
  { t: 'Solution Overview', b: [
    'One web app for products, purchases, sales and a stock ledger',
    'Stock is derived from movements, never typed in, so every change is traceable',
    'The server blocks overselling and duplicate SKUs',
    'One Node process serves the API and the React UI: a single deployable artifact',
    'Backed by automated regression and load-test suites'],
    n: 'Stress the design decision: because stock is the sum of an append-only ledger, the history always explains the count.',
    v: 'Flow: Purchase (+), Sale (-), Adjustment (+/-) all feed the Movements ledger' },
  { t: 'Project Objectives', b: [
    'Track products, stock levels, purchases, sales and movements',
    'Keep stock correct under concurrent use',
    'Deploy as a single artifact with one command to start',
    'Catch regressions before merging (UI/API tests)',
    'Verify performance: 50 users, average < 500 ms, P95 < 1,000 ms, errors < 1%'],
    n: 'The benchmark numbers were set before testing. We measured against them as given.',
    v: 'Checklist graphic with the five objectives' },
  { t: 'Key Features', b: [
    'Dashboard: product count, stock value, sales and purchase totals, low-stock alerts',
    'Products: add, edit, delete, search, manual stock adjustments with a reason',
    'Purchases and Sales: prices prefilled; oversell rejected',
    'Movements: ledger filterable by type and product',
    'Reset demo data: restores the 5-product sample set'],
    n: 'Sample data gives known values: stock value $2,314, total sales $7,463, total purchases $6,040, 4 low-stock items. These double as test oracles.',
    v: '2x2 screenshots: Dashboard, Products, Sales, Movements' },
  { t: 'System Architecture', b: [
    'Browser: React 18 + Vite single-page app with five tabs',
    'Server: one Express process serving /api/* and the built dist/ files',
    'Data: PostgreSQL on Neon through the pg driver',
    'Every API call returns the full updated state, keeping the client simple',
    'In dev, Vite runs embedded as Express middleware'],
    n: 'The single-artifact choice avoids running frontend and backend separately. The trade-off, exposed by the load test, is that every response carries the whole dataset.',
    v: 'Diagram: Browser -> Express (static + REST API) -> PostgreSQL (Neon)',
    diagram: ['Browser\nReact + Vite', 'Express\nAPI + static files', 'PostgreSQL\nNeon'] },
  { t: 'Agent Architecture', b: [
    'Not applicable to the product: the app is a conventional web app with no AI agents inside',
    'Claude Code was the development agent: it wrote the code, tests and load suite, and drove git and GitHub',
    'App behavior is deterministic business rules, not model-driven',
    'A natural future agent: reorder recommendations from sales history'],
    n: 'Say this directly: adding an agent to an inventory CRUD app would not help today.',
    v: 'Diagram: Developer <-> Claude Code -> repository (outside the runtime)' },
  { t: 'Skills, Subagents & Tools Used', b: [
    'Skill: e2e-test-suite-ui-playwright (existing project skill), adapted to this app; rule changed to ask for a new test DB URL every run',
    'Subagents: none used',
    'Tools: Playwright (UI tests), k6 (load tests), npm/Vite, git, Neon',
    'Planned: e2e-test-suite-performance-k6 skill (not created yet; the k6 scripts exist in the repo)'],
    n: 'Be precise: only one skill was used, and the k6 skill is still to build.',
    v: 'Table: Tool | Purpose | Status' },
  { t: 'MCP & Plugin Integration', b: [
    'Three MCP servers configured in .mcp.json: Playwright, GitHub, Neon',
    'Playwright MCP: Claude drives a real Chromium browser against the app (screenshots, UI exploration)',
    'GitHub MCP: repo operations through an authenticated tool; token comes from an environment variable',
    'Neon MCP: create/remove dedicated test branches for the e2e and k6 suites',
    'Status: configured, connections to be verified after server approval. Plugins: none yet (planned /inventory-test and /inventory-perf commands)'],
    n: 'State plainly that the configuration exists and connections still have to be verified. No secrets are in the repo: the GitHub token is an environment variable and Neon uses browser sign-in.',
    v: 'Diagram: Claude Code center; arrows to the running app (Playwright), the repo (GitHub), the test DB branch (Neon)',
    diagram: ['Playwright MCP\nrunning app', 'Claude Code', 'GitHub MCP\nrepository', 'Neon MCP\ntest DB branch'] },
  { t: 'Technology Stack', b: [
    'Frontend: React 18.3, Vite 5.4',
    'Backend: Node.js 24, Express 4',
    'Database: PostgreSQL 18.7 on Neon, pg driver',
    'Testing: Playwright (headed Chromium), k6 2.4.0',
    'Tooling: GitHub, npm'],
    n: 'All versions come from the project package.json and tool output.',
    v: 'Logo row' },
  { t: 'Database Design', b: [
    'Four tables: products, purchases, sales, movements',
    'movements is the source of truth: stock = sum of qty per product',
    'Unique case-insensitive SKU index; CHECK constraints for non-negative prices and positive quantities',
    'Foreign keys cascade on delete, so removing a product removes its history',
    'Row lock (FOR UPDATE) in each sale/adjustment prevents overselling under concurrency'],
    n: 'Locking is verified by an API test: two concurrent 10-unit sales against 16 in stock give one success and one 409.',
    v: 'ER diagram of the 4 tables' },
  { t: 'Observability & Traceability', b: [
    'Traceability is strong: every stock change is a ledger row with type, quantity, note, date and reference',
    'Consistent JSON error responses: { "error": "..." }',
    'Load-test observability: per-workflow metrics, per-minute latency, server CPU/memory sampling',
    'Gap, stated honestly: no APM, request tracing or structured application logging yet'],
    n: 'The ledger is the business audit trail. For operations monitoring the next step is request logging and a metrics endpoint.',
    v: 'Screenshot of the Movements tab and the k6 latency-over-time table' },
  { t: 'Functional Testing Approach', b: [
    'Playwright, always headed, one worker, no retries',
    '44 specs in 8 files: dashboard, products, sales, purchases, movements, persistence, API contract, isolation canary',
    'Tests check the UI and the database effect, including blocked overselling and a concurrent-sales race',
    'Isolation guard refuses to run if the test DB matches the app DB (verified with three fake-URL checks)',
    'STATUS: written, NOT yet executed. Needs a dedicated test DB URL'],
    n: 'Do not claim results that do not exist. A Neon test branch would unblock this suite.',
    v: 'Table of specs per area; diagram of the isolation guard' },
  { t: 'Evaluation Results', b: [
    'Overall verdict: FAIL against the three thresholds',
    'Average response 9,866 ms (target < 500 ms): FAIL',
    'P95 18,211 ms (target < 1,000 ms): FAIL',
    'Error rate 0.07% (target < 1%): PASS',
    'Functional checks 100%: data was correct, but delivered too slowly'],
    n: 'The result is a finding, not a project failure: the test worked as a regression gate and exposed real performance problems. 22 threshold checks crossed their limits.',
    v: 'Scorecard',
    table: [['Criterion', 'Target', 'Measured', 'Result'],
      ['Average response', '< 500 ms', '9,866 ms', 'FAIL'], ['P95 response', '< 1,000 ms', '18,211 ms', 'FAIL'], ['Error rate', '< 1%', '0.07%', 'PASS']] },
  { t: 'Performance Testing Approach', b: [
    'k6 load test over 10 workflows: dashboard, listing, search, add, edit, delete, stock in, stock out, history, reports',
    'Profile: 50 users, 30 s ramp, 4m30s hold (5 min total), 2 s think time',
    'Each user creates and deletes its own product: runs are repeatable (database ended at baseline)',
    'Thresholds applied overall and per workflow',
    'Runs on a dedicated Neon test branch, never the application database'],
    n: 'Dashboard, listing, search, history and reports all call the one GET /api/state endpoint because the app computes them in the browser. The results state this too.',
    v: 'Load profile chart: ramp to 50 users, then hold' },
  { t: 'Load Testing Results', chart: true, b: [
    '1,378 requests at 3.6 req/s (about 20 expected for 50 users at 2 s think time)',
    'Average 9,866 ms, P95 18,211 ms, P99 18,694 ms, max 19,061 ms',
    'Reads averaged 3.0-7.6 s; writes averaged 13.9-16.1 s',
    'Server CPU averaged 2% (peak 5%); memory peak 97 MB',
    'Likely cause (inferred, not proven): DB round-trips, pool of 5, full-state responses (avg 19 KB)'],
    n: 'Latency was steady around 10-13 s from minute 2: the system was saturated, not degrading. Caveat: load generator and app shared one machine and the database was remote, which inflates every number.',
    v: 'Chart: average and P95 per workflow (seconds)' },
  { t: 'Deployment Architecture', b: [
    'Single artifact: npm run build, then npm start. Express serves UI and API on one port',
    'Configuration: DATABASE_URL, PORT. Secrets live in a git-ignored .env',
    'Tables are created automatically on first start',
    'Current status: runs locally only; not deployed to a host',
    'Recommendation: deploy in the same region as the database (the ~240 ms round-trip dominates latency)'],
    n: 'The deployment design is ready; the deployment itself is a next step.',
    v: 'Diagram: one server instance -> Neon, with a "same region" bracket' },
  { t: 'Screenshots of Application', b: [
    'Dashboard with KPI cards and low-stock alerts',
    'Products table with stock badges and Adjust / Edit / Delete actions',
    'Sales form blocking an oversell',
    'Movements ledger with signed quantities',
    'k6 HTML report'],
    n: 'NO SCREENSHOTS EXIST YET. Capture them from npm run dev (localhost:3000) and the k6 report.html, then drop them into this slide.',
    v: '2x2 grid plus one wide image of the k6 report' },
  { t: 'Business Impact', b: [
    'Every stock change is explainable because stock comes from the ledger',
    'Overselling is prevented by the server, not left to the UI',
    'Regression tests give confidence before merging changes',
    'The load test found the performance limits before users did',
    'Not yet measurable: no real users, so no cost or time savings are claimed'],
    n: 'Be honest about impact. The value shown is correctness and risk reduction.',
    v: 'Three icons: Trust, Safety, Early warning' },
  { t: 'Future Enhancements & Conclusion', b: [
    'Pass the benchmark: one-statement writes, return only changed records, cache reads, pool of ~20, deploy beside the database',
    'Run the Playwright suite and publish its report',
    'Authentication, roles, multiple warehouses, CSV import/export, charts',
    'Real server-side search, paged history and a reports endpoint',
    'Conclusion: a working, traceable full-stack app with real tests; the load test shows exactly what to fix next'],
    n: 'End on the measured next step. A re-run after the fixes gives the before/after comparison.',
    v: 'Roadmap: Now -> Fix performance -> Auth -> Scale' },
]

function frame(s, title, notes) {
  s.background = { color: 'FFFFFF' }
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 1.1, fill: { color: NAVY } })
  s.addText(title, { x: 0.5, y: 0.15, w: 12.3, h: 0.8, fontSize: 30, bold: true, color: 'FFFFFF', fontFace: 'Calibri' })
  s.addNotes(notes)
}

// 1. Title slide
let s = pptx.addSlide()
s.background = { color: NAVY }
s.addText('Inventory Management System', { x: 0.8, y: 2.0, w: 11.7, h: 1.2, fontSize: 46, bold: true, color: 'FFFFFF' })
s.addText('Full-stack React + Express + PostgreSQL, with automated UI and load testing', { x: 0.8, y: 3.3, w: 11.7, h: 0.7, fontSize: 22, color: 'CBD5E1' })
s.addText('Capstone project  |  Anusha', { x: 0.8, y: 4.5, w: 11.7, h: 0.5, fontSize: 18, color: 'FFFFFF' })
s.addText('github.com/Anusha00912/Inventory-Management-System', { x: 0.8, y: 5.0, w: 11.7, h: 0.5, fontSize: 16, color: '93C5FD' })
s.addNotes('Introduce yourself and the one-line pitch: track products, stock, purchases, sales and stock movements in one deployable app, then test it for regressions and performance.')

for (const sl of slides) {
  s = pptx.addSlide()
  frame(s, sl.t, sl.n)
  const wide = !!(sl.chart)
  s.addText(sl.b.map((t) => ({ text: t, options: { bullet: true, breakLine: true } })),
    { x: 0.5, y: 1.4, w: wide ? 5.6 : 7.2, h: 5.2, fontSize: wide ? 15 : 18, color: '1F2937', valign: 'top', paraSpaceAfter: 10, fontFace: 'Calibri' })

  const bx = wide ? 6.4 : 8.0, bw = wide ? 6.5 : 4.9
  if (sl.chart) {
    const labels = ['Dashboard', 'Listing', 'Search', 'Add', 'Edit', 'Stock in', 'Stock out', 'History', 'Reports', 'Delete']
    s.addChart(pptx.charts.BAR, [
      { name: 'Average (s)', labels, values: [3.0, 6.4, 6.6, 13.9, 14.8, 15.6, 16.1, 7.5, 7.6, 15.9] },
      { name: 'P95 (s)', labels, values: [8.6, 8.7, 8.3, 16.6, 17.8, 18.6, 18.9, 8.9, 8.9, 18.1] },
    ], { x: bx, y: 1.4, w: bw, h: 4.2, barDir: 'col', chartColors: [BLUE, RED], showLegend: true, legendPos: 'b', legendFontSize: 11,
      catAxisLabelFontSize: 9, valAxisLabelFontSize: 10, showTitle: true, title: 'Response time per workflow (target: avg 0.5 s, P95 1.0 s)', titleFontSize: 11 })
    s.addText(`Suggested visual: ${sl.v}`, { x: bx, y: 5.7, w: bw, h: 0.7, fontSize: 11, italic: true, color: GREY })
  } else if (sl.table) {
    const rows = sl.table.map((r, i) => r.map((c) => ({ text: c, options: i === 0
      ? { bold: true, color: 'FFFFFF', fill: { color: NAVY } }
      : { color: c === 'FAIL' ? RED : c === 'PASS' ? GREEN : '1F2937', bold: c === 'FAIL' || c === 'PASS' } })))
    s.addTable(rows, { x: bx - 0.3, y: 1.6, w: bw + 0.3, colW: [1.5, 1.1, 1.2, 0.8], fontSize: 12, border: { type: 'solid', color: 'CBD5E1', pt: 1 }, rowH: 0.5 })
  } else if (sl.diagram) {
    const n = sl.diagram.length, h = Math.min(1.1, 4.6 / n - 0.2)
    sl.diagram.forEach((label, i) => {
      s.addShape(pptx.ShapeType.roundRect, { x: bx, y: 1.5 + i * (h + 0.3), w: bw, h, fill: { color: i === 1 && n === 4 ? BLUE : 'DBEAFE' }, line: { color: BLUE, width: 1.5 }, rectRadius: 0.1 })
      s.addText(label, { x: bx, y: 1.5 + i * (h + 0.3), w: bw, h, align: 'center', valign: 'middle', fontSize: 14, bold: true, color: i === 1 && n === 4 ? 'FFFFFF' : NAVY })
    })
    s.addText(`Suggested visual: ${sl.v}`, { x: bx, y: 6.2, w: bw, h: 0.6, fontSize: 11, italic: true, color: GREY })
  } else {
    s.addShape(pptx.ShapeType.roundRect, { x: bx, y: 1.5, w: bw, h: 4.6, fill: { color: LIGHT }, line: { color: 'CBD5E1', width: 1.5, dashType: 'dash' }, rectRadius: 0.1 })
    s.addText([{ text: 'Visual placeholder', options: { bold: true, breakLine: true, color: GREY, fontSize: 14 } },
               { text: sl.v, options: { color: GREY, fontSize: 13 } }], { x: bx + 0.2, y: 1.5, w: bw - 0.4, h: 4.6, align: 'center', valign: 'middle' })
  }
}

await pptx.writeFile({ fileName: '../Inventory-Management-System-Capstone.pptx' })
console.log('wrote docs/Inventory-Management-System-Capstone.pptx, slides:', slides.length + 1)
