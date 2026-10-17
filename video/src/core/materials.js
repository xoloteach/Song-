// Lightweight cinematic shaders (SwiftShader-friendly): hemisphere + key + 3 point lights, Blinn spec,
// fresnel rim, Blender-baked matcap reflections, emissive, dissolve, height fog. Shared global light rig.
import * as THREE from 'three';

export const G = {
  uTime: { value: 0 },
  uKeyDir: { value: new THREE.Vector3(.4, .8, .3).normalize() }, uKeyCol: { value: new THREE.Color(1, .9, .8) },
  uSkyCol: { value: new THREE.Color(.08, .1, .16) }, uGroundCol: { value: new THREE.Color(.02, .02, .03) },
  uRimCol: { value: new THREE.Color(.3, .5, 1) },
  uFogCol: { value: new THREE.Color(.02, .03, .06) }, uFogDensity: { value: .02 }, uFogBase: { value: 0 }, uFogFall: { value: 0 },
  uPPos: { value: [new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0), new THREE.Vector3(0, -999, 0)] },
  uPCol: { value: [new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0)] },
  uPRange: { value: [1, 1, 1] },
};
export function resetLights() {
  for (let i = 0; i < 3; i++) { G.uPPos.value[i].set(0, -999, 0); G.uPCol.value[i].setRGB(0, 0, 0); G.uPRange.value[i] = 1; }
}
export function setLight(i, pos, col, range) { G.uPPos.value[i].set(...pos); G.uPCol.value[i].setRGB(...col); G.uPRange.value[i] = range; }

const COMMON = `
uniform float uTime; uniform vec3 uKeyDir, uKeyCol, uSkyCol, uGroundCol, uRimCol, uFogCol; uniform float uFogDensity, uFogBase, uFogFall;
uniform vec3 uPPos[3]; uniform vec3 uPCol[3]; uniform float uPRange[3];
float fogAmount(vec3 wp){ float d = length(cameraPosition - wp); float f = 1. - exp(-pow(d * uFogDensity, 2.));
  if (uFogFall > 0.) f *= exp(-max(wp.y - uFogBase, 0.) * uFogFall); return clamp(f, 0., 1.); }
float h13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(mix(mix(h13(i), h13(i+vec3(1,0,0)), f.x), mix(h13(i+vec3(0,1,0)), h13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h13(i+vec3(0,0,1)), h13(i+vec3(1,0,1)), f.x), mix(h13(i+vec3(0,1,1)), h13(i+vec3(1,1,1)), f.x), f.y), f.z); }
`;
const LIT_VERT = `
varying vec3 vWPos, vWNor, vVNor, vLPos; varying vec2 vUv; varying vec3 vInstCol;
void main(){
  vec4 p = vec4(position, 1.); vec3 n = normal;
  #ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
  #endif
  vLPos = position;
  vec4 wp = modelMatrix * p; vWPos = wp.xyz; vWNor = normalize(mat3(modelMatrix) * n); vVNor = normalize(mat3(viewMatrix) * vWNor);
  vUv = uv;
  #ifdef USE_INSTANCING_COLOR
  vInstCol = instanceColor;
  #else
  vInstCol = vec3(1.);
  #endif
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const LIT_FRAG = COMMON + `
uniform vec3 uColor, uEmissive, uRimTint, uEdgeCol; uniform float uSpec, uShin, uRimAmt, uRimPow, uMatcapAmt, uMatcapTint, uEmissiveAmt, uOpacity, uWrap,
  uDissolve, uDissolveScale, uFogMul, uUseMap, uLightMul, uScan, uUnlit;
