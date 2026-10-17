// Procedural stylised humanoid ("designer-toy" proportions) with FK arms/spine and analytic 2-bone leg IK.
// Pose = plain object of Euler triplets (radians) + root/hip offsets + optional planted foot targets.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { litMat } from './materials.js';
import { lerp } from './util.js';

export const DIM = { hipY: .98, spine: .13, chest: .2, neck: .26, head: .11, clavX: .1, clavY: .22, shoulderX: .1, upper: .29, fore: .27,
  hipX: .1, hipDrop: .06, thigh: .44, shin: .43, ankleH: .095 };

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const tmpQ = new THREE.Quaternion(), tmpQ2 = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpM = new THREE.Matrix4();

function capsule(r, len, mat, seg = 10) { const g = new THREE.CapsuleGeometry(r, Math.max(.001, len), 4, seg); g.translate(0, -len / 2, 0); return new THREE.Mesh(g, mat); }
function rbox(w, h, d, r, mat) { return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); }
function taper(geo, fBottom, fTop, axis = 'x') { // scale x (and z a bit) by height to give V-shapes
  const p = geo.attributes.position; geo.computeBoundingBox(); const b = geo.boundingBox;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), u = (y - b.min.y) / (b.max.y - b.min.y); const f = lerp(fBottom, fTop, u);
    p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * lerp(1, f, .35)); }
  geo.computeVertexNormals(); return geo;
}

export function numberTexture(text, o = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256; const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  tex.draw = (txt, col = o.color || '#ffd27a') => {
    x.clearRect(0, 0, 256, 256); x.fillStyle = col; x.textAlign = 'center'; x.textBaseline = 'middle';
    const s = String(txt); x.font = `700 ${s.length > 1 ? 200 : 220}px "Big Shoulders"`; x.fillText(s, 128, 140); tex.needsUpdate = true;
  };
  tex.draw(text); return tex;
}

