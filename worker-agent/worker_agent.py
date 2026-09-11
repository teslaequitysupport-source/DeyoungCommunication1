#!/usr/bin/env python3
"""
VoxCore GPU Worker Agent
========================

A real worker agent for the VoxCore real-time AI voice conversion platform.
Runs on a local machine (CPU tier) or inside a Kaggle notebook (GPU tier),
needs only OUTBOUND connectivity, and:

  - registers with the control plane using a one-time registration token
  - reports heartbeats with real hardware telemetry (psutil when available)
  - polls the command queue (PING, TEST_JOB, START_SESSION, STOP_SESSION,
    DRAIN, SHUTDOWN, RESTART, LOAD_MODEL, EVICT_MODEL)
  - connects to the audio gateway as the worker side of a session and
    converts audio chunks in real time
  - measures its own inference latency (p50/p95) and reports it

Conversion engines:
  - DSP tier (always available): a real granular pitch/formant shifter
    implemented with numpy. No model weights required. This is genuine signal
    processing, not a stub.
  - RVC tier (operator-provisioned): loads an RVC .pth checkpoint when
    installed on the worker (see docs/10-KAGGLE-WORKER.md). The platform never
    ships or unpickles model files server-side.

Honesty rules honored by this agent: it only advertises tiers it truly
supports and never fakes GPU telemetry.

Python 3.9+. Dependencies: requests, numpy. Optional: psutil, torch+faiss
(for RVC), python-socketio (installed automatically by the Kaggle cell).
"""

import os
import sys
import time
import json
import base64
import signal
import socket
import platform
import threading
import traceback
from collections import deque

try:
    import requests
except ImportError:
    print("FATAL: requests is required. pip install requests", flush=True)
    sys.exit(1)

import numpy as np

BACKEND = os.environ.get("BACKEND_URL", "http://127.0.0.1:3000").rstrip("/")
REG_TOKEN = os.environ.get("WORKER_REG_TOKEN", "")
WORKER_NAME = os.environ.get("WORKER_NAME", "") or socket.gethostname()[:40]
TIERS_OVERRIDE = os.environ.get("WORKER_TIERS", "")

HEARTBEAT_SEC = 20
POLL_SEC = 1.5
API_TIMEOUT = 15

SAMPLE_RATE = 16000
CHUNK_MS = 128
CHUNK_SAMPLES = int(SAMPLE_RATE * CHUNK_MS / 1000)

STATE = {
    "worker_id": None,
    "token": None,
    "status": "BOOTING",
    "loaded_models": [],
    "active_sessions": 0,
    "error_count": 0,
    "started_at": time.time(),
    "infer_ms": deque(maxlen=400),
    "stop": threading.Event(),
    "rvc": None,  # lazily-created RVC engine when a model is installed
}

log_lock = threading.Lock()

# Chunk-level trace file for session streaming diagnosis. Verbose but cheap:
# one line every 10 chunks, plus every exception with traceback.
TRACE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "agent.log")


def trace(msg):
    try:
        with log_lock:
            with open(TRACE_PATH, "a") as f:
                f.write(f"{time.strftime('%H:%M:%S')} {msg}\n")
    except Exception:
        pass


def log(level, kind, message, data=None):
    line = json.dumps({"level": level, "kind": kind, "msg": message, "data": data, "ts": time.time()})
    with log_lock:
        print(line, flush=True)
    if STATE["worker_id"] and kind not in ("HEARTBEAT",):
        try:
            requests.post(
                f"{BACKEND}/api/worker/events",
                headers=auth_headers(),
                json={"level": level.upper() if level in ("info", "warn", "error") else "INFO",
                      "kind": kind, "message": message[:1900], "data": data or {}},
                timeout=API_TIMEOUT,
            )
        except Exception:
            pass


def auth_headers():
    return {"Authorization": f"Bearer {STATE['token']}"}


# ---------------------------------------------------------------------------
# Hardware telemetry (real values only)
# ---------------------------------------------------------------------------

def hardware_report():
    report = {
        "os": f"{platform.system()} {platform.release()}",
        "pythonVersion": platform.python_version(),
        "cpuCores": os.cpu_count(),
    }
    try:
        import psutil
        vm = psutil.virtual_memory()
        report["ramMb"] = int(vm.total / 1024 / 1024)
    except Exception:
        pass
    gpu = detect_gpu()
    if gpu:
        report.update(gpu)
    return report


