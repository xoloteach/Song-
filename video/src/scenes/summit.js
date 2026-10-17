// ACTS V–VII on one set — the stage on top of the tower, from midnight show to sunrise.
//  ARENA (WIN VII–VIII, 99.1–129.6s): crowd, halo light-rig, lasers; 8-beat phrases with freezes on 808 drop-outs.
//  NINE  (WIN IX, 129.6–144.8s): the 808 vanishes; echoes dissolve into light; memories float by as photographs
//        of earlier scenes; one by one the echoes return; the opening stopwatch comes back and closes.
//  TEN   (WIN X, 144.8–160.1s): sunrise; the Blender "10" monument rises; ten dancers, one choreography.
//  OUTRO (160.1–163.5s): the last pose prints itself into ink and becomes the title card.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { BaseScene } from './base.js';
import { G, skyDome, litMat, glowMat, lightCone, particles, cardMat, SKYTEX } from '../core/materials.js';
import { makeCity, bakeFarField, Mirror, wetFloor, reflectable, DIGITS } from '../core/props.js';
import { tb, bt, kick, env, snare, beatPulse } from '../core/audio.js';
import { clamp, lerp, ease, prog, impulse, noise1, hash, fract, PI, TAU, mix3 } from '../core/util.js';
import { Cast, wins, winTime, TINTS } from '../story.js';
import { formation } from './crew.js';
import * as D from '../core/draw2d.js';

const ARENA = [
  ['stomp', 'xHold', 'xHit', 'circle', 'orbitLow', 'ink', 0],
  ['chestPop', 'power', 'spin', 'X', 'top', 'panels', .15],
  ['armWave', 'point', 'stomp', 'line', 'front', 'ink', .2],
  ['runningMan', 'lean', 'spin', 'V', 'crane', 'invert', 0],
  ['stomp', 'starHold', 'xHit', 'circle', 'hero', 'ink', 0],
  ['stepTouch', 'kneelPoint', 'stomp', 'X', 'top', 'panels', .25],
  ['box', 'xHold', 'spin', 'wedge2', 'orbit', 'ink', 0],
  ['bounce', 'fistChest', 'idle', 'circle', 'pullback', 'none', 0],
];
const TEN = [
  ['stomp', 'starHold', 'xHit', 'line10', 'sunrise', 'gold', 0],
  ['armWave', 'xHold', 'spin', 'X', 'top', 'panels', .12],
  ['stepTouch', 'victory', 'stomp', 'V', 'hero', 'gold', .1],
  ['chestPop', 'starHold', 'victory', 'line10', 'crane', 'gold', 0],
];
const A0 = 208, N0 = 272, T0 = 304, END = 336;
const phase = (b) => b < N0 ? 'arena' : b < T0 ? 'nine' : 'ten';
function phraseOf(b) { if (b < N0) { const k = clamp(Math.floor((b - A0) / 8), 0, 7); return { plan: ARENA[k], k, lb: b - A0 - k * 8, P0: A0, P: ARENA }; }
  const k = clamp(Math.floor((b - T0) / 8), 0, 3); return { plan: TEN[k], k, lb: b - T0 - k * 8, P0: T0, P: TEN }; }

