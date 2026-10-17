// World kit: procedural city, rooftop dressing, planar-reflection wet floor, lamps, shockwave rings, trails.
import * as THREE from 'three';
import { G, litMat, buildingMat, glowMat, lightCone } from './materials.js';
import { rng } from './util.js';

export const LAYER_REFLECT = 1;
export function reflectable(obj) { obj.traverse(o => o.layers.enable(LAYER_REFLECT)); return obj; }

export function makeCity(o = {}) {
  const R = rng(o.seed || 7), n = o.count || 500, mat = buildingMat(o.mat || {});
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, .5, 0);
  const d = new THREE.Object3D(); const items = []; let k = 0;
  const [x0, x1, z0, z1] = o.area || [-200, 200, -300, -20];
  const cx = o.center ? o.center[0] : 0, cz = o.center ? o.center[1] : 0;
  for (let i = 0; i < n * 4 && k < n; i++) {
    const x = x0 + R() * (x1 - x0), z = z0 + R() * (z1 - z0);
    if (o.avoid && o.avoid(x, z)) continue;
    const far = Math.min(1, Math.hypot(x, z) / 250);
    const w = 6 + R() * 14, dd = 6 + R() * 14, h = (o.minH || 10) + Math.pow(R(), 1.6) * ((o.maxH || 90) - (o.minH || 10)) * (.6 + far * .6);
    const hh = o.heightFn ? o.heightFn(x, z, h) : h;
    d.position.set(x, (o.baseY || 0), z); d.scale.set(w, hh, dd); d.rotation.y = (R() < .2 ? R() * .5 : 0); d.updateMatrix();
    items.push({ m: d.matrix.clone(), dist: Math.hypot(x - cx, z - cz) }); k++;
  }
  // near-first ordering (early-z), split into live near ring + far field (baked into a cubemap)
  items.sort((a, b) => a.dist - b.dist);
  const split = o.split ?? 1e9;
  const mk = (list) => { const m = new THREE.InstancedMesh(box, mat, Math.max(1, list.length)); list.forEach((it, i) => m.setMatrixAt(i, it.m)); m.count = list.length; m.frustumCulled = false; m.U = mat.U; return m; };
  const near = mk(items.filter(i => i.dist < split)), far = mk(items.filter(i => i.dist >= split));
  const g = new THREE.Group(); g.add(near, far); g.near = near; g.far = far; g.U = mat.U; return g;
}
// Render far scenery once into a cubemap from `pos`; afterwards the sky dome shows it and the far objects are hidden.
export function bakeFarField(renderer, scene, keep, sky, pos, size = 1024, o = {}) {
  const crt = new THREE.WebGLCubeRenderTarget(size, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cc = new THREE.CubeCamera(1, 3000, crt); cc.position.set(...pos);
  const hidden = []; scene.traverse(o => { if (o.isMesh || o.isPoints) { if (!keep.includes(o) && o !== sky && o.visible) { hidden.push(o); o.visible = false; } } });
  scene.add(cc); cc.update(renderer, scene); scene.remove(cc);
  hidden.forEach(o => o.visible = true);
  if (o.noApply) return crt;
  keep.forEach(o => o.visible = false);
  sky.material.U.uCube.value = crt.texture; sky.material.U.uCubeAmt.value = 1;
  return crt;
}

// Planar reflection helper (oblique-clipped virtual camera, like three's Reflector) + wet floor shader.
export class Mirror {
  constructor(renderer, size = [960, 540], planeY = 0) {
    this.r = renderer; this.planeY = planeY;
    this.rt = new THREE.WebGLRenderTarget(size[0], size[1], { type: THREE.HalfFloatType, samples: 0 });
    this.cam = new THREE.PerspectiveCamera(); this.texMat = new THREE.Matrix4();
  }
  render(scene, camera) {
    const vc = this.cam, y = this.planeY; camera.updateMatrixWorld();
    const cp = new THREE.Vector3().setFromMatrixPosition(camera.matrixWorld);
    const target = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).add(cp);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    vc.position.set(cp.x, 2 * y - cp.y, cp.z); vc.up.set(up.x, -up.y, up.z); vc.lookAt(target.x, 2 * y - target.y, target.z);
    vc.fov = camera.fov; vc.aspect = camera.aspect; vc.near = camera.near; vc.far = camera.far; vc.updateProjectionMatrix(); vc.updateMatrixWorld();
    vc.matrixWorldInverse.copy(vc.matrixWorld).invert();
    this.texMat.set(.5, 0, 0, .5, 0, .5, 0, .5, 0, 0, .5, .5, 0, 0, 0, 1).multiply(vc.projectionMatrix).multiply(vc.matrixWorldInverse);
    // oblique near plane = reflection plane
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y).applyMatrix4(vc.matrixWorldInverse);
    const cplane = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = vc.projectionMatrix, q = new THREE.Vector4();
    q.x = (Math.sign(cplane.x) + pm.elements[8]) / pm.elements[0]; q.y = (Math.sign(cplane.y) + pm.elements[9]) / pm.elements[5]; q.z = -1; q.w = (1 + pm.elements[10]) / pm.elements[14];
    cplane.multiplyScalar(2 / cplane.dot(q)); pm.elements[2] = cplane.x; pm.elements[6] = cplane.y; pm.elements[10] = cplane.z + 1; pm.elements[14] = cplane.w;
    vc.layers.set(LAYER_REFLECT);
    const prev = this.r.getRenderTarget(); this.r.setRenderTarget(this.rt); this.r.setClearColor(0, 1); this.r.clear(); this.r.render(scene, vc); this.r.setRenderTarget(prev);
  }
}
const FLOOR_VERT = `uniform mat4 uTexMat; varying vec4 vRefl; varying vec3 vWPos; varying vec2 vUv; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vWPos = wp.xyz; vRefl = uTexMat * wp; gl_Position = projectionMatrix * viewMatrix * wp; }`;
const FLOOR_FRAG = `
uniform float uTime; uniform vec3 uKeyDir, uKeyCol, uSkyCol, uGroundCol, uFogCol; uniform float uFogDensity, uFogBase, uFogFall;
uniform vec3 uPPos[3]; uniform vec3 uPCol[3]; uniform float uPRange[3];
uniform sampler2D uRefl, uPattern; uniform vec3 uBase, uLine; uniform float uReflAmt, uWet, uRipple, uRough, uGrid, uUsePattern, uPatternGain, uRingT; uniform vec3 uRingC, uRingCol;
varying vec4 vRefl; varying vec3 vWPos; varying vec2 vUv;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f); return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
void main(){
  vec2 p = vWPos.xz;
  float puddle = smoothstep(.45, .6, n2(p * .35) * .7 + n2(p * 1.3) * .3);
  float wet = mix(.35, 1., puddle) * uWet;
  // rain ripples: expanding rings in cells
  vec2 dist = vec2(0.);
  if (uRipple > 0.) { for (int k = 0; k < 2; k++) { vec2 q = p * (2.2 + float(k) * 1.3) + float(k) * 7.; vec2 c = floor(q); vec2 f = fract(q) - .5;
      float ph = fract(uTime * 1.3 + h(c + float(k))); vec2 o = vec2(h(c + 3.), h(c + 9.)) - .5; float d = length(f - o * .5);
      float ring = sin((d - ph * .5) * 60.) * smoothstep(.5 * ph + .05, .5 * ph, d) * (1. - ph); dist += normalize(f - o * .5 + 1e-4) * ring * .01 * uRipple; } }
  vec2 ruv = vRefl.xy / vRefl.w + dist;
  vec3 refl = vec3(0.); float rr = uRough * (1. - puddle * .8);
  refl += texture2D(uRefl, ruv).rgb * .4;
  refl += texture2D(uRefl, ruv + vec2(0., rr)).rgb * .2; refl += texture2D(uRefl, ruv - vec2(0., rr)).rgb * .2;
  refl += texture2D(uRefl, ruv + vec2(rr * .6, rr * 2.)).rgb * .1; refl += texture2D(uRefl, ruv - vec2(rr * .6, rr * 2.)).rgb * .1;
  vec3 V = normalize(cameraPosition - vWPos); float fres = .04 + .96 * pow(1. - max(V.y, 0.), 5.);
  vec3 base = uBase * (.75 + .5 * n2(p * 3.)) * (1. - puddle * .4);
  if (uUsePattern > 0.) { vec4 pt = texture2D(uPattern, vUv); base += pt.rgb * uPatternGain * pt.a; }
  if (uGrid > 0.) { vec2 g = abs(fract(p * .5) - .5); float ln = smoothstep(.49, .5, max(g.x, g.y)); base += uLine * ln * uGrid; }
  vec3 col = base * (mix(uGroundCol, uSkyCol, .9) + uKeyCol * max(uKeyDir.y, 0.) * .35);
  for (int i = 0; i < 3; i++) { vec3 L = uPPos[i] - vWPos; float d = length(L); float att = clamp(1. - d / uPRange[i], 0., 1.); att *= att; col += base * uPCol[i] * att * max(normalize(L).y, 0.) * 1.5;
    vec3 Hh = normalize(normalize(L) + V); col += uPCol[i] * att * pow(max(Hh.y, 0.), 60.) * wet * 1.5; }
  col += refl * uReflAmt * wet * mix(.35, 1., fres);
  if (uRingT >= 0.) { float d = length(p - uRingC.xz); float rad = uRingT * 14.; float ring = exp(-pow((d - rad) * 2.2, 2.)) * exp(-uRingT * 2.2); col += uRingCol * ring * 3.; }
  float dd = length(cameraPosition - vWPos); float f = 1. - exp(-pow(dd * uFogDensity, 2.)); col = mix(col, uFogCol, clamp(f, 0., 1.));
  gl_FragColor = vec4(col, 1.);
}`;
export function wetFloor(size, mirror, o = {}) {
  const u = { uTexMat: { value: mirror ? mirror.texMat : new THREE.Matrix4() }, uRefl: { value: mirror ? mirror.rt.texture : null }, uPattern: { value: o.pattern || null },
    uBase: { value: new THREE.Color(...(o.base || [.03, .032, .04])) }, uLine: { value: new THREE.Color(...(o.line || [.2, .3, .5])) },
    uReflAmt: { value: mirror ? (o.reflAmt ?? 1) : 0 }, uWet: { value: o.wet ?? 1 }, uRipple: { value: o.ripple ?? 0 }, uRough: { value: o.rough ?? .006 }, uGrid: { value: o.grid ?? 0 },
    uUsePattern: { value: o.pattern ? 1 : 0 }, uPatternGain: { value: o.patternGain ?? 1 }, uRingT: { value: -1 }, uRingC: { value: new THREE.Vector3() }, uRingCol: { value: new THREE.Color(1.5, 1, .4) } };
  const m = new THREE.ShaderMaterial({ uniforms: { ...G, ...u }, vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG });
  const mesh = new THREE.Mesh(o.geo || new THREE.PlaneGeometry(size[0], size[1]), m); mesh.rotation.x = -Math.PI / 2; mesh.U = u; return mesh;
}

