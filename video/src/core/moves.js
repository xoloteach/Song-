// Choreography vocabulary. Every move is f(beatPhase, opts) -> pose. Beat 0 of a move lands ON the beat;
// hits use fast attack (outExpo/outBack) so poses arrive exactly on drum transients.
import { NEUTRAL, blendPose, addPose, mirrorPose } from './rig.js';
import { ease, lerp, clamp, fract, noise1, PI } from './util.js';

const P = (o) => ({ ...NEUTRAL, ...o });
// ---------------- key poses ----------------
export const POSES = {
  stand: P({}),
  relaxed: P({ shL: [.05, 0, .1], shR: [.05, 0, .1], elL: -.35, elR: -.3, head: [.05, 0, 0], hy: -.03 }),
  guard: P({ hy: -.09, footL: [.13, 0, .16], footR: [-.13, 0, -.14], frL: .25, frR: .5, ry: 0, hips: [0, .35, 0], chest: [.1, .2, 0], head: [.12, -.5, 0],
    shL: [-.7, -.1, .45], elL: -2.15, shR: [-.55, .1, .55], elR: -2.3, wrL: [0, 0, 0] }),
  jabL: P({ hy: -.09, footL: [.13, 0, .2], footR: [-.13, 0, -.14], frL: .25, frR: .5, hips: [0, .1, 0], chest: [.1, -.05, 0], head: [.12, -.2, 0],
    shL: [-1.55, -.1, .12], elL: -.08, shR: [-.55, .1, .55], elR: -2.35 }),
  crossR: P({ hy: -.1, footL: [.13, 0, .2], footR: [-.12, 0, -.12], frL: .2, frR: .9, fpR: .0, hips: [0, -.35, 0], chest: [.18, -.45, 0], head: [.12, .1, 0],
    shL: [-.6, -.1, .5], elL: -2.2, shR: [-1.55, .05, .05], elR: -.05 }),
  hookL: P({ hy: -.12, footL: [.14, 0, .18], footR: [-.13, 0, -.14], frL: .6, frR: .5, hips: [0, -.3, 0], chest: [.1, -.5, 0], head: [.1, .1, 0],
    shL: [-.25, 0, 1.3], elL: -1.65, shR: [-.55, .1, .55], elR: -2.3 }),
  uppercutR: P({ hy: -.2, footL: [.14, 0, .15], footR: [-.13, 0, -.12], frL: .3, frR: .6, hips: [.1, -.2, 0], chest: [-.05, -.3, 0], head: [-.05, 0, 0],
    shL: [-.6, -.1, .5], elL: -2.2, shR: [-1.1, .3, .3], elR: -1.9 }),
  crouch: P({ hy: -.36, chest: [.45, 0, 0], spine: [.2, 0, 0], head: [-.25, 0, 0], footL: [.16, 0, .05], footR: [-.16, 0, .05],
    shL: [-.2, 0, .25], elL: -.4, shR: [-.2, 0, .25], elR: -.4 }),
  crouchArmsBack: P({ hy: -.38, chest: [.55, 0, 0], spine: [.25, 0, 0], head: [-.35, 0, 0], footL: [.16, 0, .05], footR: [-.16, 0, .05],
    shL: [.9, 0, .2], elL: -.2, shR: [.9, 0, .2], elR: -.2 }),
  jumpUp: P({ y: .55, hy: 0, chest: [-.15, 0, 0], head: [-.3, 0, 0], footL: [.12, -.05, -.05], footR: [-.12, -.05, -.05], fpL: .7, fpR: .7,
    shL: [-.3, 0, 2.6], elL: -.1, shR: [-.3, 0, 2.6], elR: -.1 }),
  tuck: P({ y: .7, hy: 0, chest: [.3, 0, 0], head: [.1, 0, 0], footL: [.13, .32, .18], footR: [-.13, .32, .18], fpL: .3, fpR: .3,
    shL: [-1.2, 0, .3], elL: -1.8, shR: [-1.2, 0, .3], elR: -1.8 }),
  land: P({ hy: -.34, chest: [.5, 0, 0], spine: [.2, 0, 0], head: [-.3, 0, 0], footL: [.2, 0, .08], footR: [-.2, 0, -.02], frL: .3, frR: -.2,
    shL: [.2, 0, 1.1], elL: -.3, shR: [.4, 0, 1.0], elR: -.3 }),
  xCross: P({ hy: -.06, footL: [.2, 0, .02], footR: [-.2, 0, .02], frL: .2, frR: -.2, chest: [-.05, 0, 0], head: [.15, 0, 0],
    shL: [-.95, -1.45, -.12], elL: -1.95, shR: [-.85, -1.45, -.12], elR: -1.85 }),
  xStar: P({ hy: -.04, footL: [.42, 0, 0], footR: [-.42, 0, 0], frL: .35, frR: -.35, chest: [-.12, 0, 0], head: [-.35, 0, 0],
    shL: [0, 0, 2.45], elL: -.05, shR: [0, 0, 2.45], elR: -.05 }),
  victoryV: P({ hy: -.02, footL: [.18, 0, .04], footR: [-.18, 0, .0], chest: [-.18, 0, 0], head: [-.4, 0, 0],
    shL: [-.25, 0, 2.7], elL: -.15, shR: [-.25, 0, 2.7], elR: -.15 }),
  pointSky: P({ hy: -.04, footL: [.16, 0, .08], footR: [-.18, 0, -.06], frL: .3, frR: -.4, hips: [0, .15, 0], chest: [-.12, .15, 0], head: [-.45, .1, 0],
    shR: [-.35, 0, 2.95], elR: -.02, shL: [-.5, .4, .1], elL: -1.9 }),
  fistChest: P({ hy: -.04, footL: [.16, 0, .04], footR: [-.16, 0, .0], chest: [.05, 0, 0], head: [.25, 0, 0],
    shR: [-.75, 1.35, -.2], elR: -2.1, shL: [.05, 0, .12], elL: -.2 }),
  powerStance: P({ hy: -.14, footL: [.32, 0, .06], footR: [-.32, 0, .0], frL: .45, frR: -.45, chest: [.12, 0, 0], head: [.1, 0, 0],
    shL: [-.3, 0, .55], elL: -1.6, shR: [-.3, 0, .55], elR: -1.6 }),
  leanBack: P({ hy: -.12, hz: -.06, footL: [.2, 0, .12], footR: [-.2, 0, -.05], chest: [-.35, 0, 0], spine: [-.15, 0, 0], head: [-.2, 0, 0],
    shL: [.3, 0, 1.2], elL: -.6, shR: [-.8, 0, .4], elR: -.3 }),
  kneel: P({ hy: -.5, footL: [.15, 0, .34], footR: [-.13, .02, -.42], fpR: -1.0, frL: .1, chest: [.1, 0, 0], head: [.15, 0, 0],
    shL: [-.6, 0, .2], elL: -1.2, shR: [-.2, 0, .3], elR: -.3, kneeOutR: 0 }),
  kneelPoint: P({ hy: -.5, footL: [.15, 0, .34], footR: [-.13, .02, -.42], fpR: -1.0, chest: [-.05, .3, 0], head: [-.15, .2, 0],
    shL: [-1.55, 0, .2], elL: -.05, shR: [.3, 0, .4], elR: -.3, kneeOutR: 0 }),
  lookUp: P({ hy: -.02, chest: [-.12, 0, 0], head: [-.55, 0, 0], shL: [.08, 0, .15], elL: -.2, shR: [.08, 0, .15], elR: -.2 }),
  headDown: P({ hy: -.04, chest: [.15, 0, 0], head: [.55, 0, 0], shL: [.05, 0, .08], elL: -.15, shR: [.05, 0, .08], elR: -.15 }),
  sitEdge: P({ hy: -.52, hz: -.05, chest: [.25, 0, 0], head: [.35, 0, 0], hipL: [-1.45, 0, .08], knL: 1.35, hipR: [-1.5, 0, .05], knR: 1.5, footL: null, footR: null,
    shL: [-.7, .2, .2], elL: -1.4, shR: [-.6, -.2, .25], elR: -1.6 }),
  reach: P({ hy: -.02, chest: [-.1, 0, 0], head: [-.3, 0, 0], footL: [.12, 0, .1], footR: [-.12, 0, -.15], fpR: .5,
    shL: [-2.7, 0, .2], elL: -.1, shR: [-2.7, 0, .2], elR: -.1 }),
  carry: P({ hy: -.06, chest: [.05, 0, 0], head: [.1, 0, 0], shL: [-1.0, 0, .25], elL: -1.1, shR: [-1.0, 0, .25], elR: -1.1 }),
};