uniform sampler2D uMatcap, uMap;
varying vec3 vWPos, vWNor, vVNor, vLPos; varying vec2 vUv; varying vec3 vInstCol;
void main(){
  vec3 N = normalize(vWNor); if (!gl_FrontFacing) N = -N;
  vec3 V = normalize(cameraPosition - vWPos);
  vec3 base = uColor * vInstCol; float a = uOpacity; vec3 emis = uEmissive * uEmissiveAmt;
  if (uUseMap > .5) { vec4 m = texture2D(uMap, vUv); base *= mix(vec3(1.), m.rgb, uUseMap > 1.5 ? 0. : 1.); if (uUseMap > 1.5) emis += m.rgb * uEmissiveAmt * 1.; a *= m.a; }
  float edgeGlow = 0.;
  if (uDissolve < 1.) { float nz = vnoise(vWPos * uDissolveScale) * .7 + vnoise(vWPos * uDissolveScale * 3.1) * .3;
    float th = uDissolve * 1.15 - .1; if (nz > th) discard; edgeGlow = smoothstep(.08, 0., th - nz); }
  vec3 amb = mix(uGroundCol, uSkyCol, N.y * .5 + .5);
  float ndl = dot(N, uKeyDir); float wrap = max((ndl + uWrap) / (1. + uWrap), 0.);
  vec3 diff = amb + uKeyCol * wrap;
  vec3 H = normalize(uKeyDir + V); vec3 spec = uKeyCol * pow(max(dot(N, H), 0.), uShin) * uSpec * step(0., ndl);
  for (int i = 0; i < 3; i++) { vec3 L = uPPos[i] - vWPos; float d = length(L); L /= max(d, 1e-4);
    float att = clamp(1. - d / uPRange[i], 0., 1.); att *= att;
    diff += uPCol[i] * att * max(dot(N, L) * .75 + .25, 0.);
    spec += uPCol[i] * att * pow(max(dot(N, normalize(L + V)), 0.), uShin) * uSpec; }
  float fres = pow(1. - max(dot(N, V), 0.), uRimPow);
  vec3 col = base * diff * uLightMul + spec + uRimCol * uRimTint * fres * uRimAmt;
  vec3 vn = normalize(vVNor); vec3 vv = normalize((viewMatrix * vec4(V, 0.)).xyz);
  vec3 rr = reflect(-vv, vn); float mm = 2. * sqrt(rr.x*rr.x + rr.y*rr.y + (rr.z+1.)*(rr.z+1.)); vec2 muv = rr.xy / mm + .5;
  col += texture2D(uMatcap, muv).rgb * uMatcapAmt * mix(vec3(1.), base, uMatcapTint);
  if (uScan > 0.) { float sc = smoothstep(.85, 1., sin(vWPos.y * 60. - uTime * 6.) ); emis += uEdgeCol * sc * uScan * fres; }
  col = mix(col, base, uUnlit);
  col += emis + uEdgeCol * edgeGlow * 6.;
  col = mix(col, uFogCol, fogAmount(vWPos) * uFogMul);
  gl_FragColor = vec4(col, a);
}`;

let defaultMatcap = null;
function grayMatcap() {
  if (defaultMatcap) return defaultMatcap;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(22, 18, 2, 32, 32, 34); g.addColorStop(0, '#fff'); g.addColorStop(.5, '#666'); g.addColorStop(1, '#111');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); defaultMatcap = new THREE.CanvasTexture(c); defaultMatcap.colorSpace = THREE.SRGBColorSpace; return defaultMatcap;
}
export const MATCAPS = {};
export async function loadMatcaps(names) {
  const L = new THREE.TextureLoader();
  await Promise.all(names.map(n => new Promise(ok => L.load(`../assets/matcaps/${n}.png`, t => { t.colorSpace = THREE.SRGBColorSpace; MATCAPS[n] = t; ok(); }, undefined, () => { console.warn('matcap missing', n); MATCAPS[n] = grayMatcap(); ok(); }))));
}

export function litMat(o = {}) {
  const u = {
    uColor: { value: new THREE.Color(...(o.color || [.5, .5, .5])) }, uEmissive: { value: new THREE.Color(...(o.emissive || [0, 0, 0])) },
    uRimTint: { value: new THREE.Color(...(o.rimTint || [1, 1, 1])) }, uEdgeCol: { value: new THREE.Color(...(o.edgeCol || [1, .7, .3])) },
    uSpec: { value: o.spec ?? .3 }, uShin: { value: o.shin ?? 32 }, uRimAmt: { value: o.rim ?? .5 }, uRimPow: { value: o.rimPow ?? 3 },
    uMatcapAmt: { value: o.matcapAmt ?? 0 }, uMatcapTint: { value: o.matcapTint ?? 0 }, uEmissiveAmt: { value: o.emissiveAmt ?? 1 },
    uOpacity: { value: o.opacity ?? 1 }, uWrap: { value: o.wrap ?? .3 }, uDissolve: { value: o.dissolve ?? 1 }, uDissolveScale: { value: o.dissolveScale ?? 6 },
    uFogMul: { value: o.fogMul ?? 1 }, uUseMap: { value: o.map ? (o.mapEmissive ? 2 : 1) : 0 }, uLightMul: { value: o.lightMul ?? 1 }, uScan: { value: o.scan ?? 0 }, uUnlit: { value: o.unlit ?? 0 },
    uMatcap: { value: o.matcap ? (MATCAPS[o.matcap] || grayMatcap()) : grayMatcap() }, uMap: { value: o.map || null },
  };
  const m = new THREE.ShaderMaterial({ uniforms: { ...G, ...u }, vertexShader: LIT_VERT, fragmentShader: LIT_FRAG,
    transparent: !!o.transparent, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending });
  m.U = u; return m;
}

// --- procedural skyscraper facade (instanced unit boxes, origin at bottom) ---
const BLD_VERT = `
varying vec3 vWPos, vWNor, vLoc; varying float vId; varying vec3 vScale;
void main(){
  vec4 p = vec4(position, 1.); vec3 n = normal;
  #ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
  vScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vId = float(gl_InstanceID);
  #else
  vScale = vec3(1.); vId = 0.;
  #endif
  vLoc = position * vScale; vec4 wp = modelMatrix * p; vWPos = wp.xyz; vWNor = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const BLD_FRAG = COMMON + `
uniform vec3 uBase, uWarm, uCool, uAccent; uniform float uLit, uWinGain, uAccentAmt, uFloorH, uColW, uSeed, uRise, uRimAmt2;
varying vec3 vWPos, vWNor, vLoc; varying float vId; varying vec3 vScale;
float hh(float a, float b){ return h13(vec3(a, b, uSeed + vId * .137)); }
void main(){
  vec3 N = normalize(vWNor); vec3 V = normalize(cameraPosition - vWPos);
  float rnd = h13(vec3(vId, uSeed, 3.1));
  vec3 base = uBase * (.7 + .6 * rnd);
  vec3 amb = mix(uGroundCol, uSkyCol, N.y * .5 + .5);
  vec3 col = base * (amb + uKeyCol * max(dot(N, uKeyDir), 0.) * .6);
  if (abs(N.y) < .5) {
    float u = abs(N.x) > .5 ? vLoc.z : vLoc.x; float v = vLoc.y;
    float cw = uColW * (.8 + .5 * h13(vec3(vId, 1., uSeed))), fh = uFloorH;
    vec2 cell = vec2(floor(u / cw), floor(v / fh)); vec2 f = vec2(fract(u / cw), fract(v / fh));
    float win = step(.18, f.x) * step(f.x, .82) * step(.22, f.y) * step(f.y, .78);
    float on = step(1. - uLit * (.4 + .9 * rnd), hh(cell.x + N.x * 7., cell.y + N.z * 13.));
    float flick = .75 + .25 * sin(uTime * (1. + hh(cell.y, cell.x) * 3.) + hh(cell.x, cell.y) * 40.);
    vec3 wc = mix(uWarm, uCool, step(.62, hh(cell.y * 1.7, cell.x * .3)));
    float rise = step(v, uRise * vScale.y);
    col += wc * win * on * flick * uWinGain * rise * (.5 + hh(cell.x, cell.y * 2.));
    col += base * win * .25;
    // vertical mullion highlight & crown accent strip
    col += uAccent * uAccentAmt * smoothstep(vScale.y - 1.2, vScale.y - .9, v) * step(v, vScale.y - .5) * step(.7, rnd);
  } else { col *= .6; }
  float fres = pow(1. - max(dot(N, V), 0.), 4.); col += uRimCol * fres * uRimAmt2;
  col = mix(col, uFogCol, fogAmount(vWPos));
  gl_FragColor = vec4(col, 1.);
}`;
export function buildingMat(o = {}) {
  const u = {
    uBase: { value: new THREE.Color(...(o.base || [.025, .03, .045])) }, uWarm: { value: new THREE.Color(...(o.warm || [1.6, 1.0, .5])) },
    uCool: { value: new THREE.Color(...(o.cool || [.5, .8, 1.5])) }, uAccent: { value: new THREE.Color(...(o.accent || [1, .3, .2])) },
    uLit: { value: o.lit ?? .35 }, uWinGain: { value: o.winGain ?? 1.2 }, uAccentAmt: { value: o.accentAmt ?? 2 }, uFloorH: { value: o.floorH ?? 1.1 },
    uColW: { value: o.colW ?? 1.3 }, uSeed: { value: o.seed ?? 1 }, uRise: { value: 1 }, uRimAmt2: { value: o.rim ?? .15 },
  };
  const m = new THREE.ShaderMaterial({ uniforms: { ...G, ...u }, vertexShader: BLD_VERT, fragmentShader: BLD_FRAG }); m.U = u; return m;
}

// --- sky dome ---
const SKY_VERT = `varying vec3 vDir; void main(){ vDir = normalize((modelMatrix * vec4(position, 0.)).xyz); vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + vDir * 900., 1.); gl_Position = p.xyww; }`;
const SKY_FRAG = `uniform vec3 uZenith, uHorizon, uBelow, uSunDir, uSunCol, uGlowCol; uniform float uStars, uSunSize, uGlow, uTexAmt, uTexExp, uTime, uHaze, uTexYaw, uCubeAmt, uCubeMix; uniform sampler2D uTex; uniform samplerCube uCube, uCube2;
varying vec3 vDir;
float h(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
void main(){
  vec3 d = normalize(vDir); float y = d.y;
  vec3 col = mix(uHorizon, uZenith, pow(clamp(y, 0., 1.), .55));
  col = mix(col, uBelow, smoothstep(0., -.25, y));
  col += uHorizon * uHaze * exp(-abs(y) * 9.);
  float sd = max(dot(d, uSunDir), 0.);
  col += uGlowCol * pow(sd, 6.) * uGlow + uGlowCol * pow(sd, 60.) * uGlow * 2.;
  col += uSunCol * smoothstep(1. - uSunSize, 1. - uSunSize * .6, sd);
  if (uStars > 0.) { vec3 q = d * 260.; vec3 c = floor(q); float s = h(c); vec3 f = fract(q) - .5;
    float star = step(.985, s) * smoothstep(.25, 0., length(f)) * (.5 + .5 * sin(uTime * 2. + s * 90.));
    col += vec3(.8, .85, 1.) * star * uStars * smoothstep(.0, .3, y); }
  if (uTexAmt > 0.) { float lon = atan(d.x, -d.z) + uTexYaw; float lat = asin(clamp(d.y, -1., 1.));
    vec2 uv = vec2(fract(lon / 6.2831853 + .5), lat / 3.14159265 + .5);
    vec3 tc = texture2D(uTex, uv).rgb * uTexExp; col = mix(col, tc, uTexAmt * smoothstep(-.08, .02, y)); }
  if (uCubeAmt > 0.) { vec3 cd = vec3(-d.x, d.y, d.z); col = textureCube(uCube, cd).rgb; if (uCubeMix > 0.) col = mix(col, textureCube(uCube2, cd).rgb, uCubeMix); }
  gl_FragColor = vec4(col, 1.);
}`;
export function skyMat(o = {}) {
  const u = {
    uZenith: { value: new THREE.Color(...(o.zenith || [.005, .008, .02])) }, uHorizon: { value: new THREE.Color(...(o.horizon || [.05, .04, .08])) },
    uBelow: { value: new THREE.Color(...(o.below || [.01, .01, .015])) }, uSunDir: { value: new THREE.Vector3(...(o.sunDir || [0, .1, -1])).normalize() },
    uSunCol: { value: new THREE.Color(...(o.sunCol || [0, 0, 0])) }, uGlowCol: { value: new THREE.Color(...(o.glowCol || [.2, .1, .05])) },
    uStars: { value: o.stars ?? 0 }, uSunSize: { value: o.sunSize ?? .0015 }, uGlow: { value: o.glow ?? 0 }, uTexAmt: { value: 0 }, uTexExp: { value: 1 }, uTexYaw: { value: 0 },
    uTex: { value: null }, uTime: G.uTime, uHaze: { value: o.haze ?? .5 }, uCube: { value: null }, uCube2: { value: null }, uCubeMix: { value: 0 }, uCubeAmt: { value: 0 },
  };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false });
  m.U = u; return m;
}
export function skyDome(o) { const m = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 24), skyMat(o)); m.frustumCulled = false; m.renderOrder = -10; return m; }

