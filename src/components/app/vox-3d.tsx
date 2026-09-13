"use client";

import { useEffect, useRef } from "react";

// Vox3D — dependency-free 3D renderer for the hero. A fibonacci-distributed
// sphere of radial bars whose lengths pulse in layered waves, like a voice
// waveform wrapped around a globe. Perspective projection, mouse parallax,
// depth-shaded red/white palette, drawn as glowing line segments.
//
// Honors the administrator animation switch (SiteConfig.animationIntensity):
//   OFF    -> one static frame, no loop
//   SUBTLE -> slow rotation, reduced pulse
//   FULL   -> full motion
// And prefers-reduced-motion is treated exactly like OFF.

export type AnimIntensity = "OFF" | "SUBTLE" | "FULL" | undefined;

interface Vox3DProps {
  className?: string;
  intensity?: AnimIntensity;
}

const RED = [225, 29, 46] as const; // #e11d2e - the one disciplined red
const RED_BRIGHT = [255, 92, 102] as const; // depth-shaded bright step of the same hue
const WHITE = [255, 255, 255] as const;

export default function Vox3D({ className, intensity = "FULL" }: Vox3DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intensityRef = useRef<AnimIntensity>(intensity);

  // Keep the animation loop's view of the admin intensity switch fresh
  // without re-initializing the renderer.
  useEffect(() => {
    intensityRef.current = intensity;
  }, [intensity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const staticFrame = reduced || intensityRef.current === "OFF";

    let raf = 0;
    let running = true;
    let visible = true;
    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.75);

    // --- geometry -----------------------------------------------------------
    const BAR_COUNT = 420;
    const DUST_COUNT = 150;
    const bars: { x: number; y: number; z: number; phase: number; speed: number }[] = [];
    const GA = Math.PI * (3 - Math.sqrt(5)); // golden angle
    for (let i = 0; i < BAR_COUNT; i++) {
      const y = 1 - (i / (BAR_COUNT - 1)) * 2; // -1..1
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const th = GA * i;
      bars.push({
        x: Math.cos(th) * r,
        y,
        z: Math.sin(th) * r,
        phase: (i * 0.618) % (Math.PI * 2),
        speed: 0.6 + ((i * 0.37) % 1) * 0.8,
      });
    }
    const dust: { x: number; y: number; z: number; s: number }[] = [];
    for (let i = 0; i < DUST_COUNT; i++) {
      // random shell 1.4..3.2
      const u = Math.random() * 2 - 1;
      const t = Math.random() * Math.PI * 2;
      const r = 1.4 + Math.random() * 1.8;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      dust.push({ x: Math.cos(t) * s * r, y: u * r, z: Math.sin(t) * s * r, s: 0.4 + Math.random() * 1.1 });
    }

    // --- interaction state --------------------------------------------------
    let yaw = 0;
    let pitch = -0.12;
    let targetPitch = -0.12;
    let yawVel = 0;
    let mouseX = 0;
    let mouseY = 0;

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = ((e.clientY - rect.top) / rect.height) * 2 - 1;
      targetPitch = -0.12 + mouseY * 0.28;
    };

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      width = parent.clientWidth;
      height = parent.clientHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    resize();
    window.addEventListener("mousemove", onMouse, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0.02 }
    );
    io.observe(canvas);

    const onVis = () => {
      running = !document.hidden;
      if (running && !staticFrame) loop(performance.now());
    };
    document.addEventListener("visibilitychange", onVis);

    // --- math helpers -------------------------------------------------------
    // rotate around Y then X, then perspective-project. Returns screen coords + depth.
    const project = (
      x: number, y: number, z: number,
      cy: number, sy: number, cx: number, sx: number,
      w: number, h: number, scale: number
    ) => {
      const x1 = cy * x + sy * z;
      const z1 = -sy * x + cy * z;
      const y2 = cx * y - sx * z1;
      const z2 = sx * y + cx * z1;
      const persp = 3.2 / (3.2 + z2);
      return {
        sx: w / 2 + x1 * persp * scale,
        sy: h / 2 + y2 * persp * scale,
        depth: z2, // -1 front .. 1 back approx (pre-projection)
      };
    };

    const rgba = (c: readonly number[], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

    // --- draw ---------------------------------------------------------------
    const draw = (now: number) => {
      const t = now / 1000;
      const inten = intensityRef.current;
      const speed = inten === "SUBTLE" ? 0.35 : 1;
      const amp = inten === "SUBTLE" ? 0.45 : 1;

      // ease pitch, accumulate yaw (mouse adds a gentle yaw offset via velocity)
      pitch += (targetPitch - pitch) * 0.045;
      const targetYawVel = (staticFrame ? 0 : 0.0016 * speed) + mouseX * 0.004 * speed;
      yawVel += (targetYawVel - yawVel) * 0.03;
      yaw += yawVel * (staticFrame ? 0 : 16.7);

      const cy = Math.cos(yaw), sy = Math.sin(yaw);
      const cx = Math.cos(pitch), sx = Math.sin(pitch);
      const scale = Math.min(width, height) * 0.31;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      // dust field (far, dim, white) ------------------------------------------------
      for (const d of dust) {
        const p = project(d.x, d.y, d.z, cy, sy, cx, sx, width, height, scale);
        const a = 0.05 + (1 - Math.min(1, Math.abs(p.depth) / 3.2)) * 0.16;
        ctx.fillStyle = rgba(WHITE, a);
        const sz = d.s * 0.9;
        ctx.fillRect(p.sx, p.sy, sz, sz);
      }

      // structural great-circles: equator + two meridians, faint white ----------------
      const rings: Array<(th: number) => [number, number, number]> = [
        (th) => [Math.cos(th), 0, Math.sin(th)], // equator (xz)
        (th) => [Math.cos(th), Math.sin(th), 0], // meridian (xy)
        (th) => [0, Math.cos(th), Math.sin(th)], // meridian (yz)
      ];
      ctx.lineWidth = 1;
      for (const ring of rings) {
        ctx.beginPath();
        const SEG = 90;
        for (let i = 0; i <= SEG; i++) {
          const [x, y, z] = ring((i / SEG) * Math.PI * 2);
          const p = project(x, y, z, cy, sy, cx, sx, width, height, scale);
          if (i === 0) ctx.moveTo(p.sx, p.sy);
          else ctx.lineTo(p.sx, p.sy);
        }
        ctx.strokeStyle = rgba(WHITE, 0.07);
        ctx.stroke();
      }

      // voiceform bars ----------------------------------------------------------------
      for (const b of bars) {
        // layered sine "speech" envelope: slow drift + fast shimmer keyed to position
        const env =
          0.5 +
          0.5 * Math.sin(t * 0.9 * b.speed + b.phase + b.y * 2.4) *
          Math.sin(t * 2.3 + b.x * 3.1 + b.z * 1.7);
        const len = (0.05 + 0.34 * env * amp) * (1 + 0.15 * Math.sin(t * 5.1 + b.phase * 3.0) * amp);
        const r0 = 1.0;
        const r1 = 1.0 + len;

        const a = project(b.x * r0, b.y * r0, b.z * r0, cy, sy, cx, sx, width, height, scale);
        const bp = project(b.x * r1, b.y * r1, b.z * r1, cy, sy, cx, sx, width, height, scale);

        // depth: front positive
        const front = Math.max(0, 1 - (a.depth + 1) / 2); // 0..1
        const alpha = 0.05 + front * 0.6;
        const peak = env > 0.82 && front > 0.55;
        const col = peak ? WHITE : front > 0.72 ? RED_BRIGHT : RED;

        ctx.strokeStyle = rgba(col, peak ? Math.min(1, alpha + 0.35) : alpha);
        ctx.lineWidth = peak ? 2.1 : 0.8 + front * 1.4;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(bp.sx, bp.sy);
        ctx.stroke();

        // bright tip dot on peaks
        if (peak) {
          ctx.fillStyle = rgba(WHITE, 0.8 * front + 0.1);
          ctx.fillRect(bp.sx - 1, bp.sy - 1, 2, 2);
        }
      }

      // core glow -----------------------------------------------------------------------
      const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, scale * 0.9);
      grad.addColorStop(0, rgba(RED, 0.16));
      grad.addColorStop(0.55, rgba(RED, 0.05));
      grad.addColorStop(1, rgba(RED, 0));
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      ctx.globalCompositeOperation = "source-over";
    };

    const loop = (now: number) => {
      if (!running || !visible) return; // resumed by visibility/intersection handlers
      draw(now);
      raf = requestAnimationFrame(loop);
    };

    // visibility resume needs a kicker
    const resumeIfVisible = () => {
      if (running && visible && !staticFrame && !raf) raf = requestAnimationFrame(loop);
    };
    const ioResume = setInterval(resumeIfVisible, 700);

    // first paint (static or animated)
    draw(performance.now());
    if (!staticFrame) raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(ioResume);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
