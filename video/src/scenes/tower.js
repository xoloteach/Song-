// Shared geometry/staging for the tower acts (Blueprint -> Rise): same footprint, same helix, same camera at the morph.
import * as THREE from 'three';
import { tb, bt } from '../core/audio.js';
import { clamp, lerp, ease, prog, PI } from '../core/util.js';

export const TW = { half: 3.6, floorH: 3, floors: 10, R: 5.4, turns: 3 };
TW.height = TW.floorH * TW.floors;
export const HELIX_LEN = TW.turns * Math.hypot(2 * PI * TW.R, TW.height / TW.turns);
// point on the stair helix at arc length s (0 at ground, angle 0 = +x side)
export function helix(s) {
  const u = clamp(s / HELIX_LEN, 0, 1), a = u * TW.turns * 2 * PI;
  return { x: Math.cos(a) * TW.R, z: Math.sin(a) * TW.R, y: u * TW.height, a, ry: -a }; // ry: facing the direction of travel along the helix
}
// where the crew gathers at the stair foot (shared by both scenes at the morph)
export function gatherPos(i) { const row = Math.floor(i / 4), col = i % 4; return { x: TW.R + 2.2 + row * 1.3, z: -2.6 + col * 1.3 + row * .6, ry: PI }; }
// morph camera (beats 170-182): looking at the tower from the crew's side, slowly rising
export function morphCam(cam, t) {
  const b = bt(t), u = ease.inOutSine(prog(b, 168, 184));
  cam.position.set(lerp(19, 15, u), lerp(2.2, 6, u), lerp(9, 13, u)); cam.lookAt(2, lerp(5, 10, u), 0);
  cam.fov = 40; cam.updateProjectionMatrix();
}
export function floorBox(i) { const set = i >= 7 ? .35 : i >= 4 ? .15 : 0; return { w: (TW.half - set) * 2, h: TW.floorH, y: i * TW.floorH }; }
