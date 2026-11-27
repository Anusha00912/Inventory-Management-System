# Performance summary — 2026-11-27T15:13:31.113Z

**Result: FAIL ❌** — 22 threshold(s) crossed

Profile: 50 VUs · ramp 30s · hold 4m30s · think time 2s · thresholds avg<500ms, p95<1000ms, errors<1%
Environment: Windows_NT 10.0.26100, 4 CPUs, Node v24.21.0, k6.exe v2.4.0 (commit/dd9395906d, go1.26.11, windows/amd64), test DB host <neon-test-branch-host>. Load generator and server share this machine.

## Headline
| Metric | Value | Threshold | Status |
|---|---|---|---|
| Average response time | 9866.0 ms | < 500 ms | ❌ |
| P95 response time | 18210.8 ms | < 1000 ms | ❌ |
| P99 / max | 18694.3 ms / 19061.4 ms | – | – |
| Requests per second | 3.60 (1378 requests) | – | – |
| Error rate (failed requests) | 0.07% | < 1% | ✅ |
| Functional checks passed | 100.00% | > 99% | ✅ |

## Per workflow
| Workflow | Requests | Avg | P95 | Max | Errors | Status |
|---|---|---|---|---|---|---|
| dashboard | 256 | 3020.0 ms | 8647.0 ms | 9335.2 ms | 0.00% | ❌ |
| product_listing | 128 | 6430.9 ms | 8702.1 ms | 9273.6 ms | 0.00% | ❌ |
| search_products | 128 | 6582.0 ms | 8303.9 ms | 8878.6 ms | 0.00% | ❌ |
| add_product | 128 | 13859.3 ms | 16619.3 ms | 17214.7 ms | 0.00% | ❌ |
| edit_product | 128 | 14771.2 ms | 17756.4 ms | 18376.5 ms | 0.00% | ❌ |
| stock_in | 128 | 15599.8 ms | 18576.0 ms | 18888.9 ms | 0.00% | ❌ |
| stock_out | 125 | 16126.4 ms | 18868.1 ms | 19061.4 ms | 0.00% | ❌ |
| transaction_history | 119 | 7547.2 ms | 8938.8 ms | 9206.6 ms | 0.00% | ❌ |
| reports | 113 | 7627.2 ms | 8941.2 ms | 9362.6 ms | 0.00% | ❌ |
| delete_product | 107 | 15858.3 ms | 18092.5 ms | 18706.7 ms | 0.00% | ❌ |

### Thresholds crossed
- `http_req_duration{workflow:product_listing}` avg<500
- `http_req_duration{workflow:product_listing}` p(95)<1000
- `http_req_duration{workflow:edit_product}` avg<500
- `http_req_duration{workflow:edit_product}` p(95)<1000
- `http_req_duration{workflow:stock_out}` avg<500
- `http_req_duration{workflow:stock_out}` p(95)<1000
- `http_req_duration{workflow:add_product}` avg<500
- `http_req_duration{workflow:add_product}` p(95)<1000
- `http_req_duration{workflow:dashboard}` avg<500
- `http_req_duration{workflow:dashboard}` p(95)<1000
- `http_req_duration{workflow:reports}` avg<500
- `http_req_duration{workflow:reports}` p(95)<1000
- `http_req_duration` p(95)<1000
- `http_req_duration` avg<500
- `http_req_duration{workflow:search_products}` avg<500
- `http_req_duration{workflow:search_products}` p(95)<1000
- `http_req_duration{workflow:stock_in}` avg<500
- `http_req_duration{workflow:stock_in}` p(95)<1000
- `http_req_duration{workflow:transaction_history}` avg<500
- `http_req_duration{workflow:transaction_history}` p(95)<1000
- `http_req_duration{workflow:delete_product}` avg<500
- `http_req_duration{workflow:delete_product}` p(95)<1000

## Latency over time
| Minute (UTC) | Requests | Avg | P95 |
|---|---|---|---|
| 15:13 | 158 | 1989.8 ms | 6834.0 ms |
| 15:14 | 196 | 12160.8 ms | 17558.8 ms |
| 15:15 | 235 | 11409.0 ms | 18690.9 ms |
| 15:16 | 243 | 10179.7 ms | 16341.4 ms |
| 15:17 | 196 | 13686.3 ms | 18539.2 ms |
| 15:18 | 237 | 9866.1 ms | 17498.8 ms |
| 15:19 | 113 | 6388.2 ms | 9436.3 ms |

## Data and resources
- Data before → after: {"products":5,"purchases":5,"sales":5,"movements":10} → {"products":5,"purchases":5,"sales":5,"movements":10} (each iteration cleans up after itself; a drift means leftovers)
- `GET /api/state` payload: avg 19.0 KB, max 35.9 KB. Every mutation returns the same full state.
- Average response size across all requests: 18.3 KB
- App server process: CPU avg 2% / peak 5% of one core; memory peak 97 MB

## Observations
- Slowest by P95: stock_out (18868.1 ms), stock_in (18576.0 ms), delete_product (18092.5 ms); fastest: search_products (8303.9 ms).
- Writes average 15243.0 ms vs reads 6241.5 ms (2.4x).
- First vs last full minute: avg 12160.8 ms → 9866.1 ms — stable.
- The Node process averaged only 2% of a core: time is going to waiting (database round-trips / network), not CPU.

## Change since previous run (2026-11-27T15-12-17-872Z)
- Avg 739.8 ms → 9866.0 ms; P95 1688.4 ms → 18210.8 ms; req/s 1.39 → 3.60