// ---------------- helpers ----------------
// keyed clip: ks = [[beat, poseOrFn, easeName]], length L (loops if loop)
export function clip(ks, L, loop = true) {
  return (b, o = {}) => {
    let x = loop ? ((b % L) + L) % L : clamp(b, 0, L);
    let i = 0; while (i < ks.length - 1 && x >= ks[i + 1][0]) i++;
    const a = ks[i], nb = ks[(i + 1) % ks.length]; const ta = a[0], tbk = i + 1 < ks.length ? nb[0] : (loop ? L + ks[0][0] : ta + 1);
    const pa = typeof a[1] === 'function' ? a[1](b, o) : a[1];
    if (i + 1 >= ks.length && !loop) return pa;
    const pb = typeof nb[1] === 'function' ? nb[1](b, o) : nb[1];
    const u = clamp((x - ta) / Math.max(1e-4, tbk - ta)); return blendPose(pa, pb, (ease[nb[2] || 'inOutCubic'])(u));
  };
}
const groove = (b, amt = 1) => { // additive bounce: hips dip on the beat, chest/head nod
  const f = fract(b), down = Math.exp(-f * 5) * (1 - f);
  return { hy: -.05 * amt * (1 - Math.cos(f * 2 * PI)) * .5 - .03 * amt * down, chest: [.06 * amt * down, 0, 0], head: [.12 * amt * Math.sin(f * 2 * PI + .6), 0, 0] };
};
export function withGroove(fn, amt = 1) { return (b, o) => addPose(fn(b, o), groove(b, o.groove ?? amt)); }
const sidesway = (b, amt) => ({ hx: .03 * amt * Math.sin(b * PI), hips: [0, 0, .05 * amt * Math.sin(b * PI)], chest: [0, 0, -.06 * amt * Math.sin(b * PI)] });

