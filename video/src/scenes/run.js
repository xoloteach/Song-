// ACT II — "MOMENTUM": Zero and his first echo sprint across the rooftops, side-scroller staging.
// 2D paper-cut skylines hang at real depths in 3D (true parallax). Gaps are placed so every take-off lands
// on a beat; WIN II happens mid-leap; the 2-bar 808 break (36.2–38.1s) becomes a bullet-time leap in ink.
import * as THREE from 'three';
import { BaseScene } from './base.js';
import { G, skyDome, litMat, cardMat, particles, glowMat } from '../core/materials.js';
import { Mirror, reflectable, Trail } from '../core/props.js';
import { tb, bt, kick, env, SPB } from '../core/audio.js';
import { clamp, lerp, ease, prog, impulse, noise1, hash, rng, fract, PI } from '../core/util.js';
import { Cast, wins, winTime } from '../story.js';
import { MOVES, trackPose } from '../core/moves.js';
import * as D from '../core/draw2d.js';

const V = 7.2;           // run speed m/s
const B0 = 50;           // run starts at beat 50
// jumps: [takeoffBeat, landBeat, height]
const JUMPS = [[54, 55, .9], [58, 59, .9], [64, 66, 2.4], [70, 71, .9], [76, 80, 5.5]];
const xAt = (b) => V * (tb(b) - tb(B0));

function paperSkyline(seed, w, h, col, o = {}) {
  const c = document.createElement('canvas'); c.width = 2048; c.height = 512; const x = c.getContext('2d'); const R = rng(seed);
  x.fillStyle = col; let px = 0;
  while (px < 2048) { const bw = 40 + R() * 140, bh = 120 + Math.pow(R(), 1.5) * 360; x.fillRect(px, 512 - bh, bw + 1, bh);
    if (R() < .3) { x.fillRect(px + bw * .4, 512 - bh - 40 - R() * 60, 4, 60); }               // antenna
    if (R() < .25) { x.beginPath(); x.moveTo(px, 512 - bh); x.lineTo(px + bw / 2, 512 - bh - 30); x.lineTo(px + bw, 512 - bh); x.fill(); }
    if (o.windows) { x.save(); x.fillStyle = o.windows; for (let wy = 512 - bh + 10; wy < 505; wy += 9) for (let wx = px + 5; wx < px + bw - 5; wx += 7) if (R() < .14) x.fillRect(wx, wy, 3, 4); x.restore(); x.fillStyle = col; }
    px += bw + (R() < .2 ? R() * 30 : 0); }
  // lit top edge (paper-cut rim)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(o.rep || 1, 1);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), cardMat(t, { intensity: o.intensity ?? 1, fogMul: o.fog ?? .4 })); return m;
}

