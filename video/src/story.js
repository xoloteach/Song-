// Global narrative state: the ten wins, the echo cast, the night clock, act palettes.
import { tb, bt } from './core/audio.js';
import { Character } from './core/rig.js';
import { trackPose } from './core/moves.js';
import { clamp, lerp, ease } from './core/util.js';

export const WIN_BEATS = [48, 64, 80, 112, 144, 176, 208, 240, 272, 304];
export const winTime = (n) => tb(WIN_BEATS[n - 1]);           // n = 1..10
export function wins(t) { let n = 0; for (const b of WIN_BEATS) if (t >= tb(b)) n++; return n; }
export function sinceWin(t) { const n = wins(t); return n ? t - winTime(n) : 1e9; }
// echo tints: cool cyan (first) -> violet -> rose -> amber -> gold (ninth)
export const TINTS = [[.35, .75, 1.0], [.45, .6, 1.0], [.6, .5, 1.0], [.85, .45, .95], [1.0, .45, .7], [1.0, .5, .45], [1.0, .62, .35], [1.0, .72, .3], [1.0, .82, .4]];
// narrative clock: 03:00 at start -> 06:11 at sunrise (win X)
export function clock(t) {
  const m0 = 180, m1 = 371; const u = clamp(t / winTime(10)); const m = Math.floor(lerp(m0, m1, Math.pow(u, 1.15)) + (t > winTime(10) ? (t - winTime(10)) * .2 : 0));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// Cast: one Zero + nine Echo instances per scene (scenes own their 3D objects).
export class Cast {
  constructor(scene, nEcho = 9, o = {}) {
    this.zero = new Character({ style: o.style || 'zero', number: 0 }); scene.add(this.zero.root);
    this.echoes = [];
    for (let i = 0; i < nEcho; i++) { const c = new Character({ style: o.style || 'echo', number: i + 1, tint: TINTS[i] }); c.root.visible = false; scene.add(c.root); this.echoes.push(c); }
    this.all = [this.zero, ...this.echoes];
  }
  // apply choreography: tracks[i] for character i (0 = zero), placement fn(i, b) -> {x,z,ry}
  pose(t, tracks, place, o = {}) {
    const b = bt(t);
    this.all.forEach((c, i) => {
      if (!tracks[i] || !c.root.visible) return;
      const lb = b - (o.canon ? o.canon(i) : 0);
      const p = { ...trackPose(tracks[i], lb) };
      const pl = place ? place(i, b) : null;
      if (pl) { p.x = (p.x || 0) + pl.x; p.z = (p.z || 0) + pl.z; p.ry = (p.ry || 0) + (pl.ry || 0); if (pl.y) p.y = (p.y || 0) + pl.y; }
      c.applyPose(p);
    });
  }
  // echo visibility & dissolve given how many echoes exist at time t (spawn = dissolve in over `dur`)
  spawn(t, count, spawnTimes, dur = .9) {
    this.echoes.forEach((c, i) => {
      const ok = i < count; c.root.visible = ok; if (!ok) return;
      const st = spawnTimes ? spawnTimes[i] : -1e9; c.setDissolve(clamp((t - st) / dur));
    });
  }
}