// --- additive volumetric glow (cones, beams, halos) ---
const GLOW_VERT = `varying vec2 vUv; varying vec3 vWPos, vWNor; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vWPos = wp.xyz; vWNor = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * wp; }`;
const GLOW_FRAG = COMMON + `uniform vec3 uCol; uniform float uInt, uFalloff, uEdge, uDust, uMode; varying vec2 vUv; varying vec3 vWPos, vWNor;
void main(){
  vec3 V = normalize(cameraPosition - vWPos); float facing = abs(dot(normalize(vWNor), V));
  float a;
  if (uMode < .5) { a = pow(clamp(vUv.y, 0., 1.), uFalloff) * pow(facing, uEdge); }              // cone (uv.y = 1 at apex)
  else if (uMode < 1.5) { vec2 c = vUv - .5; a = pow(clamp(1. - length(c) * 2., 0., 1.), uFalloff); } // disc halo
  else { a = pow(clamp(1. - abs(vUv.x - .5) * 2., 0., 1.), uEdge) * pow(clamp(vUv.y, 0., 1.), uFalloff); } // beam ribbon
  float dn = mix(1., vnoise(vWPos * 2.5 + vec3(0., -uTime * .6, uTime * .2)) * 1.4, uDust);
  vec3 col = uCol * a * uInt * dn; col *= 1. - fogAmount(vWPos) * .6;
  gl_FragColor = vec4(col, 1.);
}`;
export function glowMat(o = {}) {
  const u = { uCol: { value: new THREE.Color(...(o.color || [1, .8, .5])) }, uInt: { value: o.intensity ?? 1 }, uFalloff: { value: o.falloff ?? 1.5 },
    uEdge: { value: o.edge ?? 2 }, uDust: { value: o.dust ?? .5 }, uMode: { value: o.mode ?? 0 } };
  const m = new THREE.ShaderMaterial({ uniforms: { ...G, ...u }, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }); m.U = u; return m;
}
export function lightCone(len, radius, o = {}) {
  const g = new THREE.CylinderGeometry(radius * .04, radius, len, 40, 1, true); g.translate(0, -len / 2, 0); // apex at origin, pointing -y
  const m = new THREE.Mesh(g, glowMat({ mode: 0, ...o })); m.renderOrder = 5; return m;
}

