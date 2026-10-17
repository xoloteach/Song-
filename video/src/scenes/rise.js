// ACT IV-b — "RISE" (WIN VI -> the top): the drawn tower is real. The crew sprints up a spiral stair past giant
// floor numerals (Blender-modelled glyphs) — 1, 2, 3 … — the camera craning with them. The 808 returns at 91.5s
// and the climb doubles in speed; at 97.2s a hit freezes everyone at the summit for the 2-beat silence.
import * as THREE from 'three';
import { BaseScene } from './base.js';
import { G, skyDome, litMat, buildingMat, particles, MATCAPS } from '../core/materials.js';
import { makeCity, bakeFarField, DIGITS } from '../core/props.js';
import { tb, bt, kick, beatPulse } from '../core/audio.js';
import { clamp, lerp, ease, prog, impulse, noise1, hash, fract, PI } from '../core/util.js';
import { Cast, wins, winTime } from '../story.js';
import { TW, HELIX_LEN, helix, gatherPos, morphCam, floorBox } from './tower.js';
import * as D from '../core/draw2d.js';

const C0 = 180, C1 = 204; // climb beats
export function climbS(b) { const u = clamp((b - C0) / (C1 - C0)); const f = u < .5 ? (2 / 3) * u : 1 / 3 + (4 / 3) * (u - .5); return f * (HELIX_LEN - 1.5); }
export class Rise extends BaseScene {
  constructor(app) {
    super(app); const S = this.scene;
    this.sky = skyDome({ zenith: [.004, .006, .02], horizon: [.06, .04, .09], glowCol: [.3, .15, .1], glow: .4, sunDir: [-.5, .05, -1], stars: .8, haze: .6 }); S.add(this.sky);
    this.city = makeCity({ seed: 51, count: 650, area: [-340, 340, -340, 340], baseY: -60, minH: 20, maxH: 110, split: 100,
      heightFn: (x, z, h) => { const d = Math.hypot(x, z); return d < 110 ? 30 + (h - 20) * .6 : h + 30; }, avoid: (x, z) => Math.hypot(x, z) < 28,
      mat: { lit: .26, winGain: 1.3, seed: 8, floorH: 1.6, colW: 1.7 } });
    S.add(this.city);
    // ground plaza
    const plaza = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), litMat({ color: [.03, .03, .04], spec: .2, rim: 0 })); plaza.rotation.x = -PI / 2; S.add(plaza);
    // tower floors with lit windows
    const bm = buildingMat({ base: [.03, .035, .05], lit: .42, winGain: .9, floorH: .75, colW: .8, seed: 3, accentAmt: 0, warm: [1.6, 1.0, .5] });
    const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0); this.tower = new THREE.InstancedMesh(box, bm, TW.floors); const d = new THREE.Object3D();
    for (let i = 0; i < TW.floors; i++) { const f = floorBox(i); d.position.set(0, f.y, 0); d.scale.set(f.w, f.h - .25, f.w); d.updateMatrix(); this.tower.setMatrixAt(i, d.matrix); } S.add(this.tower);
    const slabM = litMat({ color: [.05, .05, .06], emissive: [0, 0, 0], emissiveAmt: 0, spec: .4, rim: 0 }); this.slabM = slabM;
    for (let i = 0; i <= TW.floors; i++) { const f = floorBox(Math.min(i, 9)); const s = new THREE.Mesh(new THREE.BoxGeometry(f.w + .3, .25, f.w + .3), slabM); s.position.y = i * TW.floorH - .12; S.add(s);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(f.w + .34, .05, f.w + .34), litMat({ color: [0, 0, 0], emissive: [1.6, .9, .35], rim: 0 })); strip.position.y = i * TW.floorH; S.add(strip); }
    // floor numerals (Blender glyphs, gold)
    const gold = litMat({ color: [.25, .16, .06], spec: 1.2, shin: 60, rim: .3, rimTint: [1, .7, .3], matcap: 'gold', matcapAmt: 1.15, emissive: [.4, .22, .05] });
    this.nums = [];
    for (let i = 0; i < TW.floors; i++) { const g = i === 9 ? DIGITS.ten : DIGITS['digit_' + (i + 1)]; if (!g) continue; const m = new THREE.Mesh(g, gold); const f = floorBox(i);
      const side = i % 4, a = side * PI / 2; m.scale.setScalar(2.2); m.position.set(Math.sin(a) * (f.w / 2 + .12), f.y + 1.5, Math.cos(a) * (f.w / 2 + .12)); m.rotation.y = a; S.add(m); this.nums.push(m); }
    // helix stair: instanced treads + glowing rail
    const steps = 420, tread = new THREE.BoxGeometry(1.5, .12, .5); const tm = litMat({ color: [.08, .08, .1], spec: .4, rim: .05, matcap: 'chrome_night', matcapAmt: .3 });
    this.treads = new THREE.InstancedMesh(tread, tm, steps);
    for (let k = 0; k < steps; k++) { const h = helix((k + .5) / steps * HELIX_LEN); d.position.set(h.x, h.y - .06, h.z); d.rotation.set(0, -h.a, 0); d.scale.set(1, 1, 1); d.updateMatrix(); this.treads.setMatrixAt(k, d.matrix); } S.add(this.treads);
    const pts = []; for (let k = 0; k <= 400; k++) { const h = helix(k / 400 * HELIX_LEN); pts.push(new THREE.Vector3(Math.cos(h.a) * (TW.R + .75), h.y + 1.0, Math.sin(h.a) * (TW.R + .75))); }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 800, .035, 6, false), litMat({ color: [0, 0, 0], emissive: [.4, 1.2, 2.2], rim: 0 })); S.add(rail);
    // rooftop crown at the top (where the arena will be)
    const crown = new THREE.Mesh(new THREE.TorusGeometry(TW.half + .6, .08, 8, 64), litMat({ color: [0, 0, 0], emissive: [2.5, 1.6, .6], rim: 0 })); crown.rotation.x = PI / 2; crown.position.y = TW.height + .1; S.add(crown);
    this.motes = particles(800, { box: [40, 40, 40], origin: [0, 18, 0], vel: [.1, .4, .1], size: 2.2, color: [1, .75, .4], color2: [.5, .7, 1], intensity: .3, seed: 13 }); S.add(this.motes);
    this.cast = new Cast(S, 6);
    this.tracks = this.cast.all.map((c, i) => [{ b: 170, move: 'guardBounce' }, { b: 176, move: 'xHit', mirror: i % 2 === 1, blend: .15 }, { b: 178, move: 'guardBounce', blend: .4 },
      { b: C0, move: 'climb', blend: .4 }, { b: 192, move: 'run', o: { rate: 2, intensity: 1 }, blend: .5 }, { b: C1, move: 'point', blend: .12 }, { b: 206, move: 'lookUp', blend: 1.2 }]);
    app.bakeQueue.push(() => { this.lights(this.L0); bakeFarField(app.eng.renderer, S, [this.city.far], this.sky, [0, 15, 0]); });
  }
  get L0() { return { keyDir: [-.5, .6, -.6], key: [.3, .32, .5], sky: [.06, .07, .12], ground: [.04, .03, .03], rim: [.5, .6, 1.1], fog: [.02, .022, .045], fogD: .004 }; }
  place(i, b) {
    if (b < C0) { const g = gatherPos(i); return { x: g.x, z: g.z, ry: g.ry }; }
    const s = Math.max(0, climbS(b) - i * 1.25), h = helix(s);
    const g = gatherPos(i), u = clamp((b - C0) / 1.5);
    const ry = h.ry; // facing along the stair
    if (b >= C1 - 1.5) { // step off the stair onto the roof, into a fan facing +x (camera side)
      const u2 = ease.inOutCubic(clamp((b - (C1 - 1.5)) / 2)); const a = (i - 3) * .42; const fx = Math.cos(a) * 1.6 - .4, fz = Math.sin(a) * 2.2;
      const hs = helix(Math.max(0, climbS(C1 - 1.5) - i * 1.25));
      return { x: lerp(hs.x, fx, u2), z: lerp(hs.z, fz, u2), y: lerp(hs.y, TW.height, u2), ry: lerp(hs.ry, PI / 2, u2) }; }
    return { x: lerp(g.x, h.x, ease.inOutSine(u)), z: lerp(g.z, h.z, ease.inOutSine(u)), y: h.y, ry: lerp(g.ry, ry, u) };
  }
  draw3D(t, which = 'A') {
    const eng = this.app.eng, b = bt(t);
    const top = b >= C1, k = kick(t);
    this.lights({ ...this.L0, points: [[[0, Math.min(TW.height, helix(climbS(b)).y) + 3, 0], [1.6 + k, 1.0, .5], 14]] });
    G.uTime.value = t; this.motes.U.uTime.value = t;
    
    this.cast.spawn(t, Math.min(6, wins(t)), [-9, -9, -9, -9, -9, winTime(6)], 1);
    this.cast.pose(t, this.tracks, (i, bb) => this.place(i, bb));
    this.cast.zero.setNumber(6); this.cast.all.forEach(c => c.setGlow(1 + k * .6 + (top ? 1 : 0)));
    const lead = helix(climbS(Math.min(b, C1)));
    if (b < 182) morphCam(this.cam, t);
    else if (b < 188) { const a = lead.a + .9; this.camPath(t, [Math.cos(a) * 15, lead.y + 3, Math.sin(a) * 15], [lead.x * .5, lead.y + 1.2, lead.z * .5], { fov: 38, shake: .04 }); }
    else if (b < 192) { const h = helix(Math.max(0, climbS(b) - 9)); this.camPath(t, [h.x * 1.25, h.y + 1.6, h.z * 1.25], [lead.x, lead.y + 1.3, lead.z], { fov: 44, shake: .05 }); }
    else if (b < 200) { const a = lead.a + .5 + (b - 192) * .05; this.camPath(t, [Math.cos(a) * 24, lead.y + 5, Math.sin(a) * 24], [0, lead.y + 1, 0], { fov: 36, shake: .05 + k * .05 }); }
    else if (b < C1) { this.camPath(t, [lead.x * .3, TW.height + 14, lead.z * .3 + .01], [lead.x * .6, lead.y - 4, lead.z * .6], { fov: 55, shake: .03 }); }
    else { const u = prog(b, C1, 208); this.camPath(t, [lerp(7.5, 6.2, u), TW.height + .35, lerp(1.5, 1.0, u)], [0, TW.height + 2.2, 0], { fov: lerp(40, 34, u), shake: .01 }); }
    eng.renderLayer(which, this.scene, this.cam);
  }
  fx(t) {
    const F = this.app.eng.fx, b = bt(t);
    F.exposure = 1.05; F.bloom = 1.1; F.bloomThreshold = .7; F.temp = .05; F.sat = 1.05; F.contrast = 1.12; F.lift = [.01, .01, .025]; F.vignette = .45; F.grain = .05; F.ca = .0015 + kick(t) * .003;
    if (b >= 192 && b < C1) F.blurDir = [0, .003];
    if (b >= C1) { const h = impulse(t, tb(C1), 2.2); F.flash = h * .8; F.flashColor = [1, .95, .85]; F.sat = lerp(1.05, .55, prog(b, C1, C1 + 1)); F.exposure *= lerp(1, .9, prog(b, C1, 208)); F.grain = .07; }
  }
  draw2D(t) {
    const E = this.app.eng, x = E.post.ctx, b = bt(t); E.post.used = true;
    if (b >= 180 && b < C1) { // altimeter: vertical scale with level ticks
      const y = helix(climbS(b)).y; x.save(); x.translate(1760, 540);
      for (let m = 0; m <= 30; m += 1) { const yy = (y - m) * 24; if (Math.abs(yy) > 380) continue; const major = m % 3 === 0; x.fillStyle = major ? D.GOLD : 'rgba(242,234,216,.5)'; x.fillRect(major ? -40 : -20, yy, major ? 40 : 20, major ? 3 : 2);
        if (major) D.text(x, `L${String(m / 3).padStart(2, '0')}`, -52, yy + 8, { size: 22, fam: 'JetBrains Mono', align: 'right', color: D.GOLD }); }
      x.fillStyle = D.EMBER; x.beginPath(); x.moveTo(6, 0); x.lineTo(26, -10); x.lineTo(26, 10); x.fill();
      D.text(x, `${y.toFixed(1)} M`, 36, 8, { size: 24, fam: 'JetBrains Mono', weight: 700, color: D.INK }); x.restore();
      if (b >= 192) D.speedLines(x, 960, 540, 60, 420, 1300, t, { alpha: .25, w: 2 }); }
    if (b >= C1) { const u = prog(b, C1, 208); x.save(); x.globalAlpha = clamp(u * 4) * (1 - prog(b, 207.6, 208));
      D.text(x, 'THE SUMMIT', 960, 900, { size: 30, fam: 'JetBrains Mono', weight: 700, align: 'center', color: D.INK, track: 22 });
      x.fillStyle = D.INK; x.fillRect(960 - 200 * u, 925, 400 * u, 2); x.restore(); }
  }
}
