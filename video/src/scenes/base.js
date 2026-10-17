import * as THREE from 'three';
import { G, resetLights, setLight } from '../core/materials.js';
import { W, H } from '../core/engine.js';
import { spline, noise1 } from '../core/util.js';

export class BaseScene {
  constructor(app) { this.app = app; this.scene = new THREE.Scene(); this.cam = new THREE.PerspectiveCamera(35, W / H, .1, 2000); }
  // set global light rig (called before rendering this scene's layer)
  lights(L) {
    G.uKeyDir.value.set(...L.keyDir).normalize(); G.uKeyCol.value.setRGB(...L.key); G.uSkyCol.value.setRGB(...L.sky); G.uGroundCol.value.setRGB(...L.ground);
    G.uRimCol.value.setRGB(...L.rim); G.uFogCol.value.setRGB(...L.fog); G.uFogDensity.value = L.fogD ?? .01; G.uFogBase.value = L.fogBase ?? 0; G.uFogFall.value = L.fogFall ?? 0;
    resetLights(); (L.points || []).forEach((p, i) => setLight(i, p[0], p[1], p[2]));
  }
  // camera from position/target splines with optional handheld noise
  camPath(t, pos, tgt, o = {}) {
    const p = Array.isArray(pos[0]) ? spline(pos, t) : pos, q = Array.isArray(tgt[0]) ? spline(tgt, t) : tgt;
    const hh = o.shake ?? .02, f = o.freq ?? .7;
    this.cam.position.set(p[0] + noise1(t * f, 11) * hh, p[1] + noise1(t * f, 12) * hh, p[2] + noise1(t * f, 13) * hh);
    this.cam.lookAt(q[0] + noise1(t * f, 14) * hh, q[1] + noise1(t * f, 15) * hh, q[2]);
    if (o.roll) this.cam.rotateZ(o.roll);
    if (o.fov) { this.cam.fov = o.fov; this.cam.updateProjectionMatrix(); }
  }
  setFov(f) { if (this.cam.fov !== f) { this.cam.fov = f; this.cam.updateProjectionMatrix(); } }
  draw3D(t, which) { }
  draw2D(t) { }
  fx(t) { }
}
