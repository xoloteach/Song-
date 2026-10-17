// PROLOGUE — "ZERO HOUR" (0–5.8s): an ink stopwatch draws itself, tick by tick, on black paper. The drawn
// zero is a lens: through it we glimpse the rooftop. On the first impact the ring blows open into 3D.
import { BaseScene } from './base.js';
import { tb, bt, env, beatPulse } from '../core/audio.js';
import { clamp, lerp, ease, prog, fract, PI, TAU, hash } from '../core/util.js';
import * as D from '../core/draw2d.js';

export class Intro extends BaseScene {
  ringR(t) { const b = bt(t); const open = ease.inExpo(prog(b, 10.6, 12)); return lerp(250, 1250, open) + 10 * beatPulse(t, 6); }
  compose(t) { // called by main: A = black, B = rooftop through the ring mask
    const E = this.app.eng, b = bt(t);
    this.app.blackLayer('A');
    this.app.S.grind.draw3D(t, 'B', { shot: 'intro' });
    E.fx.mixMode = 2;
    const m = E.mask.ctx; E.mask.used = true; const r = this.ringR(t) * .5, reveal = ease.outCubic(prog(b, 3, 8));
    m.save(); m.fillStyle = '#fff'; m.globalAlpha = reveal; m.beginPath(); m.arc(480, 270, Math.max(0, r - 6), 0, TAU); m.fill(); m.restore();
    this.app.S.grind.fx(t);
    const F = E.fx; F.vignette = .6; F.grain = .06; F.exposure *= lerp(.6, 1, reveal); F.flash = 0;
  }
  draw2D(t) {
    const E = this.app.eng, x = E.post.ctx, b = bt(t); E.post.used = true;
    const R = this.ringR(t), cx = 960, cy = 540;
    // the drawn zero: ink circle, completes over the first 3 beats
    D.ring(x, cx, cy, R, 16 + 4 * beatPulse(t, 6), ease.inOutCubic(prog(b, -.1, 3.2)), { color: D.INK, seed: 2 });
    // stopwatch ticks: one per beat (12 beats until the first impact)
    x.save(); x.translate(cx, cy);
    for (let i = 0; i < 60; i++) { const a = -PI / 2 + i / 60 * TAU; const major = i % 5 === 0; const lit = i / 60 < (b + 1) / 12;
      const r0 = R + 28, r1 = r0 + (major ? 34 : 16); x.strokeStyle = lit ? (major ? D.GOLD : D.INK) : 'rgba(242,234,216,.15)'; x.lineWidth = major ? 5 : 2;
      x.beginPath(); x.moveTo(Math.cos(a) * r0, Math.sin(a) * r0); x.lineTo(Math.cos(a) * r1, Math.sin(a) * r1); x.stroke(); }
    // sweeping hand
    const ha = -PI / 2 + clamp((b + 1) / 12, 0, 1.2) * TAU; x.strokeStyle = D.EMBER; x.lineWidth = 4; x.beginPath(); x.moveTo(Math.cos(ha) * (R + 10), Math.sin(ha) * (R + 10)); x.lineTo(Math.cos(ha) * (R + 80), Math.sin(ha) * (R + 80)); x.stroke();
    x.restore();
    // typographic slate
    const a1 = clamp(b / 2) * (1 - clamp((b - 10.5) / 1));
    x.save(); x.globalAlpha = a1;
    D.text(x, '03:00', 96, 120, { size: 30, fam: 'JetBrains Mono', weight: 700, color: D.INK, track: 6 });
    D.text(x, 'ROUND 00 / 10', 96, 160, { size: 22, fam: 'JetBrains Mono', color: 'rgba(242,234,216,.6)', track: 6 });
    D.text(x, 'FROM ZERO', 1824, 120, { size: 30, fam: 'JetBrains Mono', weight: 700, color: D.INK, track: 8, align: 'right' });
    D.text(x, 'TO TEN', 1824, 160, { size: 22, fam: 'JetBrains Mono', color: D.GOLD, track: 8, align: 'right' });
    x.restore();
    // the big zero numeral ghosted in the ring at the start
    const za = clamp(1 - b / 4) * clamp(t * 2);
    if (za > 0) D.text(x, '0', cx, cy + 150, { size: 420, align: 'center', color: `rgba(242,234,216,${.12 * za})` });
  }
}