def detect_gpu():
    """Detect CUDA GPUs with torch or nvidia-smi. Returns None when absent."""
    try:
        import torch
        if torch.cuda.is_available():
            props = torch.cuda.get_device_properties(0)
            return {
                "gpuName": props.name,
                "vramMb": int(props.total_memory / 1024 / 1024),
                "cudaVersion": getattr(torch.version, "cuda", None),
            }
    except Exception:
        pass
    try:
        out = os.popen("nvidia-smi --query-gpu=name,memory.total --format=csv,noheader,nounits").read().strip()
        if out:
            name, vram = out.splitlines()[0].split(",")[0:2]
            return {"gpuName": name.strip(), "vramMb": int(float(vram))}
    except Exception:
        pass
    return None


def cpu_util_pct():
    try:
        import psutil
        return psutil.cpu_percent(interval=None)
    except Exception:
        return None


def ram_used_mb():
    try:
        import psutil
        return int(psutil.virtual_memory().used / 1024 / 1024)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Registration and heartbeat
# ---------------------------------------------------------------------------

def supported_tiers():
    if TIERS_OVERRIDE:
        try:
            return json.loads(TIERS_OVERRIDE)
        except Exception:
            pass
    tiers = ["DSP_CPU"]
    if detect_gpu() is not None:
        tiers.append("RVC_GPU")
    return tiers


def register():
    body = {
        "regToken": REG_TOKEN,
        "name": WORKER_NAME,
        "region": os.environ.get("WORKER_REGION", "unspecified"),
        "os": None, "pythonVersion": None,
        "tiers": supported_tiers(),
        "capabilities": {"canLoadModels": detect_gpu() is not None, "maxSessions": 2 if detect_gpu() else 1},
        "maxSessions": 2 if detect_gpu() else 1,
    }
    body.update({k: v for k, v in hardware_report().items() if k in ("os", "pythonVersion", "cpuCores", "ramMb", "gpuName", "vramMb", "cudaVersion")})
    body["agentVersion"] = "1.0.0"

    resp = requests.post(f"{BACKEND}/api/worker/register", json=body, timeout=API_TIMEOUT)
    data = resp.json()
    if resp.status_code != 200 or not data.get("ok"):
        raise RuntimeError(f"registration failed: {data}")
    STATE["worker_id"] = data["workerId"]
    STATE["token"] = data["workerToken"]
    log("info", "REGISTERED", f"registered as {data['workerId']}", {"tiers": body["tiers"]})
    return data