// ---------------- moves ----------------
export const MOVES = {
  idle: (b) => addPose(POSES.relaxed, { hy: -.012 * Math.sin(b * PI * .5), chest: [.02 * Math.sin(b * PI * .5), 0, 0], head: [.04 * noise1(b * .3, 3), .08 * noise1(b * .2, 5), 0], hx: .015 * noise1(b * .25, 9) }),
  breathe: (b) => addPose(POSES.headDown, { chest: [.04 * Math.sin(b * PI * .5), 0, 0], hy: -.01 * Math.sin(b * PI * .5) }),
  lookUp: (b) => addPose(POSES.lookUp, { head: [.03 * Math.sin(b * .9), .1 * noise1(b * .2, 2), 0] }),
  // relentless work: boxing combo (jab, jab, cross, hook) over 4 beats, hits land ON the beat
  box: clip([[0, POSES.jabL, 'outExpo'], [.45, POSES.guard], [1, POSES.jabL, 'outExpo'], [1.45, POSES.guard], [2, POSES.crossR, 'outExpo'], [2.5, POSES.guard], [3, POSES.hookL, 'outExpo'], [3.55, POSES.guard]], 4),
  box2: clip([[0, POSES.jabL, 'outExpo'], [.4, POSES.guard], [1, POSES.crossR, 'outExpo'], [1.5, POSES.guard], [2, POSES.uppercutR, 'outExpo'], [2.5, POSES.guard], [3, POSES.crossR, 'outExpo'], [3.5, POSES.guard]], 4),
  guardBounce: (b) => addPose(POSES.guard, { hy: -.04 * Math.abs(Math.sin(b * PI)), hx: .03 * Math.sin(b * PI * .5) }),
  // grooves
  bounce: withGroove((b) => addPose(POSES.relaxed, sidesway(b, 1)), 1.2),
  stepTouch: withGroove(clip([
    [0, P({ footL: [.32, 0, .02], footR: [-.05, 0, .02], fpR: .35, hx: .12, shL: [-.3, 0, .9], elL: -1.6, shR: [-.3, 0, .9], elR: -1.6, chest: [0, -.15, -.08], head: [0, -.2, 0] }), 'outBack'],
    [1, P({ footL: [.05, 0, .02], footR: [-.32, 0, .02], fpL: .35, hx: -.12, shL: [-.3, 0, .9], elL: -1.6, shR: [-.3, 0, .9], elR: -1.6, chest: [0, .15, .08], head: [0, .2, 0] }), 'outBack']], 2), 1),
  chestPop: withGroove(clip([[0, P({ chest: [-.25, 0, 0], hz: .04, shL: [-.4, 0, .7], elL: -1.9, shR: [-.4, 0, .7], elR: -1.9, footL: [.2, 0, 0], footR: [-.2, 0, 0], head: [-.1, 0, 0] }), 'outExpo'],
    [.5, P({ chest: [.15, 0, 0], hz: -.02, shL: [-.2, 0, .55], elL: -1.6, shR: [-.2, 0, .55], elR: -1.6, footL: [.2, 0, 0], footR: [-.2, 0, 0], head: [.1, 0, 0] })]], 1), .6),
  armWave: withGroove((b) => { // a wave travelling L hand -> shoulders -> R hand over 2 beats
    const ph = (b % 2) / 2, w = (k) => Math.sin((ph * 2 - k) * PI) * (ph * 2 - k > 0 && ph * 2 - k < 1 ? 1 : 0);
    return P({ footL: [.22, 0, 0], footR: [-.22, 0, 0], shL: [0, 0, 1.45 + .35 * w(0)], elL: -.5 * w(.15) + .2, wrL: [0, 0, .6 * w(.05)],
      shR: [0, 0, 1.45 - .35 * w(.7)], elR: -.5 * w(.85) + .2, wrR: [0, 0, .6 * w(.75)], chest: [0, 0, .15 * (w(.35) - w(.55))], head: [0, 0, .2 * (w(.4) - w(.6))] });
  }, .5),
  runningMan: clip([[0, P({ footL: [.12, .0, .25], footR: [-.12, .18, -.15], fpR: .4, hy: -.12, shL: [.5, 0, .2], elL: -1.5, shR: [-.9, 0, .2], elR: -1.5, chest: [.1, 0, 0] }), 'outQuad'],
    [.5, P({ footL: [.12, 0, -.05], footR: [-.12, .0, .1], hy: -.02, shL: [0, 0, .25], elL: -1.6, shR: [0, 0, .25], elR: -1.6 })],
    [1, P({ footL: [.12, .18, -.15], footR: [-.12, 0, .25], fpL: .4, hy: -.12, shL: [-.9, 0, .2], elL: -1.5, shR: [.5, 0, .2], elR: -1.5, chest: [.1, 0, 0] }), 'outQuad'],
    [1.5, P({ footL: [.12, 0, .1], footR: [-.12, 0, -.05], hy: -.02, shL: [0, 0, .25], elL: -1.6, shR: [0, 0, .25], elR: -1.6 })]], 2),
  stomp: clip([[0, P({ hy: -.2, footL: [.25, 0, .1], footR: [-.22, 0, -.02], chest: [.35, .2, 0], shL: [-.4, 0, .6], elL: -.4, shR: [.3, 0, .5], elR: -.2, head: [.1, 0, 0] }), 'outExpo'],
    [.5, P({ hy: -.06, footL: [.22, .22, .1], footR: [-.22, 0, -.02], chest: [.05, 0, 0], shL: [-.6, 0, .8], elL: -1.6, shR: [-.6, 0, .8], elR: -1.6 })],
    [1, P({ hy: -.2, footL: [.22, 0, -.02], footR: [-.25, 0, .1], chest: [.35, -.2, 0], shL: [.3, 0, .5], elL: -.2, shR: [-.4, 0, .6], elR: -.4, head: [.1, 0, 0] }), 'outExpo'],
    [1.5, P({ hy: -.06, footL: [.22, 0, -.02], footR: [-.22, .22, .1], chest: [.05, 0, 0], shL: [-.6, 0, .8], elL: -1.6, shR: [-.6, 0, .8], elR: -1.6 })]], 2),
  // signature: X — arms cross on the beat, explode into full-body X on the next
  xHit: clip([[0, POSES.xCross, 'outExpo'], [1, POSES.xStar, 'outBack'], [1.85, POSES.xStar]], 2, false),
  xHold: (b) => addPose(POSES.xCross, { chest: [.02 * Math.sin(b * 2), 0, 0] }),
  starHold: (b) => addPose(POSES.xStar, { chest: [-.03 * Math.sin(b * 2), 0, 0] }),
  victory: (b) => addPose(POSES.victoryV, { hy: -.03 * Math.abs(Math.sin(b * PI)) }),
  point: (b) => POSES.pointSky,
  power: (b) => addPose(POSES.powerStance, { chest: [.02 * Math.sin(b * PI), 0, 0] }),
  lean: (b) => POSES.leanBack,
  kneel: (b) => POSES.kneel, kneelPoint: (b) => POSES.kneelPoint,
  fistChest: (b) => POSES.fistChest,
  crouch: (b) => addPose(POSES.crouch, { hy: -.02 * Math.sin(b * PI), chest: [.03 * Math.sin(b * PI * .5), 0, 0] }),
  crouchArmsBack: (b) => POSES.crouchArmsBack,
  land: clip([[0, POSES.land, 'outExpo'], [1.2, POSES.powerStance]], 1.2, false),
  // jumps & leaps (non-loop): takeoff crouch on 0, airborne between, landing at L
  jump: clip([[0, POSES.crouchArmsBack], [.5, POSES.jumpUp, 'outQuad'], [1.2, POSES.tuck, 'inOutSine'], [1.7, POSES.jumpUp, 'inQuad'], [2, POSES.land, 'outExpo'], [2.6, POSES.relaxed]], 2.6, false),
  celebrate: clip([[0, POSES.crouch], [.5, P({ ...POSES.jumpUp, shR: [-.2, 0, 2.9], shL: [-.5, 0, .6], elL: -2, y: .45 }), 'outQuad'], [1, POSES.land, 'inQuad'], [1.5, POSES.pointSky, 'outBack']], 2, false),
  spin: (b, o) => { const u = ease.inOutCubic(clamp(b / (o.len || 2))); const p = blendPose(POSES.xCross, POSES.xStar, ease.outBack(clamp(b / (o.len || 2) * 1.3 - .3)));
    return { ...p, ry: (p.ry || 0) + u * PI * 2 * (o.turns || 1) }; },
  sit: (b) => addPose(POSES.sitEdge, { head: [.05 * Math.sin(b * .7), .15 * noise1(b * .2, 4), 0], elR: -1.6 + .25 * Math.sin(b * PI * 2) }), // sketching hand
  carry: withGroove((b) => POSES.carry, .3),
  reach: (b) => POSES.reach,
  // locomotion: run cycle, one stride per beat by default (o.rate strides/beat). root translation handled by scene.
  run: (b, o) => {
    const r = o.rate || 1, ph = b * r * PI; const s = Math.sin(ph), c = Math.cos(ph), k = o.intensity ?? 1;
    const lift = (x) => Math.max(0, x);
    return P({ hy: -.08 + .07 * Math.abs(c) * k, y: .06 * Math.abs(c) * k, chest: [.28 * k + .05, -.12 * s * k, 0], spine: [.08, 0, 0], head: [-.18, .1 * s, 0], hips: [0, .18 * s * k, 0],
      footL: null, footR: null,
      hipL: [-.95 * s * k - .2, 0, .04], knL: .35 + 1.5 * lift(-s * .9 + .5 * c) * k, anL: [.3 * lift(s), 0, 0],
      hipR: [.95 * s * k - .2, 0, .04], knR: .35 + 1.5 * lift(s * .9 - .5 * c) * k, anR: [.3 * lift(-s), 0, 0],
      shL: [1.0 * s * k, 0, .18], elL: -1.45 - .3 * s, shR: [-1.0 * s * k, 0, .18], elR: -1.45 + .3 * s });
  },
  sprintLeap: (b, o) => { // airborne leap pose (split), b in [0,1] of air time
    const u = clamp(b); return P({ y: .2, hy: 0, chest: [.35, 0, 0], head: [-.25, 0, 0], footL: null, footR: null,
      hipL: [-1.3 + .2 * u, 0, .05], knL: .35 + .4 * u, hipR: [.85 - .2 * u, 0, .05], knR: 1.1, anR: [.5, 0, 0],
      shL: [.9, 0, .3], elL: -.6, shR: [-2.4, 0, .25], elR: -.2 });
  },
  climb: (b, o) => addPose(MOVES.run(b, { rate: 1, intensity: .85 }), { chest: [.12, 0, 0] }),
};
export { mirrorPose };

// ---------------- choreography track evaluation ----------------
// track: [{b: startBeat, move: 'name', len?, o?: opts, mirror?, blend? }...] sorted. Pose at beat = move(b - start), cross-faded.
export function trackPose(track, b) {
  let i = 0; while (i < track.length - 1 && b >= track[i + 1].b) i++;
  const seg = track[i];
  const ev = (s) => { const fn = MOVES[s.move]; let p = fn(b - s.b + (s.off || 0), s.o || {}); if (s.mirror) p = mirrorPose(p); if (s.add) p = addPose(p, s.add); return p; };
  let pose = ev(seg);
  const bl = seg.blend ?? .35;
  if (i > 0 && b - seg.b < bl) pose = blendPose(ev(track[i - 1]), pose, ease.inOutSine(clamp((b - seg.b) / bl)));
  return pose;
}
