// ACT III — "THE CREW" (WIN III–IV): a neon rooftop court whose painted lines are an X and an O (10).
// 8-beat phrases: 4 beats of groove, a 2-beat FREEZE exactly where the 808 drops out (beats ≡ 4 mod 8),
// then a 2-beat transition into a new formation. Freezes alternate between an ink-halftone still and a
// three-camera comic split of the same frozen instant.
import * as THREE from 'three';
import { BaseScene } from './base.js';
import { G, skyDome, litMat, cardMat, lightCone, particles } from '../core/materials.js';
import { makeCity, bakeFarField, Mirror, wetFloor, reflectable } from '../core/props.js';
import { tb, bt, kick, env, snare, beatPulse } from '../core/audio.js';
import { clamp, lerp, ease, prog, impulse, noise1, hash, fract, PI, TAU } from '../core/util.js';
import { Cast, wins, winTime } from '../story.js';
import * as D from '../core/draw2d.js';

const P0 = 80;
// phrase plan: [groove move, freeze pose, transition move, formation, camera, freezeStyle, canon]
const PLAN = [
  ['stomp', 'xHold', 'xHit', 'V', 'land', 'ink', 0],
  ['stepTouch', 'power', 'spin', 'line', 'front', 'panels', .25],
  ['chestPop', 'point', 'stomp', 'diamond', 'orbit', 'ink', 0],
  ['armWave', 'lean', 'spin', 'column', 'crane', 'panels', .5],
  ['stomp', 'starHold', 'runningMan', 'V', 'hero', 'ink', 0],
  ['runningMan', 'kneelPoint', 'stomp', 'arc', 'side', 'panels', .25],
  ['box', 'xHold', 'xHit', 'line', 'front2', 'ink', 0],
  ['bounce', 'fistChest', 'idle', 'V', 'push', 'none', 0],
];
export function formation(name, i, n) {
  const k = i - (n - 1) / 2;
  switch (name) {
    case 'circle': { const a = i / n * PI * 2 + PI / 2; return [Math.cos(a) * 2.7, Math.sin(a) * 2.7]; }
    case 'X': { if (i === 0) return [0, 0]; const d = (i - 1) % 4, r = Math.ceil(i / 4) * 1.35, a = PI / 4 + d * PI / 2; return [Math.cos(a) * r, Math.sin(a) * r]; }
    case 'line10': return [k * 1.25, 0];
    case 'wedge2': { const row = i % 2, c = Math.floor(i / 2); return [(c - (Math.ceil(n / 2) - 1) / 2) * 1.5 + row * .75, row ? -1.3 : .4]; }
    case 'line': return [k * 1.55, 0];
    case 'V': return i === 0 ? [0, 1.2] : [((i % 2) ? -1 : 1) * Math.ceil(i / 2) * 1.35, 1.2 - Math.ceil(i / 2) * 1.2];
    case 'diamond': return [[0, 1.4], [-1.5, 0], [1.5, 0], [0, -1.4], [0, -2.8]][i] || [0, 0];
    case 'column': return [0, 1.6 - i * 1.25];
    case 'arc': { const a = (i / Math.max(1, n - 1) - .5) * 2.2; return [Math.sin(a) * 3, Math.cos(a) * 3 - 2.4]; }
  }
  return [0, 0];
}
export class Crew extends BaseScene {
  constructor(app) {
    super(app); const S = this.scene;
    this.sky = skyDome({ zenith: [.005, .006, .02], horizon: [.08, .03, .09], glowCol: [.3, .08, .2], glow: .5, sunDir: [0, .05, -1], stars: .5, haze: .7 }); S.add(this.sky); reflectable(this.sky);
    this.city = makeCity({ seed: 31, count: 600, area: [-320, 320, -420, 320], baseY: -80, minH: 30, maxH: 140, split: 120,
      heightFn: (x, z, h) => { const d = Math.hypot(x, z); return d < 130 ? 40 + (h - 30) * .5 : h + 40; }, avoid: (x, z) => Math.hypot(x, z) < 45,
      mat: { lit: .25, winGain: 1.3, seed: 5, warm: [1.4, .7, 1.0], cool: [.5, .9, 1.6], accent: [1.6, .2, .8], floorH: 1.6, colW: 1.7 } });
    S.add(this.city); reflectable(this.city);
    // court pattern: an X and an O (10), boundary, centre spot
    const pc = document.createElement('canvas'); pc.width = pc.height = 1024; const x = pc.getContext('2d');
    x.strokeStyle = 'rgba(255,200,110,1)'; x.lineWidth = 7; x.strokeRect(40, 40, 944, 944); x.lineWidth = 5;
    x.beginPath(); x.arc(512, 512, 250, 0, TAU); x.stroke(); x.beginPath(); x.arc(512, 512, 60, 0, TAU); x.stroke();
    x.lineWidth = 9; x.beginPath(); x.moveTo(140, 140); x.lineTo(884, 884); x.moveTo(884, 140); x.lineTo(140, 884); x.stroke();
    x.font = '700 120px "Big Shoulders"'; x.fillStyle = 'rgba(255,200,110,.9)'; x.textAlign = 'center'; x.fillText('X', 512, 990); x.save(); x.translate(512, 34); x.rotate(PI); x.fillText('X', 0, -60); x.restore();
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
    this.mirror = new Mirror(app.eng.renderer, [960, 540], 0);
    this.floor = wetFloor([30, 30], this.mirror, { base: [.03, .028, .04], pattern: pt, patternGain: .45, reflAmt: .9, rough: .012, ripple: 0, wet: .9 }); S.add(this.floor);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(30, 80, 30).translate(0, -40.02, 0), litMat({ color: [.02, .02, .03], rim: 0 })); S.add(deck);
    // LED pylons with live 2D graphics (one shared canvas)
    const lc = document.createElement('canvas'); lc.width = 256; lc.height = 768; this.ledCtx = lc.getContext('2d'); this.ledTex = new THREE.CanvasTexture(lc); this.ledTex.colorSpace = THREE.SRGBColorSpace;
    const frameM = litMat({ color: [.02, .02, .025], spec: .5, rim: .1, matcap: 'chrome_night', matcapAmt: .3 });
    this.pylons = [];
    for (const [px, pz, ry] of [[-13, -13, PI / 4], [13, -13, -PI / 4], [-13, 13, PI * .75], [13, 13, -PI * .75]]) {
      const g = new THREE.Group(); const box = new THREE.Mesh(new THREE.BoxGeometry(2.6, 8.4, .5), frameM); box.position.y = 4.2; g.add(box);
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 6.9), cardMat(this.ledTex, { intensity: 2.2 })); scr.position.set(0, 4.5, .26); g.add(scr);
      g.position.set(px, 0, pz); g.rotation.y = ry + PI; g.lookAt(0, 0, 0); S.add(g); reflectable(g); this.pylons.push(g);
    }
    // low glowing barrier around the court
    const barM = litMat({ color: [0, 0, 0], emissive: [1.6, .4, 1.1], rim: 0 });
    for (const [bx, bz, w, d] of [[0, -15, 30, .08], [0, 15, 30, .08], [-15, 0, .08, 30], [15, 0, .08, 30]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, .06, d), barM); m.position.set(bx, .9, bz); S.add(m); reflectable(m);
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, .9, d), litMat({ color: [.03, .03, .04], rim: 0, opacity: .5, transparent: true })); p.position.set(bx, .45, bz); S.add(p); }
    // searchlights crossing as an X
    this.beams = [[-60, -90, 1], [60, -90, -1]].map(([bx, bz, s]) => { const c = lightCone(260, 9, { color: [.6, .7, 1.0], intensity: .22, falloff: .6, edge: 2.5, dust: .3 }); c.position.set(bx, -10, bz); c.s = s; S.add(c); return c; });
    this.haze = particles(700, { box: [34, 10, 34], origin: [0, 4, 0], vel: [.2, .08, .1], size: 2.4, color: [.8, .5, 1.0], color2: [.4, .8, 1.0], intensity: .22, seed: 3 }); S.add(this.haze);
    this.cast = new Cast(S, 4); this.cast.all.forEach(c => reflectable(c.root));
    this.tracks = this.cast.all.map((c, i) => this.track(i));
    this.panelCams = [0, 1, 2].map(() => new THREE.PerspectiveCamera(35, 1, .1, 2000));
    app.bakeQueue.push(() => { this.lights(this.L0(0)); bakeFarField(app.eng.renderer, S, [this.city.far], this.sky, [0, 3, 0]); });
  }
  track(i) {
    const tr = [{ b: 70, move: 'run', o: { rate: 2 } }, { b: 80, move: 'land', blend: .1 }, { b: 81, move: 'power', blend: .6 }, { b: 82, move: 'stomp', blend: .3 }];
    PLAN.forEach(([gm, fp, tm], k) => { const b = P0 + k * 8; if (k > 0) tr.push({ b, move: gm, blend: .3 }); tr.push({ b: b + 4, move: fp, blend: .12 }); tr.push({ b: b + 6, move: tm, blend: .2, o: { len: 2, turns: (i % 2 ? -1 : 1) } }); });
    return tr;
  }
  L0(b) { return { keyDir: [.2, .9, .3], key: [.5, .45, .6], sky: [.08, .06, .12], ground: [.03, .02, .04], rim: [1.0, .35, .9], fog: [.02, .015, .04], fogD: .005 }; }
  nDancers(t) { return 1 + (wins(t) >= 4 ? 4 : 3); }
  forms(b, n) { // formation positions (blend into next during beats 6-8 of a phrase)
    const k = clamp(Math.floor((b - P0) / 8), 0, PLAN.length - 1), lb = b - P0 - k * 8;
    const cur = PLAN[k][3], nxt = PLAN[Math.min(k + 1, PLAN.length - 1)][3], u = ease.inOutCubic(clamp((lb - 6) / 2));
    return (i) => { const a = formation(cur, i, n), c = formation(nxt, i, n); return [lerp(a[0], c[0], u), lerp(a[1], c[1], u)]; };
  }
  pose(t) {
    const b = bt(t), n = this.nDancers(t);
    this.cast.spawn(t, n - 1, [-9, -9, winTime(3), winTime(4)], 1.0);
    const k = clamp(Math.floor((b - P0) / 8), 0, PLAN.length - 1), canon = PLAN[k][6], lb = b - P0 - k * 8;
    const F = this.forms(b, n);
    const landU = clamp((b - 79) / 1);
    this.cast.pose(t, this.tracks, (i) => { const f = F(i); if (b < 80) return { x: f[0] - 6 * (1 - landU), z: f[1], ry: PI / 2 * (1 - landU), y: (1 - landU) * 3 }; return { x: f[0], z: f[1], ry: 0 }; },
      { canon: (i) => (lb < 4 ? canon * i : 0) });
    this.cast.zero.setNumber(Math.min(4, wins(t)));
    const hit = lb >= 4 && lb < 6;
    this.cast.all.forEach((c, i) => c.setGlow(1 + kick(t) * .6 + (hit ? 1.2 : 0)));
    // fade the crew to darkness in the last phrase
    if (b >= 136) this.cast.echoes.forEach(e => e.setDissolve(1 - clamp((b - 138) / 3)));
  }
  shot(t, cam, which) {
    const b = bt(t), k = clamp(Math.floor((b - P0) / 8), 0, PLAN.length - 1), lb = b - P0 - k * 8, typ = PLAN[k][4];
    const set = (p, q, fov, sh = .03) => { cam.position.set(p[0] + noise1(t * .7, 1) * sh, p[1] + noise1(t * .7, 2) * sh, p[2]); cam.lookAt(q[0], q[1], q[2]); cam.fov = fov; cam.updateProjectionMatrix(); };
    const u = lb / 8;
    if (lb >= 4 && lb < 6 && which === 'hit') { // freeze camera: slow drift
      set([Math.sin(k * 1.7) * 6, 1.4 + (k % 3) * .8, Math.cos(k * 1.7) * 6], [0, 1, 0], 32, .005); return; }
    switch (typ) {
      case 'land': set([lerp(5, 3, u), lerp(.4, .9, u), lerp(6.5, 5.5, u)], [0, 1, 0], 34, .05); break;
      case 'front': set([0, 1.3, lerp(8.5, 6, u)], [0, 1.1, 0], 34); break;
      case 'orbit': { const a = lerp(-.9, .9, ease.inOutSine(u)); set([Math.sin(a) * 6.5, 1.8, Math.cos(a) * 6.5], [0, 1, 0], 36); break; }
      case 'crane': set([lerp(-3, 3, u), lerp(9, 1.2, ease.inOutCubic(u)), lerp(7, 6, u)], [0, 1, 0], 38); break;
      case 'hero': set([lerp(-1.2, 1.2, u), .35, 4.6], [0, 1.5, 0], 40, .06); break;
      case 'side': set([7.5, 1.2, lerp(2, -1, u)], [0, 1, -.5], 32); break;
      case 'front2': set([0, lerp(3.5, 1.4, u), lerp(9, 7, u)], [0, 1, 0], 36); break;
      case 'push': set([lerp(.6, .4, u), lerp(1.4, 1.5, u), lerp(5, 2.2, ease.inOutSine(u))], [0, 1.35, 0], 32, .02); break;
    }
  }
  draw3D(t, which = 'A') {
    const eng = this.app.eng, b = bt(t), k = clamp(Math.floor((b - P0) / 8), 0, PLAN.length - 1), lb = b - P0 - k * 8;
    const hit = lb >= 4 && lb < 6, style = PLAN[k][5];
    const last = b >= 136 ? 1 - clamp((b - 137) / 3) : 1;
    const pulse = kick(t);
    this.lights({ ...this.L0(b), key: [.5 * last + .1, .45 * last + .1, .6 * last + .12],
      points: [[[-6, 3.5, 4], [2.2 * last, .5 * last, 1.8 * last], 13], [[6, 3.5, 4], [.4 * last, 1.4 * last, 2.4 * last], 13], [[0, 4.5, -1], [2.5 + pulse * 2, 1.9 + pulse, 1.2], 9]] });
    G.uTime.value = t; this.haze.U.uTime.value = t;
    this.beams.forEach((c, i) => { const a = Math.sin(b * PI / 4 + i * PI) * .35; c.rotation.set(0, 0, PI + c.s * (.45 + a * .4)); c.material.U.uInt.value = .2 * last * (1 + pulse * .5); });
    this.drawLED(t, b);
    this.pose(t);
    // floor ring on WIN III / IV
    const w = wins(t); const tw = t - winTime(w); this.floor.U.uRingT.value = (w >= 3 && tw < 3) ? tw : -1;
    if (hit && style === 'panels') {
      const cams = this.panelCams, ph = k * 2.1;
      const views = [[Math.sin(ph) * 5.5, 1.0, Math.cos(ph) * 5.5, 30], [0, 7.5, .01, 40], [Math.sin(ph + 2.4) * 3, 1.2, Math.cos(ph + 2.4) * 3, 26]];
      cams.forEach((c, i) => { const v = views[i]; c.position.set(v[0], v[1], v[2]); c.lookAt(0, i === 1 ? 0 : 1.1, 0); c.fov = v[3]; });
      this.mirror.render(this.scene, cams[0]);
      eng.renderPanels(which, this.scene, cams, [[0, 0, 630, 1080], [645, 0, 630, 1080], [1290, 0, 630, 1080]]);
      return;
    }
    this.shot(t, this.cam, hit ? 'hit' : 'main');
    this.mirror.render(this.scene, this.cam);
    eng.renderLayer(which, this.scene, this.cam);
  }
  drawLED(t, b) {
    const x = this.ledCtx, n = wins(t); x.fillStyle = '#05030a'; x.fillRect(0, 0, 256, 768);
    // EQ bars from the audio envelopes
    const bands = ['sub', 'kick', 'lowmid', 'mid', 'presence', 'air'];
    bands.forEach((bn, i) => { const v = env(bn, t); x.fillStyle = i < 2 ? '#ff4fd8' : '#7fd6ff'; for (let s = 0; s < 14; s++) if (s / 14 < v) x.fillRect(18 + i * 38, 740 - s * 16, 30, 12); });
    x.fillStyle = '#ffcf6b'; x.font = '700 260px "Big Shoulders"'; x.textAlign = 'center'; x.fillText(D.ROMAN[n] || '0', 128, 300 + Math.exp(-fract(b) * 6) * 8);
    x.font = '700 30px "JetBrains Mono"'; x.fillStyle = '#f2ead8'; x.fillText(`ROUND ${String(n).padStart(2, '0')}`, 128, 360);
    this.ledTex.needsUpdate = true;
  }
  fx(t) {
    const F = this.app.eng.fx, b = bt(t), k = clamp(Math.floor((b - P0) / 8), 0, PLAN.length - 1), lb = b - P0 - k * 8; const hit = lb >= 4 && lb < 6, style = PLAN[k][5];
    F.exposure = 1.05; F.bloom = 1.15; F.bloomThreshold = .7; F.temp = .05; F.tint = .1; F.sat = 1.1; F.contrast = 1.15; F.lift = [.012, .005, .02]; F.vignette = .45; F.grain = .05;
    F.ca = .0015 + kick(t) * .004;
    const w = wins(t), wi = impulse(t, winTime(Math.max(3, w)), 3); if (w >= 3) { F.flash = wi * .5; F.flashColor = [1, .75, .5]; }
    if (hit && style === 'ink') { const u = clamp((lb - 4) * 6) * (1 - clamp((lb - 5.8) * 5)); F.ink = u * .75; F.inkPaper = [.98, .78, .42]; F.inkInk = [.07, .03, .08]; F.inkScale = 5.5; F.inkAngle = .3 + k; }
    if (hit) F.flash = Math.max(F.flash, Math.exp(-(lb - 4) * 10) * .6);
    if (b >= 136) F.exposure *= lerp(1, .55, prog(b, 138, 142));
  }
  draw2D(t) {
    const E = this.app.eng, x = E.post.ctx, b = bt(t); E.post.used = true;
    const k = clamp(Math.floor((b - P0) / 8), 0, PLAN.length - 1), lb = b - P0 - k * 8, hit = lb >= 4 && lb < 6, style = PLAN[k][5];
    const w = wins(t); if (w >= 3 && w <= 4) D.drawWinCard(x, w, (t - winTime(w)) * 1000, { cache: this, y: 300, h: 230 });
    if (hit && style === 'panels') { // gutters + panel captions
      x.fillStyle = D.INK; x.fillRect(630, 0, 15, 1080); x.fillRect(1275, 0, 15, 1080);
      const cap = ['FREEZE', 'TOP', 'CLOSE']; cap.forEach((c, i) => { x.fillStyle = D.INK; x.fillRect(30 + i * 645, 980, 200, 52); D.text(x, c, 46 + i * 645, 1018, { size: 30, fam: 'JetBrains Mono', weight: 700, color: '#0b0910', track: 4 }); });
    }
    if (hit && style === 'ink') { const s = 1 + Math.exp(-(lb - 4) * 8) * .5; x.save(); x.translate(1760, 1000); x.scale(s, s); x.rotate(-.08);
      D.text(x, D.ROMAN[Math.max(1, w)], 0, 0, { size: 300, align: 'right', color: 'rgba(11,9,16,.7)' }); x.restore();
      D.halftoneRect(x, 0, 0, 520, 1080, { color: '#120a14', cell: 16, alpha: .5, grad: (u) => 1 - u }); }
    if (!hit && b >= 80 && b < 136) { // beat ticks along the bottom: 8-count of the phrase
      for (let i = 0; i < 8; i++) { const on = i <= lb; x.fillStyle = i >= 4 && i < 6 ? D.EMBER : D.INK; x.globalAlpha = on ? .9 : .2; x.fillRect(800 + i * 42, 1032, 30, i === Math.floor(lb) ? 10 : 5); }
      x.globalAlpha = 1; }
  }
}
