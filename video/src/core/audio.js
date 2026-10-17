// Musical clock + audio envelopes (from analysis/ -> video/data/audio.json).
// Verified grid: 126 BPM, beat n at t = B0 + n*SPB; downbeats on n % 4 == 0; 16-beat phrases.
import { clamp } from './util.js';
export const A = { data: null };
export let SPB = 60 / 126, B0 = 0.0532;
export async function loadAudio(url) {
  const d = await (await fetch(url)).json();
  A.data = d; SPB = d.spb; B0 = d.b0;
  // pre-build kick impulse table per frame for fast lookups
  const N = d.frames, k = new Float32Array(N), s = new Float32Array(N);
  const fill = (arr, list, decay) => { for (const t0 of list) { const f0 = Math.ceil(t0 * 30); for (let f = f0; f < Math.min(N, f0 + 20); f++) arr[f] = Math.max(arr[f], Math.exp(-(f / 30 - t0) * decay)); } };
  fill(k, d.kicks, 9); fill(s, d.snares, 11);
  d.kickImp = k; d.snareImp = s;
  return d;
}
export const tb = n => B0 + n * SPB;              // time of beat n
export const bt = t => (t - B0) / SPB;            // beat (float) at time t
export function env(name, t) {
  const d = A.data; if (!d) return 0; const arr = d.env[name];
  const f = clamp(t * 30, 0, d.frames - 1), i = Math.floor(f), u = f - i;
  return arr[i] * (1 - u) + (arr[Math.min(i + 1, d.frames - 1)] || 0) * u;
}
export function kick(t) { const d = A.data; const i = Math.floor(clamp(t * 30, 0, d.frames - 1)); return d.kickImp[i]; }
export function snare(t) { const d = A.data; const i = Math.floor(clamp(t * 30, 0, d.frames - 1)); return d.snareImp[i]; }
// pulse that peaks on every beat and decays
export function beatPulse(t, decay = 5, every = 1) { const b = bt(t) / every; const f = b - Math.floor(b); return b < 0 ? 0 : Math.exp(-f * every * SPB * decay * 2); }
export function subOn(t) { const e = A.data.subEdges; let on = 0; for (const [tt, v] of e) { if (tt > t) break; on = v; } return on; }

// Song map (beats) — derived from our own analysis, cross-checked with the supplied package.
export const MAP = {
  intro: 0,          // 0.05s  sparse beat + vocals, no 808
  firstHit: 12,      // 5.77s  first impact
  sub1: 48,          // 22.91s 808 enters (WIN I)
  win2: 64,          // 30.53s
  break1: 76,        // 36.24s 2-bar sub break
  drop1: 80,         // 38.15s big drop (WIN III)
  win4: 112,         // 53.39s
  verse2: 142,       // 67.67s continuous-808 section
  win5: 144, win6: 176,
  build: 180,        // 85.77s transition
  sub3: 192,         // 91.48s
  stop2: 204,        // 97.20s hit then 2-beat silence
  drop2: 208,        // 99.10s big drop (WIN VII)
  win8: 240,         // 114.34s
  bridge: 272,       // 129.58s 808 out (WIN IX, quiet)
  drop3: 304,        // 144.81s final drop (WIN X)
  end: 336,          // 160.05s music ends ~160.7s, silence to 163.5s
};