// --- GPU particles (dust / embers / snow-like gold) : positions are a pure function of seed + time ---
const PT_VERT = `uniform float uTime, uSize, uSpeed; uniform vec3 uBox, uOrigin, uVel; attribute vec4 aSeed; varying float vA; varying float vS;
void main(){
  vec3 p = fract(aSeed.xyz + uVel * uTime * uSpeed / uBox + vec3(0.)) ;
  p += vec3(sin(uTime * .7 + aSeed.w * 30.), cos(uTime * .5 + aSeed.w * 17.), sin(uTime * .6 + aSeed.w * 7.)) * .01;
  vec3 wp = uOrigin + (p - .5) * uBox;
  vec4 mv = viewMatrix * vec4(wp, 1.); gl_Position = projectionMatrix * mv;
  vS = aSeed.w; vA = smoothstep(0., .1, p.y) * smoothstep(1., .9, p.y);
  gl_PointSize = uSize * (.4 + aSeed.w) * 1080. / max(-mv.z, .1) * .02;
}`;
const PT_FRAG = `uniform vec3 uCol, uCol2; uniform float uInt, uTime; varying float vA; varying float vS;
void main(){ vec2 c = gl_PointCoord - .5; float d = length(c); float a = smoothstep(.5, 0., d); a *= a;
  float tw = .6 + .4 * sin(uTime * 3. + vS * 60.);
  gl_FragColor = vec4(mix(uCol, uCol2, vS) * a * uInt * vA * tw, 1.); }`;
