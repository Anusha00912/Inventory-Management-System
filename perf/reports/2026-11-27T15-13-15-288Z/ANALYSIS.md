# Bottleneck analysis — baseline load test (2026-11-27)

Profile: 50 virtual users, 30 s ramp, 4m30s hold (5 min total), 2 s think time.
Thresholds: avg < 500 ms, P95 < 1000 ms, errors < 1%. Full numbers: [performance-summary.md](performance-summary.md).

**Result: FAIL** — average 9,866 ms, P95 18,211 ms, 3.6 requests/s, 0.07% errors, 100% functional checks.
Responses were correct; the app was too slow, not broken.

## Findings

1. **Not CPU-bound.** The Node process averaged ~2% of one core (peak 5%), 97 MB memory. Time is spent waiting.
2. **Throughput ceiling of ~3.6 req/s.** 50 users with a 2 s think time should generate ~20 req/s. Latency held at ~10–13 s from minute 2 on (flat, not climbing): the system is saturated.
3. **Writes are slowest** (avg 13.9–16.1 s for add/edit/stock-in/stock-out/delete) versus reads (avg 3.0–7.6 s).
4. **Likely cause (inferred from the numbers, not yet proven):** database round-trips plus a small connection pool.
   - A 2-user smoke run showed a read ≈ 240 ms (one round trip to the hosted database) and a write ≈ 1.2–1.8 s (~6 sequential round trips: begin, lock, stock check, two inserts, commit; plus one to reload state).
   - The app's pool (`server/db.js`, `max: 5`) is shared by everything; a full-state read runs 4 queries in parallel and takes 4 of the 5 connections.
5. **Every request returns the whole dataset.** All read workflows call `GET /api/state`, and every write returns the full state too. Payload grew from 3.6 KB (smoke) to 19 KB avg / 36 KB max under load. Not the bottleneck now, but cost grows with data size.

## Caveats

- The load generator and the app ran on the same machine, and the test database was a Neon branch in `us-east-2`; the remote round-trip time inflates every number. The same app next to its database would be much faster. The relative picture (writes slowest, nothing scales) is the useful part.
- Dashboard, listing, search, history and reports have no dedicated server endpoints in this app (all computed in the browser from `/api/state`), so they were measured as tagged calls to that endpoint.

## Suggested next steps

1. Cut round-trips per write (combine statements / use a CTE).
2. Stop returning the full state after every write.
3. Raise the pool size (e.g. 5 → 20) and re-run — the cheapest test of finding 4.
4. Add real server-side search, paged history and a reports endpoint.