export class Summit extends BaseScene {
  constructor(app) {
    super(app); const S = this.scene;
    this.sky = skyDome({ zenith: [.003, .004, .014], horizon: [.035, .02, .05], glowCol: [.2, .06, .12], glow: .3, sunDir: [0, .05, -1], stars: .7, haze: .4 }); S.add(this.sky); reflectable(this.sky);
    this.city = makeCity({ seed: 77, count: 650, area: [-360, 360, -360, 360], baseY: -110, minH: 40, maxH: 150, split: 1,
      heightFn: (x, z, h) => h * .8, avoid: (x, z) => Math.hypot(x, z) < 40, mat: { lit: .26, winGain: 1.3, seed: 9, floorH: 1.6, colW: 1.7, warm: [1.5, .8, .9] } });
    S.add(this.city);
    // stage
    const pc = document.createElement('canvas'); pc.width = pc.height = 1024; const x = pc.getContext('2d'); x.strokeStyle = '#ffc46e';
    for (const [r, w] of [[500, 8], [430, 3], [300, 5], [120, 3]]) { x.lineWidth = w; x.beginPath(); x.arc(512, 512, r, 0, TAU); x.stroke(); }
    x.lineWidth = 6; x.beginPath(); x.moveTo(512 - 300 * .707, 512 - 300 * .707); x.lineTo(512 + 300 * .707, 512 + 300 * .707); x.moveTo(512 + 300 * .707, 512 - 300 * .707); x.lineTo(512 - 300 * .707, 512 + 300 * .707); x.stroke();
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; x.save(); x.translate(512 + Math.cos(a) * 466, 512 + Math.sin(a) * 466); x.rotate(a + PI / 2); x.font = '700 44px "Big Shoulders"'; x.fillStyle = '#ffc46e'; x.textAlign = 'center'; x.fillText(D.ROMAN[i + 1], 0, 14); x.restore(); }
    const pt = new THREE.CanvasTexture(pc); pt.colorSpace = THREE.SRGBColorSpace;
    this.mirror = new Mirror(app.eng.renderer, [960, 540], 0);
    this.floor = wetFloor([18, 18], this.mirror, { geo: new THREE.CircleGeometry(9, 96), base: [.03, .028, .04], pattern: pt, patternGain: .5, reflAmt: .9, rough: .012, wet: .85 }); S.add(this.floor);
    // stepped tiers (lathe) + glowing stage rim
    const prof = [new THREE.Vector2(9, 0), new THREE.Vector2(9, -.8), new THREE.Vector2(11.5, -.8), new THREE.Vector2(11.5, -1.6), new THREE.Vector2(14, -1.6), new THREE.Vector2(14, -2.4), new THREE.Vector2(16.5, -2.4), new THREE.Vector2(16.5, -40)];
    this.tierM = litMat({ color: [.04, .04, .05], spec: .2, rim: 0 }); S.add(new THREE.Mesh(new THREE.LatheGeometry(prof, 96), this.tierM));
    this.rimM = litMat({ color: [0, 0, 0], emissive: [2.4, 1.4, .5], rim: 0 }); const rimT = new THREE.Mesh(new THREE.TorusGeometry(9, .06, 8, 128), this.rimM); rimT.rotation.x = PI / 2; S.add(rimT); reflectable(rimT);
    // crowd: hands-up silhouettes, instanced, bouncing in the vertex shader on the beat
    const body = new THREE.CapsuleGeometry(.22, .8, 3, 8).translate(0, .7, 0), head = new THREE.SphereGeometry(.15, 8, 6).translate(0, 1.42, 0);
    const armL = new THREE.CapsuleGeometry(.06, .55, 2, 6).rotateZ(-.45).translate(.32, 1.55, 0), armR = new THREE.CapsuleGeometry(.06, .55, 2, 6).rotateZ(.45).translate(-.32, 1.55, 0);
    const cg = mergeGeometries([body, head, armL, armR].map(g => g.toNonIndexed()));
    this.crowdU = { uBeat: { value: 0 }, uAmp: { value: 0 }, uLite: { value: 0 } };
    const cm = litMat({ color: [.03, .03, .04], spec: .2, rim: 1.4, rimPow: 2.5, rimTint: [1, 1, 1] });
    cm.uniforms.uBeat = this.crowdU.uBeat; cm.uniforms.uAmp = this.crowdU.uAmp;
    cm.vertexShader = cm.vertexShader.replace('void main(){', 'uniform float uBeat, uAmp;\nvoid main(){').replace('p = instanceMatrix * p;', 'float ph = fract(float(gl_InstanceID) * .618); float jump = uAmp * max(0., sin((uBeat + ph * .3) * 6.2831853)) * (.5 + ph); p.y += jump * .35; if (position.y > 1.2) p.x *= 1. + .15 * sin(uBeat * 3.14159 + ph * 6.); p = instanceMatrix * p;');
    const N = 420; this.crowd = new THREE.InstancedMesh(cg, cm, N); const d = new THREE.Object3D();
    for (let i = 0; i < N; i++) { const tier = i % 3, r = [10.4, 12.9, 15.4][tier] + (hash(i) - .5) * .8, a = hash(i * 7 + 1) * TAU; const y = [-.8, -1.6, -2.4][tier];
      d.position.set(Math.cos(a) * r, y, Math.sin(a) * r); d.rotation.y = -a - PI / 2 + (hash(i + 3) - .5) * .6; d.scale.setScalar(.9 + hash(i + 9) * .25); d.updateMatrix(); this.crowd.setMatrixAt(i, d.matrix); }
    S.add(this.crowd);
    this.phones = particles(260, { box: [34, 1.2, 34], origin: [0, .3, 0], vel: [0, 0, 0], size: 3, color: [1, 1, 1], color2: [.7, .9, 1], intensity: 0, seed: 21 }); S.add(this.phones);
    // halo light rig with hanging spot cones
    this.halo = new THREE.Group(); const haloM = litMat({ color: [0, 0, 0], emissive: [2.2, 1.3, .5], rim: 0 }); this.haloM = haloM;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(10, .12, 8, 128), haloM); ring.rotation.x = PI / 2; this.halo.add(ring);
    this.spots = []; for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; const c = lightCone(13, 2.6, { color: TINTS[i % 9], intensity: .18, falloff: 1.0, edge: 2, dust: .6 }); c.position.set(Math.cos(a) * 10, 0, Math.sin(a) * 10); c.a = a; this.halo.add(c); this.spots.push(c); }
    this.halo.position.y = 12; S.add(this.halo);
    // laser fans
    this.lasers = []; for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(.05, 60).translate(0, 30, 0), glowMat({ mode: 2, color: i % 2 ? [.3, 1.6, 2.2] : [2.4, .4, 1.6], intensity: 1.5, falloff: .3, edge: 1, dust: 0 })); m.position.set(Math.cos(i / 16 * TAU) * 9, 0, Math.sin(i / 16 * TAU) * 9); S.add(m); this.lasers.push(m); }
    // floating screens
    const sc = document.createElement('canvas'); sc.width = 640; sc.height = 360; this.scrCtx = sc.getContext('2d'); this.scrTex = new THREE.CanvasTexture(sc); this.scrTex.colorSpace = THREE.SRGBColorSpace;
    this.screens = [-1, 1].map(s => { const m = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 5.4), cardMat(this.scrTex, { intensity: 1.8 })); m.position.set(s * 14, 8, -14); m.lookAt(0, 6, 0); S.add(m); return m; });
    // the monument (Blender): 1 and 0 on a stepped plinth, behind the stage toward the sunrise
    const gold = litMat({ color: [.3, .2, .08], spec: 1.4, shin: 80, rim: .6, rimTint: [1, .75, .4], matcap: 'gold', matcapAmt: 1.2, emissive: [.25, .14, .04] }); this.goldM = gold;
    this.mono = new THREE.Group();
    for (const k of ['mono_one', 'mono_zero', 'mono_plinth']) { const dd = DIGITS[k]; if (!dd) continue; const m = new THREE.Mesh(dd.geo, k === 'mono_plinth' ? litMat({ color: [.08, .07, .07], spec: .5, rim: .2, matcap: 'pearl_dawn', matcapAmt: .4 }) : gold); m.position.copy(dd.pos); this.mono.add(m); }
    this.mono.scale.setScalar(2.1); this.mono.position.set(0, -30, -34); S.add(this.mono);
    this.monoGlow = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), glowMat({ mode: 1, color: [1.6, .9, .4], intensity: 0, falloff: 1.6 })); this.monoGlow.position.set(0, 14, -40); S.add(this.monoGlow);
    // particles: haze, embers, confetti
    this.haze = particles(600, { box: [30, 12, 30], origin: [0, 5, 0], vel: [.15, .1, .1], size: 2.4, color: [.9, .6, 1.0], color2: [.5, .8, 1.0], intensity: .1, seed: 4 }); S.add(this.haze);
    this.confetti = particles(1400, { box: [26, 18, 26], origin: [0, 9, 0], vel: [.2, -1.6, .1], size: 4.5, color: [2.2, 1.5, .6], color2: [2, 2, 1.8], intensity: 0, seed: 8 }); S.add(this.confetti);
    // echo return pillars
    this.pillars = Array.from({ length: 9 }, (_, i) => { const c = lightCone(30, .9, { color: TINTS[i], intensity: 0, falloff: .5, edge: 3, dust: .4 }); c.rotation.x = PI; S.add(c); return c; });
    // memories (photographs of earlier scenes, captured at init)
    this.cards = [];
    this.cast = new Cast(S, 9); this.cast.all.forEach(c => reflectable(c.root));
    this.tracks = this.cast.all.map((c, i) => this.track(i));
    app.bakeQueue.push(() => {
      const r = app.eng.renderer, U = this.sky.material.U, cityM = this.city.U;
      this.lights(this.Lnight); U.uCubeAmt.value = 0; this.cubeNight = bakeFarField(r, S, [this.city.far], this.sky, [0, 3, 0], 1024, { noApply: true });
      // dawn bake: predawn Blender sky, windows dimming
      U.uStars.value = 0; U.uTexAmt.value = SKYTEX.predawn ? 1 : 0; U.uTex.value = SKYTEX.predawn || null; U.uTexExp.value = .9; cityM.uLit.value = .14; this.lights(this.Ldawn);
      this.cubeDawn = bakeFarField(r, S, [this.city.far], this.sky, [0, 3, 0], 1024, { noApply: true });
      U.uTex.value = SKYTEX.sunrise || null; U.uTexExp.value = 1.0; cityM.uLit.value = .05; this.lights(this.Lsun);
      this.cubeSun = bakeFarField(r, S, [this.city.far], this.sky, [0, 3, 0], 1024, { noApply: true });
      U.uTexAmt.value = 0; cityM.uLit.value = .26; this.city.far.visible = false; U.uCubeAmt.value = 1; U.uCube.value = this.cubeNight.texture;
    });
  }
  get Lnight() { return { keyDir: [.1, .9, .3], key: [.35, .3, .45], sky: [.07, .05, .1], ground: [.03, .02, .03], rim: [1.0, .4, .9], fog: [.02, .015, .035], fogD: .004 }; }
  get Ldawn() { return { keyDir: [0, .25, -1], key: [.35, .25, .35], sky: [.12, .11, .2], ground: [.05, .035, .04], rim: [.9, .55, .6], fog: [.09, .07, .13], fogD: .004 }; }
  get Lsun() { return { keyDir: [0, .2, -1], key: [2.4, 1.5, .7], sky: [.3, .3, .45], ground: [.2, .12, .08], rim: [2.4, 1.4, .6], fog: [.35, .25, .25], fogD: .0035 }; }
  setMemories(texs) { const S = this.scene; texs.forEach((t, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.84), cardMat(t, { intensity: 1.15 })); m.visible = false; S.add(m); this.cards.push(m); }); }
  track(i) {
    const tr = [{ b: 196, move: 'point' }, { b: 206, move: 'lookUp' }];
    ARENA.forEach(([gm, fp, tm], k) => { const b = A0 + k * 8; tr.push({ b, move: k === 0 ? 'stomp' : gm, blend: k === 0 ? .1 : .3 }); tr.push({ b: b + 4, move: fp, blend: .12 }); tr.push({ b: b + 6, move: tm, blend: .2, o: { len: 2, turns: i % 2 ? -1 : 1 } }); });
    if (i === 0) tr.push({ b: N0, move: 'lookUp', blend: 1 }, { b: 277, move: 'breathe', blend: 1.5 }, { b: 284, move: 'idle', blend: 1.5 }, { b: 289, move: 'lookUp', blend: 1.5 });
    else tr.push({ b: N0, move: 'lookUp', blend: 1 }, { b: 288, move: 'xHold', blend: .5 });
    tr.push({ b: 296, move: 'crouch', blend: 2 }, { b: 303.25, move: 'crouchArmsBack', blend: .4 }, { b: T0, move: 'jump', blend: .1 });
    TEN.forEach(([gm, fp, tm], k) => { const b = T0 + k * 8; if (k > 0) tr.push({ b, move: gm, blend: .3 }); else tr.push({ b: b + 2.4, move: gm, blend: .4 }); tr.push({ b: b + 4, move: fp, blend: .12 }); tr.push({ b: b + 6, move: tm, blend: .2, o: { len: 2 } }); });
    tr.push({ b: 334, move: 'victory', blend: .3 });
    return tr;
  }
  nEcho(t) { return Math.min(9, wins(t)); }
  place(i, b) {
    const ph = phase(b);
    if (ph === 'nine') { // Zero centre facing the dawn; echoes gather in a circle around him
      if (i === 0) return { x: 0, z: 0, ry: PI * lerp(1, 1, 0) };
      const a = (i - 1) / 9 * TAU + PI / 2; const r = 3.4; return { x: Math.cos(a) * r, z: Math.sin(a) * r, ry: -a - PI / 2 };
    }
    const { plan, lb, P0, P, k } = phraseOf(b), n = this.nEcho(tb(b)) + 1;
    const nxt = P[Math.min(k + 1, P.length - 1)], u = ease.inOutCubic(clamp((lb - 6) / 2)), sc = ph === 'ten' ? 1.15 : 1.05;
    const fa = formation(plan[3], i, n), fb = formation(nxt[3], i, n);
    let x = lerp(fa[0], fb[0], u) * sc, z = lerp(fa[1], fb[1], u) * sc;
    if (ph === 'ten' && lb < 2.4 && k === 0) { const a = (i - 1) / 9 * TAU + PI / 2, uu = ease.inOutCubic(clamp(lb / 2.4)); if (i > 0) { x = lerp(Math.cos(a) * 3.4, x, uu); z = lerp(Math.sin(a) * 3.4, z, uu); } }
    if (ph === 'arena' && b < A0 + 1) { const u2 = ease.outCubic(clamp(b - A0 + .3)); x *= u2; z *= u2; }
    return { x, z, ry: 0 };
  }
  draw3D(t, which = 'A', o = {}) {
    const eng = this.app.eng; const tFrozen = Math.min(t, tb(END)); const b = bt(tFrozen), ph = phase(b), k = kick(t), { lb, plan } = phraseOf(b);
    const hit = (ph !== 'nine') && lb >= 4 && lb < 6;
    const U = this.sky.material.U;
    // ---- lighting & sky per phase ----
    const dawnU = ph === 'nine' ? ease.inOutSine(prog(b, N0, T0)) : ph === 'ten' ? 1 : 0;
    const sunU = ph === 'ten' ? ease.outCubic(prog(b, T0 - .5, T0 + 6)) : 0;
    if (ph === 'arena') { const fade = 1 - prog(b, 266, 272) * .8; const L = this.Lnight;
      this.lights({ ...L, key: L.key.map(v => v * fade), points: [[[-6, 4, 5], [2.4 * fade + k, .5 * fade, 1.8 * fade], 15], [[6, 4, 5], [.4 * fade, 1.5 * fade, 2.6 * fade + k], 15], [[0, 6, 0], [2.6 * fade + k * 3, 1.8 * fade + k * 2, 1.0 * fade + k], 12]] });
      U.uCube.value = this.cubeNight?.texture; U.uCubeMix.value = 0; }
    else if (ph === 'nine') { const L = this.Ldawn; this.lights({ ...L, key: mix3([.05, .05, .1], L.key, dawnU), points: [[[0, 3, 2], [.5, .45, .6], 9]] });
      U.uCube.value = this.cubeNight?.texture; U.uCube2.value = this.cubeDawn?.texture; U.uCubeMix.value = dawnU; }
    else { const L = this.Lsun, Ld = this.Ldawn; this.lights({ keyDir: L.keyDir, key: mix3(Ld.key, L.key, sunU), sky: mix3(Ld.sky, L.sky, sunU), ground: mix3(Ld.ground, L.ground, sunU), rim: mix3(Ld.rim, L.rim, sunU), fog: mix3(Ld.fog, L.fog, sunU), fogD: .0035,
      points: [[[0, 4, 6], [1.2 + k * 1.5, .9 + k, .6], 14], [[0, 8, -10], [3 * sunU, 1.8 * sunU, .8 * sunU], 30]] });
      U.uCube.value = this.cubeDawn?.texture; U.uCube2.value = this.cubeSun?.texture; U.uCubeMix.value = sunU; }
    G.uTime.value = tFrozen; this.haze.U.uTime.value = tFrozen; this.confetti.U.uTime.value = tFrozen; this.phones.U.uTime.value = tFrozen;
    // ---- rig, crowd, lasers ----
    const arena = ph === 'arena' ? 1 - prog(b, 266, 272) : 0, ten = ph === 'ten' ? 1 : 0;
    this.halo.rotation.y = b * .06; this.haloM.U.uEmissiveAmt.value = arena * (1 + k) + ten * .6 + (ph === 'nine' ? .1 : 0);
    this.spots.forEach((c, i) => { const sw = Math.sin(b * PI / 4 + i) * .35; c.rotation.set(sw, 0, Math.cos(b * PI / 4 + i * 1.3) * .35); c.material.U.uInt.value = .1 * arena * (1 + k * .8) + .03 * ten; });
    this.lasers.forEach((m, i) => { m.visible = arena > 0 && (b >= 216 && b < 264); const s = i % 2 ? 1 : -1; m.rotation.set(Math.sin(b * PI / 2 + i) * .6, 0, s * (.5 + .4 * Math.sin(b * PI / 4))); m.material.U.uInt.value = 1.2 * arena * (fract(b) < .5 ? 1 : .3); });
    this.crowdU.uBeat.value = b; this.crowdU.uAmp.value = ph === 'arena' ? (subOnLike(b) ? 1 : .4) * arena : ph === 'ten' ? 1 : 0;
    this.phones.U.uInt.value = ph === 'nine' ? .8 * (1 - dawnU) : ph === 'arena' ? .5 : 0;
    this.rimM.U.uEmissiveAmt.value = .5 + arena * (.5 + k) + ten;
    this.drawScreen(t, b);
    this.screens.forEach(s => s.visible = ph !== 'nine');
    // monument rises at X
    const mu = ph === 'ten' ? ease.outCubic(prog(b, T0, T0 + 5)) : 0; this.mono.position.y = lerp(-32, -2.5, mu) + (mu < 1 && mu > 0 ? noise1(t * 40, 2) * .15 : 0); this.mono.visible = mu > 0;
    this.goldM.U.uEmissiveAmt.value = .6 + k * .5; this.monoGlow.material.U.uInt.value = sunU * .5;
    this.confetti.U.uInt.value = ph === 'ten' ? .55 * clamp((b - T0) * 2) : 0;
    // ---- cast ----
    const nE = this.nEcho(t);
    const spawnT = Array.from({ length: 9 }, (_, i) => i === 6 ? winTime(7) : i === 7 ? winTime(8) : -9);
    this.cast.spawn(t, nE, spawnT, 1);
    if (ph === 'nine') this.cast.echoes.forEach((e, i) => { // dissolve away, then return one per beat from 288
      const out = 1 - clamp((b - (N0 + .5 + i * .35)) / 2), back = clamp((b - (288 + i * .85)) / 1.2); e.root.visible = true; e.setDissolve(Math.max(out, back)); e.setGlow(1.5 + back * (1 - back) * 6); });
    this.pillars.forEach((p, i) => { const a = i / 9 * TAU + PI / 2; p.position.set(Math.cos(a) * 3.4, 0, Math.sin(a) * 3.4); const tt = b - (288 + i * .85); p.material.U.uInt.value = ph === 'nine' && tt > -.2 ? .5 * Math.exp(-Math.max(0, tt) * 1.2) : 0; });
    this.cast.pose(tFrozen, this.tracks, (i, bb) => this.place(i, bb), { canon: (i) => (ph !== 'nine' && lb < 4 ? (plan[6] || 0) * i : 0) });
    this.cast.zero.setNumber(Math.min(10, wins(t)));
    this.cast.zero.setGlow(1 + k * .6 + (hit ? 1.5 : 0) + ten * .8); if (ph !== 'nine') this.cast.echoes.forEach((e, i) => e.setGlow(1 + k * .6 + (hit ? 1.2 : 0)));
    if (ph === 'ten') this.cast.echoes.forEach((e) => { e.m.cloth.U.uRimCol.value.setRGB(...mix3([1, 1, 1], [1.6, 1.2, .6], sunU)); });
    // ---- memories ----
    this.cards.forEach((m, i) => { const tt = b - (274 + i * 1.3); m.visible = ph === 'nine' && tt > 0 && tt < 16; if (!m.visible) return;
      const a = i * 2.39 + tt * .05, r = 4.5 + (i % 3) * 1.2; const fade = clamp(tt / 1.5) * (1 - clamp((b - 289 - i * .4) / 1.5));
      m.position.set(Math.cos(a) * r, 1.6 + (i % 4) * .55 + tt * .08, Math.sin(a) * r - 1); m.lookAt(this.cam.position); m.rotateZ(Math.sin(i * 3.1) * .12); m.material.U.uAlpha.value = fade; });
    // ---- floor ring at wins ----
    const w = wins(t), tw = t - winTime(Math.max(1, w)); this.floor.U.uRingT.value = (w >= 7 && tw < 3.5) ? tw : -1;
    // ---- camera ----
    if (hit && plan[5] === 'panels' && !o.noPanels) {
      if (!this.panelCams) this.panelCams = [0, 1, 2].map(() => new THREE.PerspectiveCamera(35, 1, .1, 3000));
      const ph2 = b * .1; const views = [[Math.sin(ph2) * 7, 1.2, Math.cos(ph2) * 7, 30], [0, 11, .01, 42], [Math.sin(ph2 + 2.4) * 3.5, 1.3, Math.cos(ph2 + 2.4) * 3.5, 28]];
      this.panelCams.forEach((c, i) => { const v = views[i]; c.position.set(v[0], v[1], v[2]); c.lookAt(0, i === 1 ? 0 : 1.1, 0); c.fov = v[3]; });
      this.mirror.render(this.scene, this.panelCams[0]); eng.renderPanels(which, this.scene, this.panelCams, [[0, 0, 630, 1080], [645, 0, 630, 1080], [1290, 0, 630, 1080]]); return;
    }
    this.shot(t, b, ph);
    this.mirror.render(this.scene, this.cam);
    eng.renderLayer(which, this.scene, this.cam);
  }
  shot(t, b, ph) {
    const set = (p, q, fov, sh = .03) => this.camPath(t, p, q, { fov, shake: sh });
    if (ph === 'nine') {
      if (b < 280) { const u = prog(b, N0, 280); set([lerp(.8, .5, u), lerp(1.2, 1.5, u), lerp(4.5, 3.4, u)], [0, 1.7, -6], 34, .01); }                        // behind Zero, toward the dawn
      else if (b < 288) { const u = prog(b, 280, 288), a = lerp(.8, 2.2, ease.inOutSine(u)); set([Math.sin(a) * 6, 1.8, Math.cos(a) * 6], [0, 1.4, 0], 38, .01); } // memories orbit
      else if (b < 296) { const u = prog(b, 288, 296); set([lerp(9, 7, u), lerp(9, 6, u), lerp(9, 7, u)], [0, .5, 0], 42, .01); }                         // echoes return, high
      else { const u = ease.inQuart(prog(b, 296, T0)); const a = lerp(.6, -1.1, u); set([Math.sin(a) * lerp(6, 1.0, u), lerp(1.4, 1.5, u), Math.cos(a) * lerp(6, 1.0, u)], [0, lerp(1.2, 1.5, u), 0], lerp(40, 30, u), .01 + u * .03); }
      return;
    }
    const { plan, lb, k } = phraseOf(b); const u = lb / 8, typ = plan[4];
    if (b >= END - .01) { const uu = prog(bt(t), END, END + 7); set([lerp(0, 0, uu), lerp(1.6, 1.8, uu), lerp(8.5, 7.2, ease.inOutSine(uu))], [0, lerp(2.2, 2.5, uu), -10], 36, .005); return; }
    if (lb >= 4 && lb < 6) { set([Math.sin(k * 1.9 + 1) * 7.5, 1.3 + (k % 3) * .9, Math.cos(k * 1.9 + 1) * 7.5], [0, 1.2, 0], 34, .005); return; }
    switch (typ) {
      case 'orbitLow': { const a = lerp(-1, .3, u); set([Math.sin(a) * 7, .5, Math.cos(a) * 7], [0, 1.6, 0], 38, .06); break; }
      case 'top': set([.01, lerp(13, 11, u), lerp(2, .5, u)], [0, 0, 0], 44); break;
      case 'front': set([0, 1.3, lerp(10, 7, u)], [0, 1.2, 0], 34); break;
      case 'crane': set([lerp(-4, 4, u), lerp(12, 1.5, ease.inOutCubic(u)), lerp(9, 7, u)], [0, 1.2, 0], 40); break;
      case 'hero': set([lerp(-1.5, 1.5, u), .3, 5.2], [0, 1.6, 0], 42, .06); break;
      case 'orbit': { const a = lerp(.9, -.9, ease.inOutSine(u)); set([Math.sin(a) * 8, 2.2, Math.cos(a) * 8], [0, 1, 0], 36); break; }
      case 'pullback': set([0, lerp(1.6, 6, u), lerp(5, 16, ease.inOutSine(u))], [0, 1.2, 0], 38, .01); break;
      case 'sunrise': { const uu = ease.outCubic(u); set([lerp(-2, 0, uu), lerp(.4, 1.3, uu), lerp(5, 11, uu)], [0, lerp(1.8, 4, uu), -10], 36, .04); break; }
    }
  }
  drawScreen(t, b) {
    const x = this.scrCtx, n = wins(t); x.fillStyle = '#07040c'; x.fillRect(0, 0, 640, 360);
    for (let i = 0; i < 32; i++) { const v = env(i < 10 ? 'sub' : i < 20 ? 'mid' : 'air', t - i * .01) * (.6 + .4 * hash(i)); x.fillStyle = i % 2 ? '#ff4fd8' : '#7fd6ff'; x.fillRect(20 + i * 19, 340 - v * 120, 13, v * 120); }
    x.fillStyle = '#ffcf6b'; x.font = '700 210px "Big Shoulders"'; x.textAlign = 'center'; x.fillText(D.ROMAN[n] || '', 320, 210 + Math.exp(-fract(b) * 6) * 6);
    this.scrTex.needsUpdate = true;
  }
  fx(t) {
    const F = this.app.eng.fx, b = Math.min(bt(t), END), ph = phase(b), { plan, lb, k } = phraseOf(b); const hit = ph !== 'nine' && lb >= 4 && lb < 6;
    F.exposure = 1.05; F.bloom = 1.15; F.bloomThreshold = .7; F.temp = 0; F.tint = .05; F.sat = 1.1; F.contrast = 1.15; F.lift = [.012, .006, .02]; F.vignette = .45; F.grain = .05; F.ca = .0015 + kick(t) * .004;
    if (ph === 'nine') { const u = prog(b, N0, T0); F.sat = lerp(.75, 1.0, u); F.temp = lerp(-.1, .1, u); F.contrast = 1.08; F.exposure = lerp(.95, 1.05, u); F.ca = .001; F.bloom = 1.0;
      if (b < N0 + 1) { F.flash = (1 - prog(b, N0, N0 + 1)) * .5; F.flashColor = [.8, .85, 1]; } }
    if (ph === 'ten') { F.temp = .25; F.sat = 1.12; F.contrast = 1.12; F.lift = [.02, .012, .02]; F.gain = [1.04, 1.0, .96]; F.bloom = 1.35; F.bloomThreshold = .65; }
    const w = wins(t); if (w >= 7) { const wi = impulse(t, winTime(w), 2.5); F.flash = Math.max(F.flash, wi * (w === 10 ? .75 : w === 9 ? .25 : .5)); if (wi > .01) F.flashColor = w === 10 ? [1, .85, .55] : [1, .8, .55]; F.ca += wi * .01; }
    if (hit) { const style = plan[5];
      if (style === 'ink') { const u = clamp((lb - 4) * 6) * (1 - clamp((lb - 5.8) * 5)); F.ink = u * .75; F.inkPaper = [.95, .55, .75]; F.inkInk = [.06, .02, .09]; F.inkScale = 5.5; F.inkAngle = .4 + k; }
      if (style === 'gold') { const u = clamp((lb - 4) * 6) * (1 - clamp((lb - 5.8) * 5)); F.ink = u * .7; F.inkPaper = [1, .82, .45]; F.inkInk = [.18, .07, .02]; F.inkScale = 5; F.inkAngle = .8 + k; }
      if (style === 'invert') { F.invert = fract((lb - 4) * 2) < .5 ? 1 : 0; }
      F.flash = Math.max(F.flash, Math.exp(-(lb - 4) * 10) * .6); }
    if (bt(t) >= END) { const u = prog(t, tb(END) + .15, tb(END) + .9); F.ink = ease.inOutCubic(u); F.inkPaper = [.95, .91, .83]; F.inkInk = [.07, .06, .12]; F.inkScale = lerp(5, 9, u); F.grain = .05; F.bloom = lerp(1.35, .4, u); }
  }
  draw2D(t) {
    const E = this.app.eng, x = E.post.ctx, b = bt(t), ph = phase(Math.min(b, END)); E.post.used = true;
    const w = wins(t);
    if (w === 7 || w === 8) D.drawWinCard(x, w, (t - winTime(w)) * 1000, { cache: this, y: 300, h: 230 });
    if (w === 9 && b < 286) D.drawWinCard(x, 9, (t - winTime(9)) * 1000 * .6, { cache: this, y: 330, h: 200, color: '#e9e0ff' });
    const { plan, lb, k } = phraseOf(Math.min(b, END)); const hit = ph !== 'nine' && b < END && lb >= 4 && lb < 6;
    if (hit && plan[5] === 'panels') { x.fillStyle = D.INK; x.fillRect(630, 0, 15, 1080); x.fillRect(1275, 0, 15, 1080);
      ['FREEZE', 'TOP', 'CLOSE'].forEach((c, i) => { x.fillStyle = D.INK; x.fillRect(30 + i * 645, 980, 200, 52); D.text(x, c, 46 + i * 645, 1018, { size: 30, fam: 'JetBrains Mono', weight: 700, color: '#0b0910', track: 4 }); }); }
    if (hit && (plan[5] === 'ink' || plan[5] === 'gold')) { const s = 1 + Math.exp(-(lb - 4) * 8) * .5; x.save(); x.translate(1760, 1000); x.scale(s, s); x.rotate(-.08);
      D.text(x, D.ROMAN[Math.max(1, w)], 0, 0, { size: 300, align: 'right', color: plan[5] === 'gold' ? 'rgba(60,20,5,.7)' : 'rgba(11,9,16,.7)' }); x.restore();
      if (ph === 'ten') D.brushX(x, 300, 300, 160, 46, ease.outCubic(clamp((lb - 4) * 1.5)), { color: 'rgba(60,20,5,.8)' }); }
    // NINE: the stopwatch returns, closing on X
    if (ph === 'nine' && b >= 296) { const u = prog(b, 296, T0); x.save(); x.translate(960, 540); const R = lerp(520, 300, ease.inQuad(u));
      for (let i = 0; i < 60; i++) { const a = -PI / 2 + i / 60 * TAU; const lit = i / 60 < u; const major = i % 5 === 0; x.strokeStyle = lit ? (major ? D.GOLD : D.INK) : 'rgba(242,234,216,.15)'; x.lineWidth = major ? 5 : 2;
        x.beginPath(); x.moveTo(Math.cos(a) * R, Math.sin(a) * R); x.lineTo(Math.cos(a) * (R + (major ? 34 : 16)), Math.sin(a) * (R + (major ? 34 : 16))); x.stroke(); }
      const ha = -PI / 2 + u * TAU; x.strokeStyle = D.EMBER; x.lineWidth = 4; x.beginPath(); x.moveTo(Math.cos(ha) * (R - 20), Math.sin(ha) * (R - 20)); x.lineTo(Math.cos(ha) * (R + 70), Math.sin(ha) * (R + 70)); x.stroke(); x.restore();
      D.text(x, 'IX', 960, 560 + 40, { size: 120, align: 'center', color: `rgba(242,234,216,${.25 * (1 - u)})` }); }
    // TEN: the big X with laurels
    if (ph === 'ten' && b < T0 + 4) { const ms = (t - winTime(10)) * 1000; const u = clamp(ms / 450), out = clamp((ms - 2600) / 500);
      if (out < 1) { x.save(); x.globalAlpha = 1 - out; const s = lerp(2.4, 1, ease.outExpo(u)); x.translate(960, 400); x.scale(s, s);
        D.laurel(x, 0, 0, 190, clamp(ms / 1400), { color: D.GOLD }); D.brushX(x, 0, -10, 110, 44, clamp(ms / 380), { color: D.GOLD });
        D.text(x, 'W I N   1 0  —  T E N', 0, 250, { size: 40, fam: 'JetBrains Mono', weight: 700, align: 'center', color: D.INK, alpha: clamp((ms - 300) / 400) }); x.restore(); } }
    // OUTRO title card
    if (b >= END) this.titleCard(t);
  }
  titleCard(t) {
    const E = this.app.eng, x = E.post.ctx, u = prog(t, 160.75, 161.5), fade = prog(t, 162.85, 163.45);
    if (u <= 0) return; this.app.hudAlpha = 0;
    x.save(); x.fillStyle = `rgba(242,233,214,${ease.inOutCubic(u) * .92})`; x.fillRect(0, 0, 1920, 1080);
    const a = ease.outCubic(prog(t, 161.0, 161.8));
    x.globalAlpha = a; D.text(x, 'TEN', 960, 610 + (1 - a) * 30, { size: 380, align: 'center', color: '#141022', track: 30 });
    x.fillStyle = '#d58a1e'; const rw = 520 * ease.inOutCubic(prog(t, 161.2, 162)); x.fillRect(960 - rw / 2, 740, rw, 4);
    D.text(x, 'ANNO DOMINI BEATS', 960, 700, { size: 34, fam: 'Inter Display', weight: 700, align: 'center', color: '#141022', track: 18, alpha: ease.outCubic(prog(t, 161.3, 162.0)) });
    const row = D.ROMAN.slice(1); const ra = prog(t, 161.5, 162.3);
    row.forEach((r, i) => D.text(x, r, 960 + (i - 4.5) * 120, 820, { size: 44, align: 'center', color: i === 9 ? '#d58a1e' : '#141022', alpha: clamp(ra * 10 - i) }));
    x.restore();
    if (fade > 0) { x.fillStyle = `rgba(0,0,0,${ease.inOutSine(fade)})`; x.fillRect(0, 0, 1920, 1080); }
  }
}
function subOnLike(b) { const l = ((b - 208) % 8 + 8) % 8; return !(l >= 4 && l < 6); }