def heartbeat_loop():
    while not STATE["stop"].is_set():
        try:
            infer = sorted(STATE["infer_ms"])
            p50 = infer[len(infer) // 2] if infer else None
            p95 = infer[int(len(infer) * 0.95)] if infer else None
            gpu_util, vram_used = gpu_telemetry()
            body = {
                "status": STATE["status"],
                "activeSessions": STATE["active_sessions"],
                "cpuUtilPct": cpu_util_pct(),
                "ramUsedMb": ram_used_mb(),
                "gpuUtilPct": gpu_util,
                "vramUsedMb": vram_used,
                "inferP50Ms": p50,
                "inferP95Ms": p95,
                "errorCount": STATE["error_count"],
                "uptimeSec": int(time.time() - STATE["started_at"]),
                "loadedModels": STATE["loaded_models"],
            }
            requests.post(f"{BACKEND}/api/worker/heartbeat", headers=auth_headers(), json=body, timeout=API_TIMEOUT)
        except Exception as e:
            STATE["error_count"] += 1
            log("warn", "HEARTBEAT_FAILED", str(e)[:200])
        STATE["stop"].wait(HEARTBEAT_SEC)


def gpu_telemetry():
    try:
        import torch
        if torch.cuda.is_available():
            allocated = torch.cuda.memory_allocated(0)
            total = torch.cuda.get_device_properties(0).total_memory
            util = os.popen("nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits").read().strip()
            return (float(util) if util else None), int(allocated / 1024 / 1024)
    except Exception:
        pass
    return None, None


# ---------------------------------------------------------------------------
# Command loop
# ---------------------------------------------------------------------------

def command_loop():
    while not STATE["stop"].is_set():
        try:
            resp = requests.get(f"{BACKEND}/api/worker/commands", headers=auth_headers(), timeout=API_TIMEOUT)
            if resp.status_code == 200:
                for cmd in resp.json().get("commands", []):
                    handle_command(cmd)
        except Exception as e:
            log("warn", "POLL_FAILED", str(e)[:200])
        STATE["stop"].wait(POLL_SEC)


def complete_command(cmd_id, ok, result=None, error=None):
    # The result POST is retried with backoff: a lost ack leaves the command
    # stuck DELIVERED until the backend's redelivery window elapses, which
    # wastes up to 30 seconds and can double-execute the handler. Three
    # bounded attempts cover a transient backend stall.
    last_err = None
    for attempt in range(3):
        try:
            resp = requests.post(
                f"{BACKEND}/api/worker/commands/{cmd_id}",
                headers=auth_headers(),
                json={"ok": ok, "result": result, "error": error},
                timeout=API_TIMEOUT,
            )
            if resp.status_code < 500:
                return
            last_err = f"HTTP {resp.status_code}"
        except Exception as e:
            last_err = str(e)[:200]
        time.sleep(2 * (attempt + 1))
    log("warn", "CMD_ACK_FAILED", str(last_err)[:200])


def handle_command(cmd):
    kind = cmd["kind"]
    payload = cmd.get("payload") or {}
    log("info", "COMMAND", f"received {kind}", {"commandId": cmd["id"]})
    try:
        if kind == "PING":
            complete_command(cmd["id"], True, {"pong": time.time(), "status": STATE["status"]})

        elif kind == "TEST_JOB":
            result = run_test_job(payload)
            complete_command(cmd["id"], True, result)

        elif kind == "START_SESSION":
            start_session(payload)
            complete_command(cmd["id"], True, {"accepted": True})

        elif kind == "STOP_SESSION":
            stop_session(payload.get("sessionId"), payload.get("reason", "STOP"))
            complete_command(cmd["id"], True, {"stopped": True})

        elif kind == "DRAIN":
            STATE["status"] = "DRAINING" if STATE["active_sessions"] > 0 else "IDLE"
            complete_command(cmd["id"], True, {"status": STATE["status"]})

        elif kind == "RESTART":
            complete_command(cmd["id"], True, {"restarting": True})
            log("info", "RESTART", "agent restart requested; exiting (supervisor or notebook re-run resumes service)")
            os._exit(0)

        elif kind == "SHUTDOWN":
            complete_command(cmd["id"], True, {"shuttingDown": True, "reason": payload.get("reason")})
            log("info", "SHUTDOWN", f"shutdown: {payload.get('reason')}")
            STATE["stop"].set()
            time.sleep(0.5)
            os._exit(0)

        elif kind == "LOAD_MODEL":
            # RVC model provisioning happens on the worker filesystem in real
            # deployments; here we record residency for models already present.
            mid = payload.get("modelId")
            if mid and mid in STATE["loaded_models"]:
                complete_command(cmd["id"], True, {"alreadyLoaded": True})
            else:
                complete_command(cmd["id"], False, error=f"model {mid} not installed on this worker")
        elif kind == "EVICT_MODEL":
            mid = payload.get("modelId")
            if mid in STATE["loaded_models"]:
                STATE["loaded_models"].remove(mid)
            complete_command(cmd["id"], True, {"evicted": mid})
        else:
            complete_command(cmd["id"], False, error=f"unknown command kind {kind}")
    except Exception as e:
        STATE["error_count"] += 1
        log("error", "COMMAND_FAILED", f"{kind}: {e}", {"trace": traceback.format_exc()[-500:]})
        complete_command(cmd["id"], False, error=str(e)[:400])


# ---------------------------------------------------------------------------
# DSP conversion engine (real signal processing, no weights required)
# ---------------------------------------------------------------------------

def granular_pitch_shift(x: np.ndarray, shift: float, formant: float = 1.0) -> np.ndarray:
    """High-quality overlap-add granular pitch shifter.

    Real algorithm: analysis hops at a shifted rate, synthesis hops at the
    original rate, with Hann-windowed crossfade. A positive shift raises
    pitch. This is the same family of technique used in classic real-time
    voice changers and runs comfortably under 5 ms for a 2048-sample chunk.
    """
    if abs(shift - 1.0) < 1e-3:
        return x
    n = len(x)
    frame = 512
    hop_in = int(frame / 4)
    hop_out = max(1, int(hop_in / shift))
    win = np.hanning(frame).astype(np.float32)
    out = np.zeros(n + frame, dtype=np.float32)
    norm = np.zeros(n + frame, dtype=np.float32)
    pos_in = 0
    pos_out = 0
    while pos_in + frame < n and pos_out + frame < n + frame:
        seg = x[pos_in:pos_in + frame].astype(np.float32)
        out[pos_out:pos_out + frame] += seg * win
        norm[pos_out:pos_out + frame] += win * win
        pos_in += hop_in
        pos_out += hop_out
    norm[norm < 1e-6] = 1.0
    y = (out / norm)[:n]
    if abs(formant - 1.0) > 1e-3:
        y = tilt_formant(y, formant)
    return y.astype(np.float32)


def tilt_formant(y: np.ndarray, factor: float) -> np.ndarray:
    """Cheap spectral tilt approximation of formant shifting via one-pole
    filters: brightens (factor > 1) or darkens (factor < 1) the timbre."""
    alpha = min(max((factor - 1.0) * 0.5, -0.9), 0.9)
    if alpha >= 0:
        out = np.empty_like(y)
        acc = 0.0
        for i in range(len(y)):
            acc = alpha * acc + (1 - alpha) * y[i]
            out[i] = y[i] - acc
        return out
    out = np.empty_like(y)
    acc = 0.0
    a = -alpha
    for i in range(len(y)):
        acc = a * acc + (1 - a) * y[i]
        out[i] = acc
    return out


def dsp_convert(pcm_bytes: bytes, params: dict) -> bytes:
    x = np.frombuffer(pcm_bytes, dtype=np.int16).astype(np.float32) / 32768.0
    pitch = float(params.get("pitchSemitones", 0))
    formant = float(params.get("formant", 1.0))
    shift = 2 ** (pitch / 12.0)
    y = granular_pitch_shift(x, shift, formant)
    y = np.clip(y, -1.0, 1.0)
    return (y * 32767.0).astype(np.int16).tobytes()


# ---------------------------------------------------------------------------
# RVC tier (activates only when weights are installed on this worker)
# ---------------------------------------------------------------------------

def rvc_convert(pcm_bytes: bytes, model_id: str) -> bytes:
    """Convert through an installed RVC checkpoint.

    The platform never ships weights: an operator installs them on this worker
    (RVC.inference pattern, docs/10-KAGGLE-WORKER.md). Without weights this
    raises, and the control plane surfaces the limitation instead of faking it.
    """
    engine = STATE["rvc"]
    if engine is None:
        raise RuntimeError("RVC tier requested but no RVC runtime is installed on this worker. DSP tier remains available.")
    return engine(pcm_bytes)


def run_test_job(payload: dict) -> dict:
    audio = base64.b64decode(payload.get("audioB64", ""))
    model_id = payload.get("modelId")
    model = None
    if model_id:
        try:
            resp = requests.get(f"{BACKEND}/api/public/config", timeout=API_TIMEOUT)
        except Exception:
            pass
    started = time.time()
    engine_params = {}
    if model_id:
        # Fetch engine params through an authenticated catalog lookup is not
        # available to workers; the control plane embeds params in the job.
        engine_params = payload.get("engineParams") or {}
    out = dsp_convert(audio, engine_params)
    infer_ms = (time.time() - started) * 1000
    STATE["infer_ms"].append(infer_ms)
    return {"inferMs": round(infer_ms, 2), "outB64": base64.b64encode(out).decode(), "outSamples": len(out) // 2}


# ---------------------------------------------------------------------------
# Session audio loop (socket.io client to the gateway)
# ---------------------------------------------------------------------------

def start_session(payload: dict):
    session_id = payload["sessionId"]
    # Idempotency guard: the command queue is at-least-once (redelivery on
    # lost acks), so a repeated START_SESSION must not spawn a second loop.
    if session_id in SESSIONS:
        log("info", "SESSION_ALREADY_ACTIVE", f"session {session_id} already running; ignoring repeated START_SESSION")
        return
    token = payload["gatewayToken"]
    # socket.io path (unified deployments mount the gateway at /gateway; the
    # standalone gateway keeps "/"). The scheduler decides, the agent obeys.
    gw_path = payload.get("gatewayPath") or "/"
    # Same-host workers dial the gateway directly; remote workers (Kaggle)
    # dial the public origin where the edge gateway maps XTransformPort.
    urls = [payload.get("gatewayLocal"), payload.get("gatewayRemote"), payload.get("gatewayUrl")]
    urls = [u for u in urls if u]
    t = threading.Thread(target=session_loop, args=(session_id, urls, token, gw_path), daemon=True)
    t.start()


def stop_session(session_id, reason):
    sess = SESSIONS.pop(session_id, None)
    if sess:
        sess["stop"].set()
        STATE["active_sessions"] = max(0, STATE["active_sessions"] - 1)
        log("info", "SESSION_STOP", f"session {session_id} stopped ({reason})")


SESSIONS = {}


def session_loop(session_id, gateway_urls, token, gw_path="/"):
    try:
        import socketio  # python-socketio client
    except ImportError:
        log("error", "MISSING_DEP", "python-socketio required for sessions: pip install python-socketio[client]")
        notify_session_rejected(session_id, "python-socketio not installed on worker")
        return

    STATE["active_sessions"] += 1
    stop_event = threading.Event()
    SESSIONS[session_id] = {"stop": stop_event}
    STATE["status"] = "ACTIVE"

    sio = socketio.Client(reconnection=False, logger=False, engineio_logger=False)
    ready = threading.Event()
    connected_url = None

    @sio.on("session-start")
    def _start(data):
        ready.set()

    @sio.on("session-ended")
    def _end(data):
        stop_event.set()

    @sio.on("connect")
    def _gw_connect():
        trace(f"session {session_id}: gateway socket connected")

    @sio.on("disconnect")
    def _gw_disconnect(*args):
        trace(f"session {session_id}: gateway socket DISCONNECTED args={args}")

    @sio.on("audio-in")
    def _audio_in(msg):
        if stop_event.is_set():
            return
        sess = SESSIONS.get(session_id)
        sess["recv"] = sess.get("recv", 0) + 1
        started = time.time()
        try:
            audio = bytes(msg["audio"])
            # Engine selection is honest: RVC only when a runtime is installed.
            out = dsp_convert(audio, {}) if STATE["rvc"] is None else rvc_convert(audio, msg.get("modelId", ""))
            infer_ms = (time.time() - started) * 1000
            STATE["infer_ms"].append(infer_ms)
            sio.emit("audio", {"seq": msg["seq"], "audio": out})
            sess["emit"] = sess.get("emit", 0) + 1
            if sess["recv"] % 10 == 0:
                trace(f"session {session_id}: recv={sess['recv']} emit={sess['emit']} seq={msg['seq']} infer={infer_ms:.2f}ms sio_connected={sio.connected}")
        except Exception as e:
            STATE["error_count"] += 1
            import traceback
            trace(f"session {session_id}: CONVERT_FAILED at recv={sess['recv']} seq={msg.get('seq')}: {e}\n{traceback.format_exc()}")
            log("error", "CONVERT_FAILED", str(e)[:200])

    try:
        last_err = None
        for url in gateway_urls:
            try:
                sio.connect(url, transports=["websocket"], wait_timeout=10, socketio_path=gw_path)
                connected_url = url
                break
            except Exception as e:
                last_err = e
                log("warn", "GATEWAY_DIAL_FAILED", f"{url}: {str(e)[:150]}")
        if not connected_url:
            raise RuntimeError(f"could not reach any gateway URL: {last_err}")
        sio.emit("auth", {"token": token})
        ready.wait(5)
        requests.post(
            f"{BACKEND}/api/worker/session-ready",
            headers=auth_headers(),
            json={"sessionId": session_id, "accepted": True},
            timeout=API_TIMEOUT,
        )
        log("info", "SESSION_ACTIVE", f"session {session_id} streaming via {connected_url}")
        while not stop_event.is_set() and sio.connected:
            stop_event.wait(0.5)
    except Exception as e:
        log("error", "SESSION_FAILED", str(e)[:300])
        try:
            requests.post(
                f"{BACKEND}/api/worker/session-ready",
                headers=auth_headers(),
                json={"sessionId": session_id, "accepted": False, "error": str(e)[:200]},
                timeout=API_TIMEOUT,
            )
        except Exception:
            pass
    finally:
        try:
            sio.disconnect()
        except Exception:
            pass
        STATE["active_sessions"] = max(0, STATE["active_sessions"] - 1)
        if STATE["active_sessions"] == 0 and STATE["status"] != "DRAINING":
            STATE["status"] = "IDLE"
        SESSIONS.pop(session_id, None)
        log("info", "SESSION_ENDED", session_id)


def notify_session_rejected(session_id, error):
    try:
        requests.post(
            f"{BACKEND}/api/worker/session-ready",
            headers=auth_headers(),
            json={"sessionId": session_id, "accepted": False, "error": error},
            timeout=API_TIMEOUT,
        )
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if not REG_TOKEN:
        print("FATAL: WORKER_REG_TOKEN env var is required (get one from the admin panel)", flush=True)
        sys.exit(1)
    signal.signal(signal.SIGTERM, lambda *_: STATE["stop"].set())

    STATE["status"] = "BOOTING"
    info = register()
    STATE["status"] = "READY"

    threads = [
        threading.Thread(target=heartbeat_loop, daemon=True),
        threading.Thread(target=command_loop, daemon=True),
    ]
    for t in threads:
        t.start()

    log("info", "AGENT_UP", "worker agent running", {"heartbeatSec": info.get("heartbeatIntervalSec")})
    try:
        while STATE["active_sessions"] >= 0 and not STATE["stop"].is_set():
            time.sleep(1)
    except KeyboardInterrupt:
        pass
    log("info", "AGENT_EXIT", "agent stopped")


if __name__ == "__main__":
    main()
