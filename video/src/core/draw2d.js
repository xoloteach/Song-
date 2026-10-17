// 2D motion-graphics language: ink strokes, tally marks, Roman numerals, kinetic type, halftone, panels,
// speed lines. Anime.js timelines (seeked, never auto-played) choreograph the typography.
import { createTimeline, stagger } from '../../vendor/anime.esm.js';
import { clamp, lerp, ease, hash, hash2, noise1, PI, TAU } from './util.js';

export const INK = '#f2ead8', GOLD = '#ffcf6b', GOLD2 = '#f5a83a', EMBER = '#ff5a36', NIGHT = '#0a0d1a', CYAN = '#7fd6ff';
export const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
export const WORDS = ['ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];

export function font(ctx, size, fam = 'Big Shoulders', weight = 700) { ctx.font = `${weight} ${size}px "${fam}"`; }
export function text(ctx, s, x, y, o = {}) {
  ctx.save(); font(ctx, o.size || 40, o.fam, o.weight); ctx.fillStyle = o.color || INK; ctx.globalAlpha *= o.alpha ?? 1;
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'alphabetic'; ctx.letterSpacing = (o.track || 0) + 'px';
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = o.lw || 2; ctx.strokeText(s, x, y); } else ctx.fillText(s, x, y);
  ctx.restore();
}
// brush/ink stroke along points with tapering + deterministic wobble; progress 0..1 draws it on
export function inkStroke(ctx, pts, w, prog = 1, o = {}) {
  if (prog <= 0 || pts.length < 2) return; const seed = o.seed || 1;
  const total = []; let L = 0; for (let i = 1; i < pts.length; i++) { L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); total.push(L); }
  const steps = Math.max(8, Math.floor(L / 3)), end = prog * L;
  const at = (d) => { let i = 0; while (i < total.length - 1 && total[i] < d) i++; const d0 = i ? total[i - 1] : 0; const u = (d - d0) / Math.max(1e-6, total[i] - d0);
    return [lerp(pts[i][0], pts[i + 1][0], u), lerp(pts[i][1], pts[i + 1][1], u)]; };
  const left = [], right = [];
  for (let k = 0; k <= steps; k++) { const d = Math.min(end, k / steps * L); const p = at(d), q = at(Math.min(L, d + 1));
    let nx = -(q[1] - p[1]), ny = q[0] - p[0]; const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl;
    const u = d / L, taper = Math.pow(Math.sin(clamp(u, 0, 1) * PI), .35) * (o.flat ? 1 : 1) * (1 + .18 * noise1(d * .05, seed));
    const ww = w * (o.taper === false ? 1 : taper) * .5; left.push([p[0] + nx * ww, p[1] + ny * ww]); right.push([p[0] - nx * ww, p[1] - ny * ww]); if (d >= end) break; }
  ctx.beginPath(); ctx.moveTo(left[0][0], left[0][1]); for (const p of left) ctx.lineTo(p[0], p[1]); for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath(); ctx.fillStyle = o.color || INK; ctx.fill();
}
// a single tally group of up to 5 strokes (4 verticals + diagonal)
export function tally(ctx, count, x, y, h, o = {}) {
  const gap = h * .22, w = h * .09; let drawn = 0;
  for (let g = 0; g * 5 < count; g++) {
    const gx = x + g * (gap * 4 + h * .55);
    for (let i = 0; i < Math.min(4, count - g * 5); i++) {
      const p = clamp((count - g * 5 - i) * 1, 0, 1); const j = hash2(g * 5 + i, 3) - .5;
      const lastP = (g * 5 + i === Math.floor(count - .0001)) ? (o.lastProg ?? 1) : 1;
      inkStroke(ctx, [[gx + i * gap + j * 6, y + h * .05], [gx + i * gap - j * 4, y + h]], w, p * lastP, { color: o.color, seed: g * 5 + i });
    }
    if (count - g * 5 >= 5) { const lastP = (g * 5 + 4 === Math.floor(count - .0001)) ? (o.lastProg ?? 1) : 1;
      inkStroke(ctx, [[gx - gap * .5, y + h * .8], [gx + gap * 3.5, y + h * .15]], w * 1.1, lastP, { color: o.color2 || o.color, seed: 99 + g }); }
  }
}
export function ring(ctx, x, y, r, w, prog = 1, o = {}) {
  const pts = []; const n = 120, a0 = o.a0 ?? -PI / 2;
  for (let i = 0; i <= n; i++) { const a = a0 + i / n * TAU * (o.turns || 1.04); const rr = r * (1 + .02 * noise1(i * .2, o.seed || 4)); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
  inkStroke(ctx, pts, w, prog, o);
}
// brush X (two crossing strokes) — the TEN motif
export function brushX(ctx, x, y, s, w, prog = 1, o = {}) {
  const p1 = clamp(prog * 2), p2 = clamp(prog * 2 - 1);
  inkStroke(ctx, [[x - s, y - s], [x + s * .1, y + s * .05], [x + s, y + s]], w, p1, { ...o, seed: 11 });
  inkStroke(ctx, [[x + s, y - s], [x - s * .05, y + s * .1], [x - s, y + s]], w, p2, { ...o, seed: 12 });
}
export function speedLines(ctx, cx, cy, n, r0, r1, t, o = {}) {
  ctx.save(); ctx.strokeStyle = o.color || INK; ctx.globalAlpha *= o.alpha ?? .6;
  for (let i = 0; i < n; i++) { const a = hash(i * 13 + 1) * TAU, ph = (hash(i * 7 + 2) + t * (o.speed || 2)) % 1, len = (r1 - r0) * (.2 + .5 * hash(i * 3 + 5));
    const ra = r0 + ph * (r1 - r0), rb = ra + len * (1 - ph * .5); ctx.lineWidth = (o.w || 3) * (.5 + hash(i)); ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * ra, cy + Math.sin(a) * ra); ctx.lineTo(cx + Math.cos(a) * rb, cy + Math.sin(a) * rb); ctx.stroke(); }
  ctx.restore();
}
export function hLines(ctx, n, t, o = {}) { // horizontal motion streaks (side-scroll momentum)
  ctx.save(); ctx.fillStyle = o.color || INK; ctx.globalAlpha *= o.alpha ?? .5;
  for (let i = 0; i < n; i++) { const y = hash(i * 5 + 1) * 1080, len = 200 + hash(i * 9) * 700, sp = 1500 + hash(i * 3) * 3000; const x = 1920 - ((hash(i * 11) * 3000 + t * sp) % (3000 + len)) ;
    ctx.fillRect(x, y, len, 1 + hash(i * 2) * 3); }
  ctx.restore();
}
export function halftoneRect(ctx, x, y, w, h, o = {}) {
  ctx.save(); ctx.fillStyle = o.color || INK; ctx.globalAlpha *= o.alpha ?? 1; const s = o.cell || 14;
  for (let yy = y; yy < y + h; yy += s) for (let xx = x + ((yy / s) % 2) * s / 2; xx < x + w; xx += s) {
    const g = o.grad ? o.grad((xx - x) / w, (yy - y) / h) : .5; const r = s * .5 * Math.sqrt(clamp(g)); if (r < .3) continue;
    ctx.beginPath(); ctx.arc(xx, yy, r, 0, TAU); ctx.fill(); }
  ctx.restore();
}
export function panelFrame(ctx, x, y, w, h, o = {}) {
  ctx.save(); ctx.lineWidth = o.lw || 10; ctx.strokeStyle = o.color || INK; ctx.lineJoin = 'miter';
  if (o.shadow) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(x + 14, y + 14, w, h); }
  ctx.strokeRect(x, y, w, h); ctx.restore();
}
export function starburst(ctx, x, y, r0, r1, n, rot, o = {}) {
  ctx.save(); ctx.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i / (n * 2) * TAU; const r = i % 2 ? r0 : r1 * (.75 + .25 * hash(i + (o.seed || 0)));
    const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.closePath(); ctx.fillStyle = o.color || GOLD; ctx.globalAlpha *= o.alpha ?? 1; ctx.fill(); ctx.restore();
}
// SVG path data for small emblems (drawn with Path2D)
export const SVG = {
  crown: new Path2D('M-50 30 L-58 -24 L-28 4 L0 -36 L28 4 L58 -24 L50 30 Z'),
  laurelLeaf: new Path2D('M0 0 C 10 -14 30 -16 44 -6 C 30 4 12 8 0 0 Z'),
  chevron: new Path2D('M-30 -40 L10 0 L-30 40 L-14 40 L26 0 L-14 -40 Z'),
  bolt: new Path2D('M-8 -40 L18 -40 L4 -6 L22 -6 L-14 42 L-2 6 L-20 6 Z'),
};
export function laurel(ctx, x, y, r, prog, o = {}) {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = o.color || GOLD;
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) { const p = clamp(prog * 9 - i); if (p <= 0) continue;
    const a = PI / 2 + side * (.35 + i * .27); ctx.save(); ctx.translate(Math.cos(a) * r, Math.sin(a) * r); ctx.rotate(a + side * PI / 2 + (side < 0 ? PI : 0) + side * .5);
    ctx.scale(p * (1 - i * .04) * (side < 0 ? -1 : 1), p * (1 - i * .04)); ctx.fill(SVG.laurelLeaf); ctx.restore(); }
  ctx.restore();
}

