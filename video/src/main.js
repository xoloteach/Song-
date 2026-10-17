// TEN — master timeline. renderFrameAt(t) is a pure function of t (deterministic offline rendering).
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { G, loadMatcaps, loadSkies } from './core/materials.js';
import { loadDigits } from './core/props.js';
import { loadAudio, tb, bt, beatPulse, kick } from './core/audio.js';
import { clamp, lerp, ease, prog, fract } from './core/util.js';
import * as D from './core/draw2d.js';
import { wins, winTime, sinceWin, clock } from './story.js';
import { Intro } from './scenes/intro.js';
import { Grind } from './scenes/grind.js';
import { Run } from './scenes/run.js';
import { Crew } from './scenes/crew.js';
import { Blueprint } from './scenes/blueprint.js';
import { Rise } from './scenes/rise.js';
import { Summit } from './scenes/summit.js';
import { noise1 } from './core/util.js';

const Q = new URLSearchParams(location.search); window.DBG = Q.get('dbg') || '';
export const DURATION = 163.5;

class App {
  constructor() { this.eng = new Engine(document.getElementById('gl')); this.S = {}; this.bakeQueue = []; this.black = new THREE.Scene(); this.blackCam = new THREE.PerspectiveCamera(); }
  blackLayer(which) { this.eng.renderLayer(which, this.black, this.blackCam); }
  async init() {
    await Promise.all([
      document.fonts.load('700 100px "Big Shoulders"'), document.fonts.load('400 100px "Big Shoulders"'), document.fonts.load('900 100px "Inter Display"'),
      document.fonts.load('700 100px "Inter Display"'), document.fonts.load('400 30px "JetBrains Mono"'), document.fonts.load('700 30px "JetBrains Mono"')]);
    await loadAudio('/video/data/audio.json');
    await loadMatcaps(['clay_dark', 'obsidian', 'pearl_dawn', 'glass_echo', 'gold', 'chrome_night']);
    await loadDigits(); await loadSkies();
    this.S.intro = new Intro(this); this.S.grind = new Grind(this); this.S.run = new Run(this); this.S.crew = new Crew(this); this.S.blueprint = new Blueprint(this); this.S.rise = new Rise(this); this.S.summit = new Summit(this);
    for (const f of this.bakeQueue) f();
    this.sections = [
      { id: 'intro', t0: 0, t1: tb(12), run: (t) => { this.S.intro.compose(t); return () => this.S.intro.draw2D(t); } },
      { id: 'grind', t0: tb(12), t1: tb(50), run: (t) => this.simple('grind', t) },
      { id: 'run', t0: tb(50), t1: tb(80), run: (t) => this.simple('run', t) },
      { id: 'crew', t0: tb(80), t1: tb(142), run: (t) => this.simple('crew', t) },
      { id: 'blueprint', t0: tb(142), t1: tb(176.5), run: (t) => this.simple('blueprint', t) },
      { id: 'morph', t0: tb(176.5), t1: tb(180), run: (t) => this.morph(t) },
      { id: 'rise', t0: tb(180), t1: tb(208), run: (t) => this.simple('rise', t) },
      { id: 'summit', t0: tb(208), t1: 1000, run: (t) => this.simple('summit', t) },
    ];
    // warm-up compile
    for (const s of this.sections) { try { await this.renderFrameAt(Math.min(s.t0 + .01, 163)); } catch (e) { console.error('warmup', s.id, e.message); } }
    // memories: photograph earlier moments of the film (rendered by the film itself) for Act VI
    const shots = [[9.5, 'I'], [26.2, 'II'], [31.0, 'II'], [36.9, 'III'], [45.5, 'III'], [55.5, 'IV'], [75.5, 'V'], [83.2, 'VI'], [93.5, 'VI'], [118.5, 'VIII']], texs = [];
    for (const [tt, cap] of shots) {
      this.noHud = true; await this.renderFrameAt(tt); this.noHud = false;
      const c = document.createElement('canvas'); c.width = 512; c.height = 376; const x = c.getContext('2d');
      x.fillStyle = '#f1ebdf'; x.fillRect(0, 0, 512, 376); x.drawImage(this.eng.renderer.domElement, 240, 0, 1440, 1080, 16, 16, 480, 300);
      x.fillStyle = '#1a1424'; x.font = '700 40px "Big Shoulders"'; x.fillText(cap, 24, 360); x.font = '400 18px "JetBrains Mono"'; x.fillText(clock(tt), 400, 356);
      const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; texs.push(tx);
    }
    this.S.summit.setMemories(texs);
  }
  morph(t) { // blueprint -> reality: an ink fill rises up the frame
    const E = this.eng, b = bt(t), u = ease.inOutCubic(prog(b, 176.5, 179.5));
    this.S.blueprint.draw3D(t, 'A'); this.S.rise.draw3D(t, 'B'); this.S.rise.fx(t);
    E.fx.mixMode = 2; const m = E.mask.ctx; E.mask.used = true; m.fillStyle = '#fff'; m.beginPath(); m.moveTo(0, 540);
    const lvl = 540 - u * 640; for (let xx = 0; xx <= 960; xx += 12) m.lineTo(xx, lvl + noise1(xx * .02 + b, 3) * 40 + noise1(xx * .1, 5) * 8);
    m.lineTo(960, 540); m.closePath(); m.fill();
    // glowing seam
    const P = E.pre.ctx; E.pre.used = true; E.fx.preGain = 3; P.strokeStyle = 'rgba(255,190,110,1)'; P.lineWidth = 6; P.beginPath();
    for (let xx = 0; xx <= 960; xx += 12) { const y = (lvl + noise1(xx * .02 + b, 3) * 40 + noise1(xx * .1, 5) * 8) * 2; xx ? P.lineTo(xx * 2, y) : P.moveTo(0, y); } P.stroke();
    return () => { if (u < .5) this.S.blueprint.draw2D(t); else this.S.rise.draw2D(t); };
  }
  simple(id, t, which = 'A') { const s = this.S[id]; s.draw3D(t, which); s.fx(t); return () => s.draw2D(t); }
  hud(t) { // persistent narrative HUD: round counter, tally of wins, the night clock
    const E = this.eng, x = E.post.ctx, b = bt(t); E.post.used = true; const n = wins(t);
    const a = clamp((t - tb(12)) / 1) * (1 - clamp((t - tb(334)) / 1.5)) * (this.hudAlpha ?? 1);
    if (a <= 0) return;
    x.save(); x.globalAlpha = a;
    const sw = sinceWin(t), pop = Math.exp(-sw * 4);
    D.text(x, 'ROUND', 96, 112, { size: 20, fam: 'JetBrains Mono', color: 'rgba(242,234,216,.6)', track: 8 });
    x.save(); x.translate(96, 172); x.scale(1 + pop * .3, 1 + pop * .3);
    D.text(x, String(n).padStart(2, '0'), 0, 0, { size: 62, color: pop > .05 ? D.GOLD : D.INK, track: 2 }); x.restore();
    D.text(x, '/ 10', 172, 172, { size: 30, color: 'rgba(242,234,216,.55)' });
    // tally (wins) top-right
    D.tally(x, n, 1660, 82, 70, { color: D.INK, color2: D.GOLD, lastProg: ease.outCubic(clamp(sw * 3)) });
    // clock bottom-right
    D.text(x, clock(t), 1824, 1010, { size: 30, fam: 'JetBrains Mono', weight: 700, align: 'right', color: D.INK, track: 4 });
    D.text(x, n >= 10 ? 'SUNRISE' : 'NIGHT SHIFT', 1824, 1042, { size: 16, fam: 'JetBrains Mono', align: 'right', color: 'rgba(242,234,216,.55)', track: 8 });
    x.restore();
  }
  async renderFrameAt(t) {
    const E = this.eng; E.beginFrame(); G.uTime.value = t; this.hudAlpha = 1;
    const sec = this.sections.find(s => t >= s.t0 && t < s.t1) || this.sections[this.sections.length - 1];
    let hasB = false; const before = E.fx.mixMode;
    const draw2 = sec.run(t);
    hasB = E.fx.mixMode > 0;
    if (draw2) draw2();
    if (!this.noHud) this.hud(t);
    E.compose(t, Math.round(t * 30), hasB);
    E.finish();
  }
}
const app = new App(); window.app = app;
window.renderFrameAt = (t) => app.renderFrameAt(t);
app.init().then(() => { window.ready = true; }).catch(e => { console.error('INIT FAIL', e.stack || e.message); });