export class Run extends BaseScene {
  constructor(app) {
    super(app); const S = this.scene;
    this.sky = skyDome({ zenith: [.006, .008, .025], horizon: [.09, .05, .1], glowCol: [.4, .25, .2], glow: .5, sunDir: [.2, .25, -1], stars: .9, haze: .6 }); S.add(this.sky);
    // moon (2D disc in 3D)
    const mc = document.createElement('canvas'); mc.width = mc.height = 512; const mx = mc.getContext('2d');
    const gr = mx.createRadialGradient(256, 256, 0, 256, 256, 256); gr.addColorStop(0, 'rgba(255,240,215,1)'); gr.addColorStop(.42, 'rgba(255,235,205,1)'); gr.addColorStop(.46, 'rgba(255,200,150,.35)'); gr.addColorStop(1, 'rgba(255,180,120,0)');
    mx.fillStyle = gr; mx.fillRect(0, 0, 512, 512); mx.fillStyle = 'rgba(200,180,160,.25)'; for (let i = 0; i < 14; i++) { const a = hash(i) * 6.28, r = hash(i + 9) * 80; mx.beginPath(); mx.arc(256 + Math.cos(a) * r, 256 + Math.sin(a) * r, 8 + hash(i + 3) * 26, 0, 6.28); mx.fill(); }
    const mt = new THREE.CanvasTexture(mc); mt.colorSpace = THREE.SRGBColorSpace;
    this.moon = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), cardMat(mt, { intensity: 2.2, additive: true })); this.moon.position.set(0, 55, -400); S.add(this.moon);
    // paper-cut parallax layers (back to front)
    this.layers = [];
    const L = [[-380, 900, 260, '#2a1f45', '#6a4a7a', 2.0, -70, .2], [-220, 700, 180, '#1d1838', '#a0705a', 1.6, -55, .3], [-120, 500, 120, '#141229', '#d79a5a', 1.3, -40, .5], [-55, 380, 70, '#0c0b1c', '#ffcf7a', 1.1, -26, .7]];
    L.forEach(([z, w, h, col, win, rep, y, fog], i) => { const m = paperSkyline(20 + i, w, h, col, { windows: win, rep, fog, intensity: 1.0 }); m.position.set(0, y + h / 2, z); S.add(m); this.layers.push(m); m.baseZ = z; });
    // rooftops: blocks along x, separated by the jump gaps
    const roofMat = litMat({ color: [.05, .045, .06], spec: .35, shin: 30, rim: 0, wrap: .4 });
    const edgeMat = litMat({ color: [0, 0, 0], emissive: [1.6, .55, .25], rim: 0 });
    const sideMat = litMat({ color: [.025, .025, .035], spec: .1, rim: .04 });
    this.roofs = []; let x = -40; const R = rng(5);
    const gaps = JUMPS.map(([a, b, h]) => [xAt(a) + .4, xAt(b) - .4]);
    for (let gi = 0; gi <= gaps.length; gi++) {
      const end = gi < gaps.length ? gaps[gi][0] : x + 140; const yTop = gi === 0 ? 0 : (gi % 2 ? -.6 : .3) * (gi < 4 ? 1 : 0);
      const blk = new THREE.Group(); const len = end - x;
      const body = new THREE.Mesh(new THREE.BoxGeometry(len, 60, 8), sideMat); body.position.set(x + len / 2, yTop - 30, 0); blk.add(body);
      const top = new THREE.Mesh(new THREE.BoxGeometry(len, .12, 8), roofMat); top.position.set(x + len / 2, yTop - .06, 0); blk.add(top);
      for (const zz of [-4, 4]) { const e = new THREE.Mesh(new THREE.BoxGeometry(len, .06, .06), edgeMat); e.position.set(x + len / 2, yTop + .02, zz); blk.add(e); }
      // dressing: vents, pipes, antennas, billboards
      for (let k = 0; k < len / 4; k++) { const px = x + 1 + R() * (len - 2), pz = -3.6 + R() * 1.5; const v = new THREE.Mesh(new THREE.BoxGeometry(.6 + R(), .5 + R() * 1.2, .6 + R()), sideMat); v.position.set(px, yTop + .4, pz); blk.add(v); }
      for (let k = 0; k < len / 18; k++) { const ant = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 4 + R() * 5, 5), sideMat); ant.position.set(x + R() * len, yTop + 3, -3.8); blk.add(ant); }
      S.add(blk); this.roofs.push({ x0: x, x1: end, y: yTop });
      if (gi < gaps.length) x = gaps[gi][1];
    }
    // big tower across the final chasm (landing goes to the crew plaza)
    this.cast = new Cast(S, 2);
    this.trails = [0, 1, 2].map(i => { const tr = new Trail(28, .05, i === 0 ? [2.2, 1.3, .5] : [.6, 1.3, 2.4]); S.add(tr.mesh); return tr; });
    this.dust = particles(500, { box: [60, 20, 30], origin: [0, 6, -4], vel: [-.5, .05, 0], size: 2, color: [.6, .5, .8], intensity: .25, seed: 9 }); S.add(this.dust);
    // fg speed props (close to camera)
    this.fg = []; for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.25, 3 + hash(i) * 4, .25), sideMat); m.position.set(-20 + i * 16 + hash(i + 4) * 8, this.roofAt(-20 + i * 16), 5.5); S.add(m); this.fg.push(m); }
    this.tracks = [0, 1, 2].map(i => this.runTrack(i));
  }
  runTrack(i) {
    const tr = [{ b: 40, move: 'run', o: { rate: 2 } }];
    JUMPS.forEach(([a, b]) => { tr.push({ b: a, move: 'sprintLeap', o: {}, blend: .15 }); tr.push({ b: b, move: b === 80 ? 'land' : 'run', o: { rate: 2 }, blend: .2 }); });
    return tr;
  }
  // root height & airborne state along the course at beat b
  height(b) {
    for (const [a, c, h] of JUMPS) if (b >= a && b < c) { const u = (b - a) / (c - a); const y0 = this.roofAt(xAt(a)), y1 = this.roofAt(xAt(c)); return { y: lerp(y0, y1, u) + 4 * h * u * (1 - u), air: u }; }
    return { y: this.roofAt(xAt(b)), air: -1 };
  }
  roofAt(x) { for (const r of this.roofs) if (x >= r.x0 - .5 && x <= r.x1 + .5) return r.y; return 0; }
  timeWarp(t) { // slow-motion through the 808 break (beats 76-80): scene time runs at ~25%
    const a = tb(76), c = tb(80); if (t < a) return t; if (t < c) return a + (t - a) * .25 + Math.pow((t - a) / (c - a), 6) * (c - a) * .75; return t; }
  draw3D(t, which = 'A') {
    const eng = this.app.eng; const tw = this.timeWarp(t); const b = bt(tw), rb = bt(t);
    this.lights({ keyDir: [.2, .4, -1], key: [.55, .45, .55], sky: [.07, .07, .13], ground: [.03, .02, .03], rim: [.9, .6, .5], fog: [.03, .025, .06], fogD: .004,
      points: [[[xAt(b) + 3, 4, 3], [1.2, .8, .5], 12]] });
    G.uTime.value = tw; this.dust.U.uTime.value = tw;
    const nE = rb >= 64 ? 2 : 1; this.cast.spawn(t, nE, [winTime(1) - 5, winTime(2)], .8);
    const offs = [0, -1.0, 1.1], lanes = [0, -1.3, 1.3];
    this.cast.pose(tw, this.tracks, (i, bb) => { const lb = bb - offs[i] * .0; const h = this.height(lb); return { x: xAt(lb) + offs[i], z: lanes[i], ry: PI / 2, y: h.y }; });
    // during leaps override the "run" root bob
    this.cast.zero.setNumber(Math.min(2, wins(t))); this.cast.zero.setGlow(1 + kick(t) * .5 + impulse(t, winTime(2), 2) * 2);
    this.cast.echoes.forEach(e => e.setGlow(1.2 + kick(t) * .5));
    // trails behind runners (analytic past positions)
    this.cast.all.slice(0, 3).forEach((c, i) => { const tr = this.trails[i]; tr.mesh.visible = c.root.visible; if (!c.root.visible) return; const pts = [];
      for (let k = 0; k < 28; k++) { const bb = b - k * .045; const h = this.height(bb); pts.push(new THREE.Vector3(xAt(bb) + offs[i] - .1, h.y + .12 + .05 * Math.sin(bb * PI * 2), lanes[i])); }
      tr.set(pts, this.cam.position); });
    // camera language
    const X = xAt(b), H = this.height(b).y;
    if (rb < 56) this.camPath(tw, [X + 1.5, 1.6 + H * .5, 9], [X + 2.5, 1.2 + H * .5, 0], { fov: 30, shake: .05 });                                  // side tracking
    else if (rb < 60) { const u = prog(rb, 56, 60); this.camPath(tw, [X + lerp(7, 4.5, u), .45 + H, lerp(1.8, 1.2, u)], [X, 1.1 + H, 0], { fov: 36, shake: .06 }); } // ahead, low, looking back
    else if (rb < 64) this.camPath(tw, [X + .8, 1.4 + H, 4.6], [X + .5, 1.2 + H, 0], { fov: 34, shake: .06 });                                       // side close
    else if (rb < 66) { const u = prog(rb, 64, 66); this.camPath(tw, [xAt(65) + lerp(-2, 2, u), -2.5, 3.5], [X, H + 1, -1], { fov: 40, shake: .03 }); }  // from the gap, looking up: silhouettes on the moon
    else if (rb < 72) { const u = prog(rb, 66, 72); this.camPath(tw, [X - 2 + u * 2, 7.5, 6], [X + 3, .5, 0], { fov: 34, shake: .04, roll: -.05 }); }     // aerial chase
    else if (rb < 76) this.camPath(tw, [X + 2.5, 1.0 + H, 7], [X + 2.5, 1.3 + H, 0], { fov: 28, shake: .06 });                                        // side tele
    else { const u = ease.inOutSine(prog(rb, 76, 80)); const a = lerp(-.4, PI * .95, u); const cx = X, cy = H + 1.1;                                  // bullet time orbit
      this.camPath(tw, [cx + Math.sin(a) * 4.2, cy + lerp(.5, -.6, u), Math.cos(a) * 4.2], [cx, cy, 0], { fov: 36, shake: .01 }); }
    // keep paper layers & moon parallax-locked loosely to camera x so the far world never runs out
    this.layers.forEach((m, i) => { const k = [.92, .8, .6, .35][i]; m.position.x = this.cam.position.x * k; });
    this.moon.position.x = this.cam.position.x * .97 + 60;
    eng.renderLayer(which, this.scene, this.cam);
  }
  fx(t) {
    const F = this.app.eng.fx, rb = bt(t);
    F.exposure = 1.0; F.bloom = 1.1; F.bloomThreshold = .75; F.temp = 0; F.sat = 1.05; F.contrast = 1.12; F.lift = [.015, .01, .03]; F.vignette = .4; F.grain = .05; F.ca = .0015 + kick(t) * .003;
    F.blurDir = rb < 76 ? [.0035 + kick(t) * .002, 0] : [0, 0];
    const w2 = impulse(t, winTime(2), 3); F.flash = w2 * .45; F.flashColor = [1, .8, .5];
    if (rb >= 76) { const u = prog(rb, 76, 76.5) * (1 - prog(rb, 79.6, 80)); F.ink = u * .92; F.inkPaper = [.94, .9, .82]; F.inkInk = [.06, .05, .09]; F.inkScale = 6; F.grain = .06; }
  }
  draw2D(t) {
    const E = this.app.eng, x = E.post.ctx, rb = bt(t); E.post.used = true;
    if (rb < 76) D.hLines(x, 26, t, { alpha: .18 + kick(t) * .25 });
    if (rb >= 64) D.drawWinCard(x, 2, (t - winTime(2)) * 1000, { cache: this, y: 330, h: 240 });
    if (rb >= 76 && rb < 80) { // bullet-time slate: frame counter + brush X building over the break
      const u = prog(rb, 76, 80);
      D.brushX(x, 1560, 300, 120, 34, ease.outCubic(prog(rb, 76.2, 78)), { color: D.EMBER });
      D.text(x, 'HOLD', 1560, 520, { size: 60, align: 'center', color: '#121018', track: 18 });
      const fr = Math.floor(lerp(0, 120, u)); D.text(x, `FRAME ${String(fr).padStart(4, '0')} · 0.25×`, 96, 1010, { size: 26, fam: 'JetBrains Mono', weight: 700, color: '#121018', track: 4 });
      x.save(); x.strokeStyle = '#121018'; x.lineWidth = 6; x.strokeRect(60, 60, 1800, 960); x.restore();
    }
  }
}
