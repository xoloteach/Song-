// ACT I — "THE GRIND": a rain-soaked rooftop at 3 a.m., one work lamp, the city below. Zero shadow-boxes
// on the beat until the 808 lands (WIN I) and his first echo splits away from him.
import * as THREE from 'three';
import { BaseScene } from './base.js';
import { G, skyDome, rain, particles, litMat, cardMat } from '../core/materials.js';
import { makeCity, bakeFarField, Mirror, wetFloor, rooftopDressing, workLamp, reflectable, LAYER_REFLECT } from '../core/props.js';
import { tb, bt, env, kick, beatPulse, SPB } from '../core/audio.js';
import { clamp, lerp, ease, smooth, prog, impulse, noise1, hash, fract } from '../core/util.js';
import { Cast, wins, winTime, clock } from '../story.js';
import * as D from '../core/draw2d.js';

export class Grind extends BaseScene {
  constructor(app) {
    super(app); const S = this.scene;
    this.sky = skyDome({ zenith: [.004, .006, .016], horizon: [.06, .035, .05], glowCol: [.25, .1, .05], glow: .6, sunDir: [-.3, .02, -1], stars: .5, haze: .8 }); S.add(this.sky);
    this.city = makeCity({ seed: 11, count: 650, area: [-320, 320, -420, 160], baseY: -90, minH: 30, maxH: 120, split: 110,
      heightFn: (x, z, h) => { const d = Math.hypot(x, z); return d < 120 ? 35 + (h - 30) * .55 : h + Math.min(1, d / 260) * 70; }, avoid: (x, z) => Math.hypot(x, z * 1.2) < 42,
      mat: { lit: .22, winGain: 1.25, seed: 2, accent: [1.2, .25, .15], floorH: 1.6, colW: 1.7 } });
    S.add(this.city); reflectable(this.city); reflectable(this.sky);
    // own building body under the roof
    const body = new THREE.Mesh(new THREE.BoxGeometry(24, 90, 18).translate(0, -45.02, 0), litMat({ color: [.03, .03, .035], spec: 0, rim: .1 })); S.add(body);
    this.mirror = new Mirror(app.eng.renderer, [960, 540], 0);
    this.floor = wetFloor([24, 18], this.mirror, { base: [.035, .036, .042], ripple: 1, rough: .016, reflAmt: .75 }); S.add(this.floor);
    this.dress = rooftopDressing({ w: 24, d: 18 }); S.add(this.dress); reflectable(this.dress);
    this.lamp = workLamp({ h: 4.3 }); this.lamp.position.set(-2.2, 0, -1.2); S.add(this.lamp); reflectable(this.lamp);
    this.cast = new Cast(S, 1); reflectable(this.cast.zero.root); reflectable(this.cast.echoes[0].root);
    this.rain = rain(5000, { box: [26, 18, 26], len: .55, intensity: .5, color: [.45, .55, .75], wind: [1.2, 0, .4] }); S.add(this.rain);
    this.mist = particles(600, { box: [30, 8, 30], origin: [0, 3, 0], vel: [.3, .05, .1], size: 2.2, color: [.4, .5, .7], intensity: .25, seed: 5 }); S.add(this.mist);
    // neon clock billboard (2D canvas -> 3D)
    const c = document.createElement('canvas'); c.width = 512; c.height = 200; this.clockCtx = c.getContext('2d'); this.clockTex = new THREE.CanvasTexture(c); this.clockTex.colorSpace = THREE.SRGBColorSpace;
    const bb = new THREE.Mesh(new THREE.PlaneGeometry(16, 6.25), cardMat(this.clockTex, { intensity: 3.5, fogMul: .5 })); bb.position.set(-34, 18, -46); bb.rotation.y = .35; S.add(bb); this.billboard = bb;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(17, 7, .5), litMat({ color: [.02, .02, .025], rim: .2 })); frame.position.copy(bb.position).add(new THREE.Vector3(.1, 0, -.4)); frame.rotation.y = .35; S.add(frame);
    this.lastClock = '';
    this.app.bakeQueue.push(() => { this.lights(this.L0); bakeFarField(app.eng.renderer, S, [this.city.far], this.sky, [0, 3, 0]); });
    // choreography (absolute beats)
    this.tracks = [[
      { b: -10, move: 'idle' }, { b: 12, move: 'guardBounce', blend: .5 }, { b: 16, move: 'box' }, { b: 28, move: 'box2' }, { b: 32, move: 'stomp' },
      { b: 36, move: 'box' }, { b: 40, move: 'breathe', blend: .8 }, { b: 44, move: 'idle', add: { hy: -.08 } }, { b: 46, move: 'guardBounce', blend: .4 },
      { b: 47.5, move: 'crouch', blend: .3 }, { b: 48, move: 'xHit', blend: .12 }, { b: 50, move: 'run', o: { rate: 2 }, blend: .3 }], [
      { b: 47, move: 'crouch' }, { b: 48, move: 'xHit', mirror: true, blend: .12 }, { b: 50, move: 'run', o: { rate: 2 }, blend: .3 }]];
  }
  get L0() { return { keyDir: [-.4, .55, -.7], key: [.25, .32, .55], sky: [.06, .07, .11], ground: [.05, .035, .03], rim: [.35, .5, 1.0], fog: [.018, .022, .045], fogD: .0075 }; }
  camShot(t, o) {
    const b = bt(t), C = this;
    if (o.shot === 'intro') { // seen through the drawn zero (0–5.8s): slow push toward the lone figure
      const u = clamp(t / tb(12)); C.camPath(t, [lerp(1.5, .9, u), lerp(1.4, 1.5, u), lerp(11, 6.5, ease.inOutSine(u))], [0, 1.25, 0], { fov: 32, shake: .02 }); return;
    }
    if (b < 20) { const u = prog(b, 12, 20); C.camPath(t, [lerp(-7.5, -5.5, u), lerp(.55, .75, u), lerp(7.5, 5.8, u)], [0, 1.6, -1.5], { fov: 30, shake: .03 }); }      // G1 low wide, lamp & city
    else if (b < 28) { const u = prog(b, 20, 28), a = lerp(.4, 1.25, ease.inOutSine(u)); C.camPath(t, [Math.sin(a) * 3, 1.35, Math.cos(a) * 3], [0, 1.2, 0], { fov: 38, shake: .04 }); } // G2 orbit medium
    else if (b < 32) { const u = prog(b, 28, 32); C.camPath(t, [lerp(2.6, 2.2, u), .22, lerp(2.3, 2.0, u)], [-.1, .35, 0], { fov: 30, shake: .02 }); }           // G3 feet & puddles
    else if (b < 40) { const u = ease.inOutCubic(prog(b, 32, 40)); C.camPath(t, [lerp(2, 9, u), lerp(2.5, 16, u), lerp(4, 12, u)], [0, lerp(1, 0, u), lerp(0, -4, u)], { fov: lerp(40, 46, u), shake: .03 }); } // G4 crane reveal
    else if (b < 44) { const u = prog(b, 40, 44); C.camPath(t, [lerp(.75, .6, u), 1.55, lerp(1.25, 1.05, u)], [0, 1.45, 0], { fov: 30, shake: .015 }); }          // G5 visor close
    else if (b < 48) { const u = ease.inQuart(prog(b, 44, 48)); C.camPath(t, [lerp(.3, 2.8, u), lerp(.8, 1.3, u), lerp(2.6, 7.5, u)], [0, lerp(1, 1.2, u), 0], { fov: lerp(36, 28, u), shake: .02 + u * .05 }); } // G6 pull-back build
    else { const u = prog(b, 48, 51); C.camPath(t, [lerp(-.8, -2.0, u), lerp(.5, .65, u), lerp(5.5, 6.8, u)], [.5, 1.4, 0], { fov: 34, shake: .05 + kick(t) * .06 }); } // WIN I hero low
  }
  draw3D(t, which = 'A', o = {}) {
    const b = bt(t), eng = this.app.eng;
    const lampFlick = .92 + .08 * noise1(t * 9, 3) - (hash(Math.floor(t * 12)) > .985 ? .4 : 0);
    const win = wins(t) >= 1 ? impulse(t, winTime(1), 2.5) : 0;
    const beacon = fract(t * .5) < .12 ? 1 : 0;
    this.lights({ ...this.L0, points: [[[-1.2, 3.95, -1.2], [5.5 * lampFlick + win * 6, 3.4 * lampFlick + win * 4, 1.6 * lampFlick + win * 1.5], 9], [[9, 9, -4], [beacon * 3, .1 * beacon, .05 * beacon], 7],
        [[0, 1.2, 1.5], [win * 4, win * 2.6, win * 1.0], 7]] });
    this.dress.beacon.material.U.uEmissiveAmt.value = .1 + beacon;
    this.lamp.cone.material.U.uInt.value = .32 * lampFlick; this.lamp.bulb.material.U.uEmissiveAmt.value = lampFlick;
    G.uTime.value = t; this.rain.U.uTime.value = t; this.mist.U.uTime.value = t;
    // clock billboard
    const ck = clock(t); if (ck !== this.lastClock) { this.lastClock = ck; const x = this.clockCtx; x.clearRect(0, 0, 512, 200); x.fillStyle = 'rgba(30,4,4,.9)'; x.fillRect(0, 0, 512, 200);
      x.font = '700 170px "Big Shoulders"'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#ff3b2a'; x.shadowColor = '#ff2a1a'; x.shadowBlur = 20; x.fillText(ck, 256, 108); this.clockTex.needsUpdate = true; }
    // cast
    const echoOn = t >= winTime(1) - .02; this.cast.spawn(t, echoOn ? 1 : 0, [winTime(1)], 1.0);
    this.cast.pose(t, this.tracks, (i, bb) => {
      if (i === 0) { const run = clamp((bb - 50) / 2); return { x: 0, z: 0, ry: run * -Math.PI / 2 }; }
      const s = ease.outCubic(clamp(bb - 48)); return { x: lerp(0, -1.3, s), z: lerp(-.05, -.3, s), ry: 0 };
    });
    this.cast.zero.setNumber(Math.min(wins(t), 1)); this.cast.zero.setGlow(1 + win * 2 + kick(t) * .3);
    if (echoOn) this.cast.echoes[0].setGlow(1 + win * 2);
    // floor shock ring at WIN I
    this.floor.U.uRingT.value = t >= winTime(1) ? (t - winTime(1)) : -1; this.floor.U.uRingC.value.set(0, 0, 0);
    this.camShot(t, o);
    this.rain.U.uCenter.value.copy(this.cam.position);
    const DBG = window.DBG || '';
    this.rain.visible = !DBG.includes('rain'); this.city.near.visible = !DBG.includes('city'); this.mist.visible = !DBG.includes('mist');
    if (!DBG.includes('mirror')) this.mirror.render(this.scene, this.cam);
    eng.renderLayer(which, this.scene, this.cam);
  }
  fx(t) {
    const F = this.app.eng.fx, b = bt(t);
    F.exposure = 1.05; F.bloom = 1.0; F.bloomThreshold = .7; F.temp = -.15; F.sat = .95; F.contrast = 1.1; F.lift = [.01, .012, .025]; F.gain = [1.0, 1.0, 1.05]; F.vignette = .45; F.grain = .05;
    F.ca = .0015 + kick(t) * .002;
    if (b >= 48) { const w = impulse(t, winTime(1), 3); F.flash = w * .55; F.flashColor = [1, .85, .55]; F.ca = .002 + w * .012; F.exposure += w * .3; F.shake = [noise1(t * 30, 1) * .004 * w, noise1(t * 30, 2) * .004 * w]; }
    if (b >= 44 && b < 48) F.exposure *= lerp(1, 1.12, prog(b, 44, 48));
  }
  draw2D(t) {
    const E = this.app.eng, x = E.post.ctx, b = bt(t); E.post.used = true;
    // lower-third credit
    const ca = clamp((b - 14) / 2) * (1 - clamp((b - 26) / 2));
    if (ca > 0) { x.save(); x.globalAlpha = ca; const sl = (1 - ease.outCubic(clamp((b - 14) / 2))) * 40;
      D.text(x, 'ANNO DOMINI BEATS', 96 - sl, 930, { size: 26, fam: 'Inter Display', weight: 700, track: 9, color: D.INK });
      D.text(x, '“TEN”', 92 - sl * 1.5, 1004, { size: 84, color: D.GOLD, track: 4 }); x.fillStyle = D.GOLD; x.fillRect(96, 944, 300 * ease.outCubic(clamp((b - 14.5) / 2)), 3); x.restore(); }
    // rep counter during the grind (one rep per beat, kinetic)
    if (b >= 16 && b < 40) { const rep = Math.floor(b - 15), f = fract(b); const pop = 1 + .25 * Math.exp(-f * 8);
      x.save(); x.translate(1640, 560); x.scale(pop, pop); D.text(x, String(rep).padStart(3, '0'), 0, 0, { size: 170, align: 'center', color: 'rgba(242,234,216,.0)', stroke: 'rgba(242,234,216,.85)', lw: 3 });
      D.text(x, 'REPS', 0, 52, { size: 26, fam: 'JetBrains Mono', align: 'center', track: 10, color: D.INK, alpha: .8 }); x.restore();
      // tally strokes accumulate under it (relentless work)
      D.tally(x, Math.min(20, rep % 20 + 1), 1490, 640, 60, { color: 'rgba(242,234,216,.6)', lastProg: ease.outCubic(clamp(f * 3)) }); }
    // build: stopwatch ticks closing in
    if (b >= 44 && b < 48) { const u = prog(b, 44, 48); x.save(); x.translate(960, 540); x.strokeStyle = D.GOLD; x.lineWidth = 4;
      const n = 32, on = Math.floor(u * n * 1.0001);
      for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * Math.PI * 2, r = lerp(620, 430, ease.inQuad(u)); x.globalAlpha = i < on ? .95 : .18; x.beginPath(); x.moveTo(Math.cos(a) * r, Math.sin(a) * r); x.lineTo(Math.cos(a) * (r - 34), Math.sin(a) * (r - 34)); x.stroke(); }
      x.restore(); }
    // WIN I card
    if (b >= 48) D.drawWinCard(x, 1, (t - winTime(1)) * 1000, { cache: this, y: 300, h: 230 });
  }
}