export class Character {
  constructor(o = {}) {
    this.o = o; const style = o.style || 'zero';
    const root = this.root = new THREE.Group(); root.name = 'char';
    const B = this.b = {};
    const mk = (name, parent, pos) => { const g = new THREE.Group(); g.name = name; g.position.copy(pos); parent.add(g); B[name] = g; return g; };
    const hips = mk('hips', root, V(0, DIM.hipY, 0));
    const spine = mk('spine', hips, V(0, DIM.spine * .3, 0));
    const chest = mk('chest', spine, V(0, DIM.spine, 0));
    const neck = mk('neck', chest, V(0, DIM.neck, -.01));
    const head = mk('head', neck, V(0, DIM.head * .5, .01));
    for (const s of ['L', 'R']) {
      const sx = s === 'L' ? 1 : -1;
      const clav = mk('clav' + s, chest, V(sx * DIM.clavX, DIM.clavY, -.01));
      const sh = mk('shoulder' + s, clav, V(sx * DIM.shoulderX, 0, 0));
      const el = mk('elbow' + s, sh, V(0, -DIM.upper, 0));
      mk('wrist' + s, el, V(0, -DIM.fore, 0));
      const hp = mk('hip' + s, hips, V(sx * DIM.hipX, -DIM.hipDrop, 0));
      const kn = mk('knee' + s, hp, V(0, -DIM.thigh, 0));
      mk('ankle' + s, kn, V(0, -DIM.shin, 0));
    }
    // ---------- materials ----------
    const echo = style === 'echo';
    const tint = o.tint || [.35, .7, 1.0];
    const M = this.m = {};
    if (!echo) {
      M.cloth = litMat({ color: [.055, .058, .068], spec: .08, shin: 12, rim: .55, rimPow: 2.6, matcap: 'clay_dark', matcapAmt: .35, wrap: .5 });
      M.cloth2 = litMat({ color: [.09, .09, .1], spec: .1, shin: 14, rim: .5, rimPow: 2.6, matcap: 'clay_dark', matcapAmt: .4, wrap: .5 });
      M.mask = litMat({ color: [.01, .01, .012], spec: 1.4, shin: 90, rim: .8, rimPow: 3, matcap: 'obsidian', matcapAmt: 1.0 });
      M.white = litMat({ color: [.75, .73, .7], spec: .2, shin: 20, rim: .35, matcap: 'pearl_dawn', matcapAmt: .25, wrap: .4 });
      M.accent = litMat({ color: [.3, .2, .05], emissive: [1.6, .95, .35], emissiveAmt: 1, rim: 0 });
      M.visor = litMat({ color: [0, 0, 0], emissive: [2.4, 1.5, .6], emissiveAmt: 1, rim: 0 });
    } else if (style === 'line') {
      const lm = litMat({ color: [0, 0, 0], emissive: [.035, .09, .22], spec: 0, rim: 3.2, rimPow: 3.2, rimTint: [1, 1, 1], lightMul: 0, dissolve: 1, dissolveScale: 7, edgeCol: [1, 1, 1] });
      lm.U.uRimCol = { value: new THREE.Color(.85, .95, 1.2) }; lm.uniforms.uRimCol = lm.U.uRimCol;
      M.cloth = M.cloth2 = M.mask = M.white = lm;
      M.accent = litMat({ color: [0, 0, 0], emissive: [1.2, 1.4, 1.8], rim: 0, dissolve: 1, dissolveScale: 7 }); M.visor = M.accent;
    } else {
      const ec = litMat({ color: [tint[0] * .05, tint[1] * .05, tint[2] * .05], spec: 1.2, shin: 60, rim: 2.4, rimPow: 2.2, rimTint: [tint[0] * 1.6, tint[1] * 1.6, tint[2] * 1.6],
        matcap: 'glass_echo', matcapAmt: .55, matcapTint: 0, scan: .6, edgeCol: tint.map(v => v * 1.5), dissolve: 1, dissolveScale: 7 });
      ec.U.uRimCol = { value: new THREE.Color(1, 1, 1) }; ec.uniforms.uRimCol = ec.U.uRimCol;
      M.cloth = M.cloth2 = M.mask = M.white = ec;
      M.accent = litMat({ color: [0, 0, 0], emissive: tint.map(v => v * 2.2), emissiveAmt: 1, rim: 0, dissolve: 1, dissolveScale: 7, edgeCol: tint });
      M.visor = M.accent;
    }
    this.mats = Object.values(M);
    // ---------- body meshes ----------
    const add = (bone, mesh, pos, rot) => { if (pos) mesh.position.copy(pos); if (rot) mesh.rotation.set(...rot); B[bone].add(mesh); mesh.castShadow = false; return mesh; };
    // pelvis (joggers) + long hoodie body that covers the hips
    add('hips', rbox(.31, .19, .2, .07, M.cloth2), V(0, -.03, 0));
    const hem = new THREE.Mesh(taper(new RoundedBoxGeometry(.35, .2, .225, 4, .08), 1.02, .95), M.cloth); add('hips', hem, V(0, .05, 0)); this.hem = hem;
    add('spine', new THREE.Mesh(taper(new RoundedBoxGeometry(.34, .2, .21, 4, .085), .97, 1.0), M.cloth), V(0, .05, 0));
    const chestGeo = taper(new RoundedBoxGeometry(.38, .33, .23, 5, .1), .9, 1.16); const chestMesh = new THREE.Mesh(chestGeo, M.cloth);
    add('chest', chestMesh, V(0, .11, 0));
    // kangaroo pocket & drawstrings
    add('spine', rbox(.23, .085, .03, .014, M.cloth2), V(0, .02, .1));
    add('chest', capsule(.006, .1, M.white, 6), V(.04, .25, .118)); add('chest', capsule(.006, .11, M.white, 6), V(-.04, .25, .118));
    for (const s of ['L', 'R']) add('shoulder' + s, new THREE.Mesh(new THREE.SphereGeometry(.075, 16, 12), M.cloth), V(0, -.015, 0));
    // neck + hood: open-front shell, thick rim framing a glossy black face mask with a gold visor slit
    add('neck', capsule(.05, .07, M.cloth, 8), V(0, .07, 0));
    const hood = new THREE.Mesh(new THREE.SphereGeometry(.158, 28, 20, Math.PI / 2 + Math.PI / 3.4, Math.PI * 2 - Math.PI * 2 / 3.4, 0, Math.PI * .78), M.cloth);
    hood.scale.set(1, 1.1, 1.12); add('head', hood, V(0, .05, -.02), [-.12, 0, 0]);
    const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(.112, .026, 10, 32), M.cloth); hoodRim.scale.set(.92, 1.25, 1); add('head', hoodRim, V(0, .035, .095), [-.22, 0, 0]);
    const face = new THREE.Mesh(new THREE.SphereGeometry(.108, 24, 18), M.mask); face.scale.set(.9, 1.12, 1.0); add('head', face, V(0, .035, .035));
    const visor = new THREE.Mesh(new THREE.TorusGeometry(.098, .007, 6, 40, Math.PI * .5), M.visor); visor.rotation.set(Math.PI / 2 + .08, 0, Math.PI * .25);
    visor.position.set(0, .06, .045); B.head.add(visor); this.visor = visor;
    // arms
    for (const s of ['L', 'R']) {
      add('shoulder' + s, capsule(.062, DIM.upper - .04, M.cloth), V(0, -.02, 0));
      add('elbow' + s, new THREE.Mesh(new THREE.SphereGeometry(.055, 12, 10), M.cloth), V(0, 0, 0));
      add('elbow' + s, capsule(.054, DIM.fore - .07, M.cloth), V(0, -.01, 0));
      // sleeve cuff stripe
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(.05, .009, 6, 18), M.accent); cuff.rotation.x = Math.PI / 2; add('elbow' + s, cuff, V(0, -DIM.fore + .07, 0));
      // wrapped hand (fist)
      const hand = rbox(.075, .1, .085, .03, M.white); add('wrist' + s, hand, V(0, -.045, .005)); this['hand' + s] = hand;
      const thumb = capsule(.017, .03, M.white, 6); add('wrist' + s, thumb, V((s === 'L' ? -1 : 1) * -.0, -.03, .045), [1.2, 0, 0]);
      // legs: joggers + sneakers
      add('hip' + s, new THREE.Mesh(taper(new THREE.CapsuleGeometry(.092, DIM.thigh - .08, 4, 12).translate(0, -(DIM.thigh - .08) / 2, 0), .8, 1.05), M.cloth2), V(0, -.01, 0));
      add('knee' + s, new THREE.Mesh(new THREE.SphereGeometry(.073, 14, 10), M.cloth2), V(0, 0, 0));
      add('knee' + s, new THREE.Mesh(taper(new THREE.CapsuleGeometry(.072, DIM.shin - .1, 4, 12).translate(0, -(DIM.shin - .1) / 2, 0), .72, 1.0), M.cloth2), V(0, -.02, 0));
      const cuffL = new THREE.Mesh(new THREE.TorusGeometry(.052, .014, 6, 16), M.cloth); cuffL.rotation.x = Math.PI / 2; add('knee' + s, cuffL, V(0, -DIM.shin + .075, 0));
      const shoe = rbox(.11, .1, .27, .04, M.white); add('ankle' + s, shoe, V(0, -.035, .055));
      const sole = rbox(.115, .03, .28, .012, M.accent); add('ankle' + s, sole, V(0, -.08, .055)); this['sole' + s] = sole;
    }
    // jersey numbers (back big, chest small)
    this.numTex = numberTexture(o.number ?? 0, { color: echo ? '#ffffff' : '#ffd27a' });
    const numMat = litMat({ color: [0, 0, 0], emissive: style === 'line' ? [1.4, 1.6, 2] : echo ? tint.map(v => v * 2.5) : [2.2, 1.45, .55], emissiveAmt: 1, map: this.numTex, mapEmissive: true, transparent: true, rim: 0, depthWrite: false });
    numMat.U.uDissolve = (echo || style === 'line') ? M.accent.U.uDissolve : numMat.U.uDissolve; numMat.uniforms.uDissolve = numMat.U.uDissolve;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(.27, .27), numMat); back.rotation.y = Math.PI; add('chest', back, V(0, .13, -.123)); back.renderOrder = 3;
    const front = new THREE.Mesh(new THREE.PlaneGeometry(.09, .09), numMat); add('chest', front, V(-.09, .2, .122)); front.renderOrder = 3;
    this.numMat = numMat; this.mats.push(numMat);
    // contact shadow blob
    const sc = document.createElement('canvas'); sc.width = sc.height = 64; const sx = sc.getContext('2d'); const gr = sx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = gr; sx.fillRect(0, 0, 64, 64);
    const st = new THREE.CanvasTexture(sc);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: st, transparent: true, depthWrite: false, opacity: echo ? .35 : .8 }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.position.y = .005; this.shadow.renderOrder = 1; root.add(this.shadow);
    this.number = o.number ?? 0;
    root.traverse(m => { if (m.isMesh) m.frustumCulled = false; });
  }
  setNumber(n) { if (n !== this.number) { this.number = n; this.numTex.draw(n); } }
  setDissolve(v) { for (const m of this.mats) if (m.U && m.U.uDissolve) m.U.uDissolve.value = v; }
  setGlow(g) { if (this.m.accent.U) this.m.accent.U.uEmissiveAmt.value = g; if (this.m.visor !== this.m.accent) this.m.visor.U.uEmissiveAmt.value = g; this.numMat.U.uEmissiveAmt.value = g; }
  // world position of a bone (after applyPose + updateMatrixWorld)
  worldPos(bone, out = new THREE.Vector3()) { return this.b[bone].getWorldPosition(out); }

  applyPose(P) {
    const B = this.b;
    const e = (bone, r, mirror, order = 'YXZ') => { if (!r) { B[bone].rotation.set(0, 0, 0); return; } B[bone].rotation.set(r[0], mirror ? -r[1] : r[1], mirror ? -r[2] : r[2], order); };
    // root
    this.root.position.set(P.x || 0, P.y || 0, P.z || 0); this.root.rotation.set(0, P.ry || 0, 0);
    B.hips.position.set(P.hx || 0, DIM.hipY + (P.hy || 0), P.hz || 0);
    e('hips', P.hips); e('spine', P.spine); e('chest', P.chest); e('neck', P.neck); e('head', P.head);
    for (const s of ['L', 'R']) {
      const mir = s === 'R';
      e('clav' + s, P['clav' + s], mir);
      e('shoulder' + s, P['sh' + s], mir, 'ZXY');
      B['elbow' + s].rotation.set(P['el' + s] || 0, 0, 0);
      e('wrist' + s, P['wr' + s], mir);
    }
    // legs
    this.root.updateMatrixWorld(true);
    for (const s of ['L', 'R']) {
      const ft = P['foot' + s];
      if (ft) this._ikLeg(s, ft, P['fr' + s] || 0, P['fp' + s] || 0, P['kneeOut' + s] ?? .08);
      else { const mir = s === 'R'; e('hip' + s, P['hip' + s], mir, 'ZXY'); B['knee' + s].rotation.set(P['kn' + s] || 0, 0, 0); e('ankle' + s, P['an' + s], mir); }
    }
    // shadow follows hips
    this.shadow.position.set(B.hips.position.x, .005, B.hips.position.z);
    const lift = Math.max(0, (P.y || 0)); this.shadow.material.opacity = (this.o.style === 'echo' ? .35 : .8) * Math.max(0, 1 - lift * 1.5);
    const sc = 1 + lift * .5; this.shadow.scale.set(sc, sc, sc);
    this.root.updateMatrixWorld(true);
  }
  // target ankle position in ROOT space [x,y,z]; foot yaw (fr) & pitch (fp) relative to root.
  _ikLeg(s, target, yaw, pitch, kneeOut) {
    const B = this.b, hipsB = B.hips, hip = B['hip' + s], knee = B['knee' + s], ankle = B['ankle' + s];
    const sx = s === 'L' ? 1 : -1;
    // target -> hips local
    const T = new THREE.Vector3(target[0], target[1] + DIM.ankleH + DIM.ankleH * 0, target[2]);
    hipsB.updateMatrix(); tmpM.copy(hipsB.matrix).invert(); T.applyMatrix4(tmpM);
    const d = T.sub(hip.position); const a = DIM.thigh, b = DIM.shin;
    let dist = d.length(); dist = Math.min(Math.max(dist, .12), a + b - 1e-3);
    const dn = d.clone().normalize();
    const alpha = Math.acos(Math.min(1, Math.max(-1, (a * a + dist * dist - b * b) / (2 * a * dist))));
    const gamma = Math.acos(Math.min(1, Math.max(-1, (a * a + b * b - dist * dist) / (2 * a * b))));
    // knee hint: forward (in hips space, rotated by foot yaw) plus outward splay
    const hint = new THREE.Vector3(Math.sin(yaw) + sx * kneeOut, 0, Math.cos(yaw)).normalize();
    const hintRoot = hint.clone(); // hint is in root space; bring to hips space (rotation only)
    tmpQ.copy(hipsB.quaternion).invert(); hintRoot.applyQuaternion(tmpQ);
    let axis = new THREE.Vector3().crossVectors(dn, hintRoot); if (axis.lengthSq() < 1e-8) axis.set(1, 0, 0); axis.normalize();
    const thighDir = dn.clone().applyAxisAngle(axis, alpha);
    // basis: local -y along thighDir, local z toward hint (orthogonalised)
    const yAx = thighDir.clone().negate();
    const zAx = hintRoot.clone().sub(yAx.clone().multiplyScalar(hintRoot.dot(yAx))).normalize();
    const xAx = new THREE.Vector3().crossVectors(yAx, zAx).normalize();
    tmpM.makeBasis(xAx, yAx, zAx); hip.quaternion.setFromRotationMatrix(tmpM);
    knee.quaternion.setFromAxisAngle(V(1, 0, 0), Math.PI - gamma);
    // ankle: world-flat foot with given yaw/pitch relative to root
    const want = tmpQ2.setFromEuler(tmpE.set(pitch, yaw, 0, 'YXZ'));
    const chain = hipsB.quaternion.clone().multiply(hip.quaternion).multiply(knee.quaternion);
    ankle.quaternion.copy(chain.invert().multiply(want));
  }
}