export function rooftopDressing(o = {}) {
  const g = new THREE.Group(); const R = rng(o.seed || 3);
  const concrete = litMat({ color: [.07, .07, .08], spec: .05, shin: 8, rim: .04, wrap: .5 });
  const metal = litMat({ color: [.09, .1, .12], spec: .6, shin: 40, rim: .1, matcap: 'chrome_night', matcapAmt: .4 });
  const W = o.w || 24, D = o.d || 18;
  // parapet
  for (const [x, z, w, d] of [[0, -D / 2, W, .4], [-W / 2, 0, .4, D], [W / 2, 0, .4, D]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, .9, d), concrete); m.position.set(x, .45, z); g.add(m);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(w + .1, .08, d + .1), metal); cap.position.set(x, .92, z); g.add(cap);
  }
  // water tower
  const wt = new THREE.Group(); const wood = litMat({ color: [.12, .08, .06], spec: .1, rim: .3 });
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.8, 24), wood); tank.position.y = 4.6; wt.add(tank);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.75, .9, 24), metal); roof.position.y = 6.45; wt.add(roof);
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + .78; const leg = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 3.4, 6), metal); leg.position.set(Math.cos(a) * 1.2, 1.7, Math.sin(a) * 1.2); wt.add(leg); }
  for (let i = 0; i < 3; i++) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, .03, 4, 32), metal); ring.rotation.x = Math.PI / 2; ring.position.y = 3.6 + i * .95; wt.add(ring); }
  wt.position.set(-W / 2 + 3.5, 0, -D / 2 + 3); g.add(wt);
  // AC units & vents
  for (let i = 0; i < 5; i++) { const ac = new THREE.Mesh(new THREE.BoxGeometry(1.4, .9, 1), metal); ac.position.set(W / 2 - 2 - (i % 3) * 1.8, .45, -D / 2 + 1.5 + Math.floor(i / 3) * 1.6); g.add(ac);
    const fan = new THREE.Mesh(new THREE.CylinderGeometry(.35, .35, .05, 16), concrete); fan.position.set(ac.position.x, .92, ac.position.z); g.add(fan); }
  // antenna mast with beacon
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(.05, .08, 9, 6), metal); mast.position.set(W / 2 - 3, 4.5, -D / 2 + 5); g.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), litMat({ color: [0, 0, 0], emissive: [6, .4, .2], rim: 0 })); beacon.position.set(W / 2 - 3, 9.05, -D / 2 + 5); g.add(beacon); g.beacon = beacon;
  // pipes
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(.09, .09, W * .5, 8), metal); p.rotation.z = Math.PI / 2; p.position.set(-2 + i * .1, .25 + i * .22, -D / 2 + .6); g.add(p); }
  g.mats = { concrete, metal, wood }; return g;
}

