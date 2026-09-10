# Cost Model

Checked: 2026-09-10. No prices are fabricated; this is the decision math.

## Cost drivers per architecture
- Control plane: one small VM or serverless container (dev runs on this
  machine). Negligible at small scale.
- Database: SQLite file now; managed Postgres later (small tier).
- Audio gateway: tiny stateless service; scales with session count.
- GPU inference: THE cost. Paid per-second hosts bill per worker-second.

## Unit economics template (fill with real quotes at launch)
    cost_per_session_gpu = worker_rate_per_hour / 3600 x session_seconds
    overhead = infer_ms_per_chunk / chunk_ms (utilisation factor)
    cost_per_session = cost_per_session_gpu / overhead + egress
    price_per_session = cost_per_session / (1 - target_margin)

## Worked stance
- FREE tier: served by FREE capacity only (local DSP always; assisted
  notebooks when available). Marginal cost target: zero. The scheduler
  enforces free-first so this is structural, not aspirational.
- PAID tiers: paid capacity admitted only inside budget guard; scale-to-
  zero keeps idle paid cost at exactly zero; CostRecord rows give the
  daily/monthly actuals that the pricing decision needs.
- The budget policy ships with a $1/day example guard so that even a
  misconfiguration cannot bleed money silently.

## Measurement
- CostRecord rows are written per provision/worker-hour event with provider
  and costKind; the admin Billing panel sums them. No made-up numbers are
  displayed anywhere; empty sums show as zero, honestly.