// ------------- Anime.js typography choreographies -------------
// Each returns { state, tl } — scenes call tl.seek(ms) with local time, then read the animated state.
export function winCardTimeline(n) {
  const S = { scale: 3.2, alpha: 0, blur: 1, ruleW: 0, wordA: 0, wordY: 40, letters: ROMAN[n].split('').map(() => ({ y: -120, a: 0, r: 0 })), out: 0, ringP: 0 };
  const tl = createTimeline({ autoplay: false });
  tl.add(S, { scale: [3.2, 1], alpha: [0, 1], blur: [1, 0], duration: 260, ease: 'outExpo' }, 0)
    .add(S.letters, { y: [-120, 0], a: [0, 1], r: [() => 0, 0], duration: 420, delay: stagger(60), ease: 'outBack(2.2)' }, 0)
    .add(S, { ruleW: [0, 1], duration: 520, ease: 'inOutQuart' }, 120)
    .add(S, { ringP: [0, 1], duration: 700, ease: 'outQuart' }, 60)
    .add(S, { wordA: [0, 1], wordY: [40, 0], duration: 380, ease: 'outCubic' }, 260)
    .add(S, { out: [0, 1], duration: 360, ease: 'inQuart' }, 1500);
  return { S, tl };
}
export function drawWinCard(ctx, n, ms, o = {}) {
  const c = o.cache || (o.cache = {}); if (!c[n]) c[n] = winCardTimeline(n);
  const { S, tl } = c[n]; tl.seek(clamp(ms, 0, 2000));
  if (ms < 0 || ms > 1900) return;
  const cx = o.x ?? 960, cy = o.y ?? 470, H = o.h ?? 330, col = o.color || GOLD;
  ctx.save(); ctx.globalAlpha = S.alpha * (1 - S.out); ctx.translate(cx, cy - S.out * 60); ctx.scale(S.scale, S.scale);
  // ring
  ring(ctx, 0, -H * .32, H * .62, 7, S.ringP, { color: col, seed: n });
  font(ctx, H); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const s = ROMAN[n]; const widths = s.split('').map(ch => ctx.measureText(ch).width); const tw = widths.reduce((a, b) => a + b, 0) + (s.length - 1) * H * .03;
  let x = -tw / 2;
  s.split('').forEach((ch, i) => { const L = S.letters[i]; ctx.save(); ctx.globalAlpha *= L.a; ctx.fillStyle = col; ctx.translate(x + widths[i] / 2, L.y); ctx.shadowColor = 'rgba(255,170,60,.6)'; ctx.shadowBlur = 30; ctx.fillText(ch, 0, 0); ctx.restore(); x += widths[i] + H * .03; });
  ctx.fillStyle = col; ctx.fillRect(-H * .9 * S.ruleW, 30, H * 1.8 * S.ruleW, 6);
  ctx.globalAlpha *= S.wordA; text(ctx, `W I N   ${String(n).padStart(2, '0')}  —  ${WORDS[n]}`, 0, 92 + S.wordY, { size: 40, fam: 'JetBrains Mono', weight: 700, align: 'center', color: INK, track: 6 });
  ctx.restore();
}
// generic seeked tween helper on top of anime (for scenes needing quick one-offs)
export function seekTL(build) { const S = {}; const tl = createTimeline({ autoplay: false }); build(tl, S); return (ms) => { tl.seek(Math.max(0, ms)); return S; }; }