// ---------- pose maths ----------
const ANG = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'clavR', 'shL', 'shR', 'wrL', 'wrR', 'hipL', 'hipR', 'anL', 'anR'];
const SCAL = ['x', 'y', 'z', 'ry', 'hx', 'hy', 'hz', 'elL', 'elR', 'knL', 'knR', 'frL', 'frR', 'fpL', 'fpR'];
const VEC = ['footL', 'footR'];
export const NEUTRAL = { hips: [0, 0, 0], spine: [0, 0, 0], chest: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0], clavL: [0, 0, 0], clavR: [0, 0, 0],
  shL: [0, 0, .12], shR: [0, 0, .12], elL: -.25, elR: -.25, wrL: [0, 0, 0], wrR: [0, 0, 0], footL: [.11, 0, .02], footR: [-.11, 0, .02], hy: -.02 };
export function blendPose(A, Bp, u) {
  if (u <= 0) return A; if (u >= 1) return Bp; const o = {};
  for (const k of ANG) { const a = A[k] || [0, 0, 0], b = Bp[k] || [0, 0, 0]; if (A[k] || Bp[k]) o[k] = [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; }
  for (const k of SCAL) { if (A[k] !== undefined || Bp[k] !== undefined) o[k] = lerp(A[k] || 0, Bp[k] || 0, u); }
  for (const k of VEC) { const a = A[k], b = Bp[k]; if (a && b) o[k] = [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)]; else if (a || b) o[k] = u < .5 ? a : b; }
  for (const k of ['kneeOutL', 'kneeOutR']) if (A[k] !== undefined || Bp[k] !== undefined) o[k] = lerp(A[k] ?? .08, Bp[k] ?? .08, u);
  return o;
}
export function addPose(A, D, w = 1) { // additive layer
  const o = { ...A };
  for (const k of ANG) if (D[k]) { const a = A[k] || [0, 0, 0]; o[k] = [a[0] + D[k][0] * w, a[1] + D[k][1] * w, a[2] + D[k][2] * w]; }
  for (const k of SCAL) if (D[k] !== undefined) o[k] = (A[k] || 0) + D[k] * w;
  for (const k of VEC) if (D[k] && A[k]) o[k] = [A[k][0] + D[k][0] * w, A[k][1] + D[k][1] * w, A[k][2] + D[k][2] * w];
  return o;
}
export function mirrorPose(P) { // swap left/right
  const o = { ...P };
  const sw = (a, b) => { o[a] = P[b]; o[b] = P[a]; };
  sw('clavL', 'clavR'); sw('shL', 'shR'); sw('elL', 'elR'); sw('wrL', 'wrR'); sw('hipL', 'hipR'); sw('knL', 'knR'); sw('anL', 'anR'); sw('frL', 'frR'); sw('fpL', 'fpR'); sw('kneeOutL', 'kneeOutR');
  if (P.footL) o.footR = [-P.footL[0], P.footL[1], P.footL[2]]; if (P.footR) o.footL = [-P.footR[0], P.footR[1], P.footR[2]];
  for (const k of ['hips', 'spine', 'chest', 'neck', 'head']) if (P[k]) o[k] = [P[k][0], -P[k][1], -P[k][2]];
  if (P.hx) o.hx = -P.hx; if (P.frL !== undefined || P.frR !== undefined) { o.frL = -(P.frR || 0); o.frR = -(P.frL || 0); }
  return o;
}
