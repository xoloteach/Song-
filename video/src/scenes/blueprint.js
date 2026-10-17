// ACT IV-a — "BLUEPRINT" (WIN V–VI): the world becomes a technical drawing. Zero sketches, then the tower he
// drew slams into existence one floor per kick-accent, annotated by 2D dimension lines anchored to the 3D model.
import * as THREE from 'three';
import { BaseScene } from './base.js';
import { G, skyDome, litMat } from '../core/materials.js';
import { tb, bt, kick, beatPulse } from '../core/audio.js';
import { clamp, lerp, ease, prog, impulse, noise1, hash, fract, PI } from '../core/util.js';
import { Cast, wins, winTime, clock } from '../story.js';
import { TW, floorBox, gatherPos, morphCam } from './tower.js';
import * as D from '../core/draw2d.js';

export const FLOOR_BEATS = Array.from({ length: 10 }, (_, i) => 145 + i * 2.75);
const PAPER = '#0d2a5c';
export class Blueprint extends BaseScene {
  constructor(app) {
    super(app); const S = this.scene;
    this.sky = skyDome({ zenith: [.02, .06, .17], horizon: [.03, .09, .23], below: [.02, .06, .16], glow: 0, stars: 0, haze: 0 }); S.add(this.sky);
    // drafting grid
    const gp = []; for (let i = -60; i <= 60; i++) { gp.push(i, 0, -60, i, 0, 60, -60, 0, i, 60, 0, i); }
    const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    this.grid = new THREE.LineSegments(gg, new THREE.LineBasicMaterial({ color: new THREE.Color(.12, .25, .5), transparent: true, opacity: .8 })); S.add(this.grid);
    const gp2 = []; for (let i = -60; i <= 60; i += 5) { gp2.push(i, .01, -60, i, .01, 60, -60, .01, i, 60, .01, i); }
    const gg2 = new THREE.BufferGeometry(); gg2.setAttribute('position', new THREE.Float32BufferAttribute(gp2, 3));
    S.add(new THREE.LineSegments(gg2, new THREE.LineBasicMaterial({ color: new THREE.Color(.3, .5, .9) })));
    // tower floors as line drawings (edges + mullions) with a faint fill
    this.floors = [];
    const lineM = () => new THREE.LineBasicMaterial({ color: new THREE.Color(1.3, 1.45, 1.7), transparent: true, opacity: 1 });
    const fillM = litMat({ color: [0, 0, 0], emissive: [.04, .1, .26], lightMul: 0, rim: 0, transparent: true, opacity: .55, depthWrite: false });
    for (let i = 0; i < TW.floors; i++) {
      const f = floorBox(i), g = new THREE.Group();
      const box = new THREE.BoxGeometry(f.w, f.h, f.w); box.translate(0, f.h / 2, 0);
      const lm = lineM(); g.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), lm));
      const mp = []; const n = 6; for (let k = 1; k < n; k++) { const x = -f.w / 2 + k * f.w / n; for (const zz of [f.w / 2, -f.w / 2]) mp.push(x, .3, zz, x, f.h - .3, zz); for (const xx of [f.w / 2, -f.w / 2]) mp.push(xx, .3, x, xx, f.h - .3, x); }
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)); const lm2 = lineM(); lm2.opacity = .45; g.add(new THREE.LineSegments(mg, lm2));
      const fill = new THREE.Mesh(box, fillM); g.add(fill); g.lm = [lm, lm2];
      g.position.y = f.y; S.add(g); this.floors.push(g);
    }
    // the helix stair, drawn as a dashed line
    const hp = []; for (let k = 0; k <= 600; k++) { const u = k / 600, a = u * TW.turns * 2 * PI; hp.push(new THREE.Vector3(Math.cos(a) * TW.R, u * TW.height, Math.sin(a) * TW.R)); }
    const hg = new THREE.BufferGeometry().setFromPoints(hp); this.helixLine = new THREE.Line(hg, new THREE.LineDashedMaterial({ color: new THREE.Color(1, .75, .4), dashSize: .5, gapSize: .35 })); this.helixLine.computeLineDistances(); S.add(this.helixLine);
    // sketch crate Zero sits on
    const crate = new THREE.BoxGeometry(.9, .46, .9).translate(0, .23, 0); this.crate = new THREE.LineSegments(new THREE.EdgesGeometry(crate), lineM()); this.crate.position.set(9, 0, 6); S.add(this.crate);
    this.cast = new Cast(S, 6, { style: 'line' });
    this.tracks = [
      [{ b: 130, move: 'sit' }, { b: 150, move: 'idle', blend: 1 }, { b: 152, move: 'lookUp', blend: .8 }, { b: 160, move: 'carry', blend: .5 }, { b: 168, move: 'bounce', blend: .5 }, { b: 172, move: 'guardBounce', blend: .5 }, { b: 176, move: 'xHit', blend: .15 }, { b: 178, move: 'guardBounce', blend: .4 }],
      ...[1, 2, 3, 4, 5, 6].map(i => [{ b: 130, move: i % 2 ? 'carry' : 'reach' }, { b: 160 + i, move: 'stepTouch', blend: .6 }, { b: 172, move: 'guardBounce', blend: .5 }, { b: 176, move: 'xHit', mirror: i % 2 === 1, blend: .15 }, { b: 178, move: 'guardBounce', blend: .4 }])];
  }
  place(i, b) {
    const g = gatherPos(i), u = ease.inOutCubic(prog(b, 166, 171));
    let p;
    if (i === 0) { p = b < 150 ? { x: 9, z: 6, ry: -PI * .7, y: 0 } : { x: lerp(9, 7.5, prog(b, 150, 152)), z: 6, ry: -PI * .75 }; }
    else { const a = i / 6 * PI * 2 + .4; p = { x: Math.cos(a) * (TW.half + 1.6), z: Math.sin(a) * (TW.half + 1.6), ry: -a - PI / 2 }; }
    return { x: lerp(p.x, g.x, u), z: lerp(p.z, g.z, u), ry: lerp(p.ry, g.ry, u), y: p.y || 0 };
  }
  floorY(i, b) { const b0 = FLOOR_BEATS[i]; const u = clamp((b - (b0 - .5)) / .5); return { on: b >= b0 - .5, dy: (1 - ease.inQuad(u)) * 6, flash: b >= b0 ? Math.exp(-(b - b0) * 3) : 0 }; }
  draw3D(t, which = 'A') {
    const eng = this.app.eng, b = bt(t);
    this.lights({ keyDir: [.3, .8, .4], key: [0, 0, 0], sky: [0, 0, 0], ground: [0, 0, 0], rim: [1, 1, 1], fog: [.03, .09, .22], fogD: .0 });
    G.uTime.value = t;
    this.floors.forEach((g, i) => { const f = this.floorY(i, b); g.visible = f.on; g.position.y = floorBox(i).y + f.dy; g.lm[0].color.setRGB(1.3 + f.flash * 4, 1.45 + f.flash * 3, 1.7 + f.flash * 2); });
    this.helixLine.material.opacity = 1; this.helixLine.visible = b >= 164; this.helixLine.geometry.setDrawRange(0, Math.floor(601 * ease.inOutCubic(prog(b, 164, 172))));
    const nE = Math.min(6, wins(t)); this.cast.spawn(t, nE, [-9, -9, -9, -9, winTime(5), winTime(6)], 1.2);
    this.cast.pose(t, this.tracks, (i, bb) => this.place(i, bb));
    this.cast.zero.setNumber(Math.min(6, wins(t)));
    this.crate.visible = b < 152;
    // camera
    const C = this;
    if (b < 150) { const u = prog(b, 142, 150); C.camPath(t, [lerp(6.4, 6.9, u), 1.15, lerp(3.4, 3.0, u)], [9, .85, 6], { fov: 36, shake: .015 }); }
    else if (b < 160) { const u = prog(b, 150, 160), a = lerp(.9, 2.0, ease.inOutSine(u)); C.camPath(t, [Math.cos(a) * 26, lerp(6, 10, u), Math.sin(a) * 26], [0, 8, 0], { fov: 40, shake: .02 }); }
    else if (b < 168) { const u = prog(b, 160, 168); C.camPath(t, [lerp(7, 6, u), .5, lerp(7.5, 6.5, u)], [0, lerp(12, 22, u), 0], { fov: 50, shake: .02 }); }
    else morphCam(this.cam, t);
    eng.renderLayer(which, this.scene, this.cam);
    this.projected = this.floors.map((g, i) => { const f = floorBox(i); const v = new THREE.Vector3(f.w / 2, g.position.y + f.h, f.w / 2).project(this.cam); return [(v.x * .5 + .5) * 1920, (1 - (v.y * .5 + .5)) * 1080, v.z < 1]; });
    const z0 = new THREE.Vector3(f0w(), 0, f0w()).project(this.cam); this.base = [(z0.x * .5 + .5) * 1920, (1 - (z0.y * .5 + .5)) * 1080];
  }
  fx(t) {
    const F = this.app.eng.fx, b = bt(t);
    F.exposure = 1.0; F.bloom = .9; F.bloomThreshold = .9; F.temp = -.05; F.sat = 1.0; F.contrast = 1.05; F.vignette = .35; F.grain = .07; F.ca = .001;
    const w = wins(t); const wi = (w >= 5 && w <= 6) ? impulse(t, winTime(w), 3) : 0; F.flash = wi * .4; F.flashColor = [.8, .9, 1];
    if (b < 143) { F.flash = Math.max(F.flash, (1 - prog(b, 142, 143)) * .9); F.flashColor = [.9, .95, 1]; }
  }
  draw2D(t) {
    const E = this.app.eng, x = E.post.ctx, b = bt(t); E.post.used = true;
    // dimension annotations anchored to the 3D floors
    (this.projected || []).forEach((p, i) => { const f = this.floorY(i, b); if (!f.on || !p[2] || f.dy > .5) return; const a = clamp((b - FLOOR_BEATS[i]) * 2);
      x.save(); x.globalAlpha = a * .9; x.strokeStyle = '#dbe8ff'; x.lineWidth = 2; x.setLineDash([8, 6]); x.beginPath(); x.moveTo(p[0] + 8, p[1]); x.lineTo(p[0] + 90, p[1]); x.stroke(); x.setLineDash([]);
      D.text(x, `LVL ${String(i + 1).padStart(2, '0')}  +${(i + 1) * TW.floorH}.00`, p[0] + 98, p[1] + 8, { size: 20, fam: 'JetBrains Mono', color: '#dbe8ff', track: 2 }); x.restore(); });
    // drafting title block (bottom-left)
    x.save(); x.strokeStyle = '#dbe8ff'; x.lineWidth = 2; x.globalAlpha = .85; x.strokeRect(96, 880, 470, 130); x.beginPath(); x.moveTo(96, 925); x.lineTo(566, 925); x.moveTo(330, 925); x.lineTo(330, 1010); x.stroke();
    D.text(x, 'PROJECT: TEN — VERTICAL', 112, 913, { size: 22, fam: 'JetBrains Mono', weight: 700, color: '#dbe8ff', track: 3 });
    D.text(x, `SHEET ${String(Math.max(5, wins(t))).padStart(2, '0')} / 10`, 112, 960, { size: 20, fam: 'JetBrains Mono', color: '#dbe8ff' });
    D.text(x, 'DRAWN BY: ZERO', 112, 994, { size: 20, fam: 'JetBrains Mono', color: '#dbe8ff' });
    D.text(x, `TIME ${clock(t)}`, 346, 960, { size: 20, fam: 'JetBrains Mono', color: '#dbe8ff' }); D.text(x, 'SCALE 1:1', 346, 994, { size: 20, fam: 'JetBrains Mono', color: '#dbe8ff' }); x.restore();
    // sketch strokes while Zero draws (first shot)
    if (b < 150) { const u = prog(b, 142, 150); x.save(); x.globalAlpha = .9;
      for (let k = 0; k < 6; k++) { const p = clamp(u * 6 - k); if (p <= 0) continue; const y0 = 260 + k * 46;
        D.inkStroke(x, [[1180, y0], [1180 + 240 + hash(k) * 200, y0 + (hash(k + 3) - .5) * 20]], 4, p, { color: '#dbe8ff', seed: k }); }
      D.ring(x, 1560, 330, 110, 6, clamp(u * 2 - .6), { color: '#ffd9a0', seed: 5 }); D.brushX(x, 1560, 330, 70, 10, clamp(u * 2 - 1), { color: '#ffd9a0' });
      D.text(x, 'X = 10', 1490, 500, { size: 34, fam: 'JetBrains Mono', weight: 700, color: '#ffd9a0', alpha: clamp(u * 3 - 2), track: 4 }); x.restore(); }
    // rubber stamps for WIN V and VI
    for (const n of [5, 6]) { if (t < winTime(n)) continue; const dt = t - winTime(n); const s = 1 + 2.5 * Math.exp(-dt * 14); const a = clamp(dt * 8) * (n === 5 ? 1 - clamp((b - 160) / 2) : 1 - clamp((b - 178) / 1.5));
      if (a <= 0) continue; x.save(); x.globalAlpha = a * .92; x.translate(n === 5 ? 1500 : 1560, n === 5 ? 760 : 700); x.rotate(n === 5 ? -.18 : .12); x.scale(s, s);
      x.strokeStyle = '#ff4a3a'; x.lineWidth = 8; x.strokeRect(-150, -110, 300, 220); D.text(x, D.ROMAN[n], 0, 50, { size: 170, align: 'center', color: '#ff4a3a' });
      D.text(x, 'APPROVED', 0, 92, { size: 26, fam: 'JetBrains Mono', weight: 700, align: 'center', color: '#ff4a3a', track: 8 }); x.restore(); }
  }
}
function f0w() { return TW.half; }
