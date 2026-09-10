# GPU and Compute Research

Checked: 2026-09-10. Quota numbers move; re-verify before relying on them.

## Classification
| Provider | Class | Verdict |
|---|---|---|
| Local CPU (this machine) | FREE FOREVER | AUTONOMOUS worker; runs the DSP tier today |
| Local NVIDIA GPU | FREE FOREVER | RVC capable when present; telemetry via psutil/nvidia-smi |
| Kaggle notebook (T4/T4x2) | FREE WITH QUOTA (~30 h/week, ~12 h/session) | ASSISTED only; dial-out works; termination is normal failure; ToS review required before serving third parties |
| Hugging Face ZeroGPU | FREEMIUM, quota based | NOT SUITABLE for fleet workers |
| Google Colab | FREE FOR DEVELOPMENT | no programmatic session guarantee; dev experiments only |
| Modal / RunPod | PAY-AS-YOU-GO | interface-ready providers; require credentials; cost-guarded |
| Any provider requiring a card | PAID | never called free |

## Provider automation classes
- AUTONOMOUS: the platform starts and stops it (LocalProvider).
- ASSISTED: the platform prepares everything (registration token, script,
  step-by-step cell) and a human pastes it (KaggleAssistedProvider).
  The UI and docs state this plainly. Kaggle does not support supported
  programmatic launching of interactive GPU sessions.
- MANUAL: reserved for future enterprise bring-your-own capacity.

## Recovery stance
A Kaggle notebook disappearing is NORMAL INFRASTRUCTURE FAILURE. The system
recovers by marking the worker UNHEALTHY on missed heartbeats (120 s),
ending orphaned sessions (90 s), re-queueing demand, and asking for capacity
top-up. Nothing in the fleet design assumes tmux or any trick keeps a
provider from terminating a notebook.
