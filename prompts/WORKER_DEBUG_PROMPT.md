# Worker Debug Prompt

Symptom-driven procedure: (1) read worker-agent/agent.log recv/emit
counters and .zscripts/gateway.log audio_c2w/audio_w2c counters; (2)
determine which side stopped: client send, gateway forward, or worker
convert; (3) check worker heartbeat freshness and status in the admin
fleet table; (4) run scripts/cleanup-stale.ts and reproduce with
scripts/e2e-audio.ts; (5) only then change code. Known fixed issues:
pre-peer chunk drops (now rejected with ack false), heartbeat clobbering
control-plane status (now preserved), agent URL fallback order.
