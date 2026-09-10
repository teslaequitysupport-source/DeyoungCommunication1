// VoxCore audio worklets: capture and playback for the real-time studio.
// Loaded via audioContext.audioWorklet.addModule('/worklets/vox-worklet.js').

// Capture processor: accumulates input into CHUNK-sized blocks and posts them
// as Float32Array to the main thread. CHUNK must match the control-plane
// chunkMs setting (default 128 ms at 16 kHz = 2048 samples).
class VoxCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const opts = (options && options.processorOptions) || {};
    this.chunkSamples = opts.chunkSamples || 2048;
    this.buffer = new Float32Array(this.chunkSamples);
    this.filled = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const ch = input[0];
    if (!ch) return true;
    let i = 0;
    while (i < ch.length) {
      const space = this.chunkSamples - this.filled;
      const take = Math.min(space, ch.length - i);
      for (let k = 0; k < take; k++) {
        this.buffer[this.filled + k] = ch[i + k];
      }
      this.filled += take;
      i += take;
      if (this.filled === this.chunkSamples) {
        this.port.postMessage({ type: "chunk", data: this.buffer.slice(0) });
        this.filled = 0;
      }
    }
    return true;
  }
}
registerProcessor("vox-capture", VoxCaptureProcessor);

// Playback processor: lock-free ring buffer fed from the main thread with
// converted Float32 chunks; drains to output. Underruns output silence and
// report the fill level so the UI can show buffer health.
class VoxPlaybackProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(32768);
    this.readPos = 0;
    this.writePos = 0;
    this.available = 0;
    this.port.onmessage = (e) => {
      if (e.data && e.data.type === "play") {
        const data = e.data.data;
        const cap = this.ring.length;
        const write = Math.min(data.length, cap - this.available);
        for (let i = 0; i < write; i++) {
          this.ring[this.writePos] = data[i];
          this.writePos = (this.writePos + 1) % cap;
        }
        this.available += write;
      }
    };
  }

  process(inputs, outputs) {
    const out = outputs[0][0];
    if (!out) return true;
    const cap = this.ring.length;
    const n = Math.min(out.length, this.available);
    for (let i = 0; i < n; i++) {
      out[i] = this.ring[this.readPos];
      this.readPos = (this.readPos + 1) % cap;
    }
    this.available -= n;
    for (let i = n; i < out.length; i++) out[i] = 0;
    if (this.available < 2048) {
      this.port.postMessage({ type: "underrun", available: this.available });
    }
    return true;
  }
}
registerProcessor("vox-playback", VoxPlaybackProcessor);
