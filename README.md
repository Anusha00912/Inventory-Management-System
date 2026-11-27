# Inventory Management System

A simple, single-deployable web app for tracking products, stock levels, purchases, sales, and inventory movements. One Node.js process serves both the REST API and the React frontend, backed by PostgreSQL.

## Project Overview

Stock levels are never stored directly. They are derived from an append-only ledger of **inventory movements** (purchases, sales, and manual adjustments), so every change in stock is traceable. The server enforces business rules such as preventing overselling and duplicate SKUs, and uses database transactions with row locking to stay correct under concurrent requests.

## Features

- **Dashboard** – product count, stock value, total sales and purchases, and low-stock alerts
- **Products** – add, edit, delete, and search products; manual stock adjustments with a reason
- **Purchases** – record incoming stock with supplier and unit cost
- **Sales** – record outgoing stock; sales exceeding available stock are rejected
- **Movements** – full ledger filterable by type and product
- **Validation** – server-side input checks and unique (case-insensitive) SKUs
- **Single artifact** – Express serves the built React app and the API from one port

## Technology Stack

| Layer     | Technology                          |
| --------- | ----------------------------------- |
| Frontend  | React 18, Vite                      |
| Backend   | Node.js, Express                    |
| Database  | PostgreSQL (tested on Neon) via `pg` |

## Installation Steps

**Prerequisites:** Node.js 20+ and a PostgreSQL database.

1. Clone the repository and install dependencies:
   ```bash
   git clone https://github.com/Anusha00912/Inventory-Management-System.git
   cd Inventory-Management-System
   npm install
   ```
2. Configure the database connection:
   ```bash
   cp .env.example .env
   # edit .env and set DATABASE_URL
   ```
3. Run in development (Express with embedded Vite, hot reload) at http://localhost:3000:
   ```bash
   npm run dev
   ```
4. Or build and run for production:
   ```bash
   npm run build
   npm start
   ```

Tables are created automatically on first start, and sample data is loaded into an empty database.

**Configuration**

| Variable       | Description                         | Default |
| -------------- | ----------------------------------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string        | –       |
| `PORT`         | Port the server listens on          | `3000`  |

## Testing

Both suites need a **dedicated test database** (never the application's own); each refuses to run if its database matches the app's `DATABASE_URL`, and wipes and re-seeds that database.

### UI regression tests (Playwright, headed)
```bash
npx playwright install chromium
cp .env.e2e.example .env.e2e      # set E2E_DATABASE_URL to a test database
npm run test:e2e                  # also: test:e2e:ui, test:e2e:report
```
44 specs cover the dashboard, products, sales, purchases, the movements ledger, persistence, the API contract, and an isolation canary. They run in a visible browser by design.

### Load tests (k6)
Install [k6](https://k6.io/docs/get-started/installation/), then:
```bash
cp .env.perf.example .env.perf    # set PERF_DATABASE_URL to a test database
npm run perf:smoke                # ~25s validation run
npm run perf                      # 50 users, 30s ramp, 5 min total, 2s think time
```
Thresholds: average < 500 ms, P95 < 1000 ms, errors < 1%. Each run writes an HTML report, JSON results and a summary to `perf/results/<timestamp>/`. Override settings with flags, e.g. `node perf/run.mjs --vus 100 --duration 2m --p95 800`.

### Latest load-test results
Baseline run (50 users, 5 min): **FAIL** against the thresholds, avg 9.9 s, P95 18.2 s, 3.6 req/s.
- [Performance summary](perf/reports/2026-11-27T15-13-15-288Z/performance-summary.md)
- [Bottleneck analysis](perf/reports/2026-11-27T15-13-15-288Z/ANALYSIS.md)
- [Interactive HTML report](https://htmlpreview.github.io/?https://github.com/Anusha00912/Inventory-Management-System/blob/main/perf/reports/2026-11-27T15-13-15-288Z/report.html) (GitHub shows .html as source; this opens it rendered)

Publish a new run with `npm run perf:publish` (copies a trimmed, host-redacted set into `perf/reports/`).

## Future Enhancements

- User authentication and role-based access
- Multiple warehouses / locations
- Delete or reverse purchases and sales
- CSV import/export and printable reports
- Charts and sales/stock trend analytics
- Barcode scanning and supplier management
- Automated tests and CI pipeline
