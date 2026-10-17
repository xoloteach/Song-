// Deterministic math / easing / noise helpers. Everything in the film is a pure function of time.
export const PI = Math.PI, TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, x) => clamp((x - a) / (b - a));
export const remap = (x, a, b, c, d) => lerp(c, d, invLerp(a, b, x));
export const smooth = t => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smoother = t => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
export const fract = x => x - Math.floor(x);
export const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inQuart: t => t * t * t * t,
  inOutQuart: t => t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  inOutExpo: t => t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
  inOutBack: t => { const c1 = 1.70158 * 1.525; return t < .5 ? (Math.pow(2 * t, 2) * ((c1 + 1) * 2 * t - c1)) / 2 : (Math.pow(2 * t - 2, 2) * ((c1 + 1) * (t * 2 - 2) + c1) + 2) / 2; },
  outElastic: t => t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1,
  outSine: t => Math.sin(t * PI / 2),
  inOutSine: t => -(Math.cos(PI * t) - 1) / 2,
};
export const E = ease;

// integer hash -> [0,1)
export function hash(n) {
  n = (n | 0) ^ 0x9e3779b9; n = Math.imul(n ^ (n >>> 16), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
// 1D value noise, smooth, deterministic
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed), hash2(i + 1, seed), u) * 2 - 1;
}
export const fbm1 = (x, seed = 0) => noise1(x, seed) * .6 + noise1(x * 2.1, seed + 7) * .3 + noise1(x * 4.3, seed + 13) * .1;

// time-window helpers
export const win = (t, a, b) => t >= a && t < b;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
// impulse that starts at t0 and decays (attack ~0)
export const impulse = (t, t0, decay = 6) => t < t0 ? 0 : Math.exp(-(t - t0) * decay);
// smooth bump inside [a,b] with fade time f
export const bump = (t, a, b, f = .2) => smooth((t - a) / f) * (1 - smooth((t - (b - f)) / f));

// Catmull-Rom over arrays of [t, x, y, z,...] keys (sorted by t)
export function spline(keys, t) {
  const n = keys.length; if (t <= keys[0][0]) return keys[0].slice(1); if (t >= keys[n - 1][0]) return keys[n - 1].slice(1);
  let i = 0; while (i < n - 2 && t > keys[i + 1][0]) i++;
  const k0 = keys[Math.max(0, i - 1)], k1 = keys[i], k2 = keys[i + 1], k3 = keys[Math.min(n - 1, i + 2)];
  const u = (t - k1[0]) / (k2[0] - k1[0]);
  const out = [];
  for (let d = 1; d < k1.length; d++) {
    const p0 = k0[d], p1 = k1[d], p2 = k2[d], p3 = k3[d];
    const u2 = u * u, u3 = u2 * u;
    out.push(.5 * ((2 * p1) + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 + (-p0 + 3 * p1 - 3 * p2 + p3) * u3));
  }
  return out;
}
// eased keyframes: keys [[t, value(s)..., easeName?]] — eases INTO each key
export function keys(ks, t) {
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t < ks[i][0]) {
      const a = ks[i - 1], b = ks[i], e = ease[b[2] || 'inOutCubic'];
      const u = e((t - a[0]) / (b[0] - a[0]));
      if (Array.isArray(a[1])) return a[1].map((v, j) => lerp(v, b[1][j], u));
      return lerp(a[1], b[1], u);
    }
  }
  return ks[ks.length - 1][1];
}
export const hex = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
export const srgbToLinear = c => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
export const hexLin = h => hex(h).map(srgbToLinear);