export function workLamp(o = {}) {
  const g = new THREE.Group(); const metal = litMat({ color: [.05, .05, .06], spec: .8, shin: 50, rim: .4, matcap: 'chrome_night', matcapAmt: .3 });
  const h = o.h || 4.2;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, h, 8), metal); pole.position.y = h / 2; g.add(pole);
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 1.0, 6), metal); arm.rotation.z = Math.PI / 2; arm.position.set(.5, h, 0); g.add(arm);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(.12, .32, .22, 18, 1, true), metal); head.position.set(1, h - .05, 0); g.add(head);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 8), litMat({ color: [0, 0, 0], emissive: o.color || [8, 5.2, 2.4], rim: 0 })); bulb.position.set(1, h - .14, 0); g.add(bulb);
  const cone = lightCone(h - .1, 2.6, { color: o.coneColor || [1, .72, .4], intensity: o.coneInt ?? .35, falloff: 1.2, edge: 1.6, dust: .7 }); cone.position.set(1, h - .15, 0); g.add(cone);
  g.cone = cone; g.bulb = bulb; g.lightPos = new THREE.Vector3(1, h - .3, 0); return g;
}

// expanding gold shock ring (vertical or flat)
export function shockRing(o = {}) {
  const m = new THREE.Mesh(new THREE.RingGeometry(.96, 1, 96, 1), glowMat({ mode: 1, color: o.color || [1.4, .9, .35], intensity: 0, falloff: .5 }));
  m.material.U.uMode.value = 3; // use as flat (fragment computes beam mode -> fallback) — we drive alpha manually
  m.material = new THREE.MeshBasicMaterial({ color: new THREE.Color(...(o.color || [1.6, 1.0, .4])), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  m.renderOrder = 8; m.frustumCulled = false; return m;
}

// trail ribbon: updated each frame from an array of world points (newest first)
export class Trail {
  constructor(n, width, color) {
    this.n = n; this.w = width; const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 2 * 3); this.alpha = new Float32Array(n * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(this.alpha, 1));
    const idx = []; for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(...color) }, uInt: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uInt; varying float vA; void main(){ gl_FragColor = vec4(uCol * vA * uInt, 1.); }` });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
  }
  set(points, camPos) { // points: array of Vector3
    const n = Math.min(this.n, points.length);
    for (let i = 0; i < this.n; i++) {
      const p = points[Math.min(i, n - 1)], q = points[Math.min(i + 1, n - 1)] || p;
      const dir = new THREE.Vector3().subVectors(p, q); if (dir.lengthSq() < 1e-8) dir.set(1, 0, 0);
      const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3().subVectors(camPos, p)).normalize().multiplyScalar(this.w * (1 - i / this.n));
      this.pos.set([p.x + side.x, p.y + side.y, p.z + side.z, p.x - side.x, p.y - side.y, p.z - side.z], i * 6);
      const a = i < n ? Math.pow(1 - i / this.n, 1.5) : 0; this.alpha[i * 2] = this.alpha[i * 2 + 1] = a;
    }
    this.mesh.geometry.attributes.position.needsUpdate = true; this.mesh.geometry.attributes.aA.needsUpdate = true;
  }
}

// 3D digits from Blender (assets/models/digits.glb)
export const DIGITS = {};
export async function loadDigits() {
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const L = new GLTFLoader();
  const load = (u) => new Promise(ok => L.load(u, g => ok(g), undefined, () => ok(null)));
  const d = await load('/assets/models/digits.glb'); if (d) d.scene.traverse(o => { if (o.isMesh) DIGITS[o.name] = o.geometry; });
  const m = await load('/assets/models/ten_monument.glb'); if (m) m.scene.traverse(o => { if (o.isMesh) DIGITS[o.name] = { geo: o.geometry, pos: o.position.clone() }; });
  return DIGITS;
}