export function particles(n, o = {}) {
  const g = new THREE.BufferGeometry(); const seed = new Float32Array(n * 4); let s = o.seed || 1;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < n * 4; i++) seed[i] = r();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
  const u = { uTime: { value: 0 }, uSize: { value: o.size ?? 3 }, uSpeed: { value: 1 }, uBox: { value: new THREE.Vector3(...(o.box || [20, 10, 20])) },
    uOrigin: { value: new THREE.Vector3(...(o.origin || [0, 5, 0])) }, uVel: { value: new THREE.Vector3(...(o.vel || [0, .3, 0])) },
    uCol: { value: new THREE.Color(...(o.color || [1, .8, .4])) }, uCol2: { value: new THREE.Color(...(o.color2 || o.color || [1, .6, .3])) }, uInt: { value: o.intensity ?? 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: PT_VERT, fragmentShader: PT_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; p.U = u; p.renderOrder = 6; return p;
}

// --- rain: instanced streaks, camera-following volume, pure function of time ---
const RAIN_VERT = `uniform float uTime, uLen; uniform vec3 uCenter, uBox, uWind; varying float vA; varying float vV;
float h(float n){ return fract(sin(n) * 43758.5453); }
void main(){
  float id = float(gl_InstanceID);
  vec3 s = vec3(h(id * 1.31), h(id * 7.13 + 1.), h(id * 3.77 + 2.));
  float spd = 14. + 6. * h(id * 2.1);
  vec3 lo = uCenter - uBox * .5;
  vec3 wp;
  wp.x = lo.x + mod(s.x * uBox.x + uWind.x * uTime - lo.x, uBox.x);
  wp.z = lo.z + mod(s.z * uBox.z + uWind.z * uTime - lo.z, uBox.z);
  wp.y = lo.y + mod(s.y * uBox.y - uTime * spd - lo.y, uBox.y);
  vec3 dir = normalize(vec3(uWind.x, -spd, uWind.z));
  vec3 toCam = normalize(cameraPosition - wp); vec3 side = normalize(cross(dir, toCam)) * .012;
  wp += side * position.x + dir * position.y * uLen;
  vA = (1. - position.y) * (.4 + .6 * h(id * 5.1)); vV = s.y;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.);
}`;
const RAIN_FRAG = `uniform vec3 uCol; uniform float uInt; varying float vA; void main(){ gl_FragColor = vec4(uCol * vA * uInt, 1.); }`;
export function rain(n, o = {}) {
  const g = new THREE.InstancedBufferGeometry(); const base = new THREE.PlaneGeometry(1, 1).translate(0, .5, 0);
  g.index = base.index; g.attributes.position = base.attributes.position; g.instanceCount = n;
  const u = { uTime: { value: 0 }, uLen: { value: o.len ?? .6 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: new THREE.Vector3(...(o.box || [24, 16, 24])) },
    uWind: { value: new THREE.Vector3(...(o.wind || [1.5, 0, .5])) }, uCol: { value: new THREE.Color(...(o.color || [.5, .6, .8])) }, uInt: { value: o.intensity ?? .6 } };
  const m = new THREE.ShaderMaterial({ uniforms: u, vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.U = u; mesh.renderOrder = 7; return mesh;
}

// unlit textured card (2D-in-3D layers, billboards). Additive or alpha.
export function cardMat(tex, o = {}) {
  const u = { uMap: { value: tex }, uTint: { value: new THREE.Color(...(o.tint || [1, 1, 1])) }, uInt: { value: o.intensity ?? 1 }, uFogMul: { value: o.fogMul ?? 0 }, uAlpha: { value: o.alpha ?? 1 } };
  const m = new THREE.ShaderMaterial({ uniforms: { ...G, ...u }, transparent: true, depthWrite: o.depthWrite ?? false, side: THREE.DoubleSide,
    blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    vertexShader: `varying vec2 vUv; varying vec3 vWPos; void main(){ vUv = uv; vec4 wp = modelMatrix * vec4(position, 1.); vWPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
    fragmentShader: COMMON + `uniform sampler2D uMap; uniform vec3 uTint; uniform float uInt, uFogMul, uAlpha; varying vec2 vUv; varying vec3 vWPos;
      void main(){ vec4 c = texture2D(uMap, vUv); vec3 col = c.rgb * uTint * uInt; col = mix(col, uFogCol * c.a, fogAmount(vWPos) * uFogMul);
        gl_FragColor = vec4(col, c.a * uAlpha); }` });
  m.U = u; return m;
}

export const SKYTEX = {};
export async function loadSkies() {
  const L = new THREE.TextureLoader();
  await Promise.all(['predawn', 'sunrise', 'golden'].map(n => new Promise(ok => L.load(`../assets/sky/sky_${n}.png`, t => { t.colorSpace = THREE.SRGBColorSpace; SKYTEX[n] = t; ok(); }, undefined, () => ok()))));
}
