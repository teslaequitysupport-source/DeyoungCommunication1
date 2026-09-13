#!/usr/bin/env node
// Codemod: enforce the strict red/black/white palette across VoxCore views.
// Multi-class literals first (semantic mappings), then single-token fallbacks.
// Idempotent: running twice changes nothing.
import { readFileSync, writeFileSync } from "node:fs";

const files = [
  "src/components/admin/admin-panels.tsx",
  "src/components/admin/admin-shell.tsx",
  "src/components/app/dashboard.tsx",
  "src/components/app/studio.tsx",
  "src/components/app/models-view.tsx",
  "src/components/app/account-view.tsx",
  "src/components/app/support-view.tsx",
  "src/components/app/billing-view.tsx",
  "src/components/app/auth-view.tsx",
  "src/components/app/legal.tsx",
  "src/components/app/app-shell.tsx",
  "src/components/app/landing.tsx",
];

// ordered: longest / most specific first
const LITERAL = [
  // emerald (positive) -> solid white badge / white text
  ['"bg-emerald-950 text-emerald-300 border-emerald-800"', '"bg-white text-zinc-950 border-white"'],
  ["bg-emerald-700 hover:bg-emerald-600", "bg-white text-zinc-950 hover:bg-zinc-200"],
  ["text-emerald-600 dark:text-emerald-400", "text-white"],
  ["text-emerald-500", "text-white"],
  ["text-emerald-400", "text-zinc-100"],
  ["text-emerald-300", "text-zinc-100"],
  ["bg-emerald-500", "bg-white"],
  // amber (pending/warning) -> hollow white
  ['"bg-amber-950 text-amber-300 border-amber-800"', '"border-white/30 bg-transparent text-zinc-100"'],
  ["border-amber-800 bg-amber-950/30", "border-white/25 bg-white/5"],
  ["border-amber-800 bg-amber-950/40", "border-white/25 bg-white/5"],
  ["bg-amber-950/30", "bg-white/5"],
  ["bg-amber-950/40", "bg-white/5"],
  ["bg-amber-950/60", "bg-white/10"],
  ["border-amber-800", "border-white/25"],
  ["border-amber-700", "border-white/30"],
  ["bg-amber-950", "bg-white/5"],
  ["text-amber-500", "text-zinc-300"],
  ["text-amber-400", "text-zinc-200"],
  ["text-amber-300", "text-zinc-100"],
  ["text-amber-200", "text-zinc-100"],
  ["text-amber-100", "text-zinc-100"],
  ["text-amber-600 dark:text-amber-400", "text-zinc-200"],
];

// hue swaps: same shade number, same utility
function hueSwap(src) {
  return src
    .replace(/\bviolet-(\d+)\b/g, "red-$1")
    .replace(/\brose-(\d+)\b/g, "red-$1")
    .replace(/\bamber-(\d+)\b/g, "red-$1")
    .replace(/\bemerald-(\d+)\b/g, "zinc-$1");
}

let totalChanges = 0;
for (const f of files) {
  let src;
  try {
    src = readFileSync(f, "utf8");
  } catch {
    console.log(`SKIP (missing): ${f}`);
    continue;
  }
  const before = src;
  for (const [from, to] of LITERAL) src = src.split(from).join(to);
  src = hueSwap(src);
  if (src !== before) {
    writeFileSync(f, src);
    totalChanges++;
    console.log(`UPDATED: ${f}`);
  }
}
console.log(`Done. ${totalChanges} file(s) modified.`);
