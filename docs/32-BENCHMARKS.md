# Benchmarks

Checked: 2026-09-10 on this machine (loopback, dev runtimes).

## Measured
| Metric | Value | Method |
|---|---|---|
| Gateway chunk RTT P50 | 3 ms | gateway pending-map matching, 30 chunks |
| Gateway chunk RTT P95 | 4-6 ms | same, two runs |
| DSP engine infer per 128 ms chunk | ~0.17-0.21 ms | agent infer_ms deque |
| Worker PING round trip | ~1.5 s | includes the agent command poll interval; noted in test output |
| Session start to ACTIVE | < 2 s with a warm worker | E2E logs |
| Agent registration to READY | ~12 s | provision-to-heartbeat observation |
| Orphan recovery | ~100 s | failover verification (90 s staleness + 30 s tick) |
| Rate limiter precision | 240 allowed / then 429 | window-aligned burst of 360 |

## Not claimed
- No GPU inference numbers: no RVC runtime or GPU exists in this
  environment, so none are stated. Benchmarks for RVC tiers land when a
  real GPU worker exists.
- No browser end-to-end latency numbers beyond the studio's own live
  display; loopback numbers above exclude real networks.
