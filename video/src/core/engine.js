// Rendering engine: HDR scene layers -> transition mix (+2D 'pre' light layer) -> dual-kawase bloom
// -> final cinematic composite (exposure, white balance, ACES, grade, CA, halftone "ink" print mode,
// vignette, grain, 2D 'post' overlay, letterbox, flashes). All deterministic per frame.
import * as THREE from 'three';

export const W = 1920, H = 1080;
const QS = new URLSearchParams(location.search);
export const SC = Number(QS.get('scale') || 1), GW = Math.round(W * SC), GH = Math.round(H * SC);
const FSQ_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;

function rt(w, h, opts = {}) {
  return new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: !!opts.depth,
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, samples: opts.samples || 0, colorSpace: THREE.NoColorSpace });
}

export class Engine {
  constructor(canvas) {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
    r.setPixelRatio(1); r.setSize(GW, GH, false);
    r.outputColorSpace = THREE.LinearSRGBColorSpace; r.toneMapping = THREE.NoToneMapping; r.autoClear = true;
    this.samples = Number(new URLSearchParams(location.search).get('msaa') ?? 4);
    this.rtA = rt(GW, GH, { depth: true, samples: this.samples });
    this.rtB = rt(GW, GH, { depth: true, samples: this.samples });
    this.rtMix = rt(GW, GH);
    this.bloomLv = []; let w = GW, h = GH;
    for (let i = 0; i < 6; i++) { w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); this.bloomLv.push({ down: rt(w, h), up: rt(w, h), w, h }); }
    this.fsScene = new THREE.Scene(); this.fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); this.quad.frustumCulled = false; this.fsScene.add(this.quad);
    // 2D canvases
    const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace; t.premultiplyAlpha = true; t.generateMipmaps = false; t.minFilter = t.magFilter = THREE.LinearFilter; return { c, ctx: c.getContext('2d'), tex: t, used: false }; };
    this.post = mk(GW, GH); this.pre = mk(GW, GH); this.mask = mk(Math.round(GW / 2), Math.round(GH / 2));
    this.blank = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1); this.blank.needsUpdate = true;
    this.white = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1); this.white.needsUpdate = true;
    this._mats();
    this.resetFX();
  }
  resetFX() {
    this.fx = {
      exposure: 1, bloom: .9, bloomRadius: 1, bloomThreshold: .8, temp: 0, tint: 0, sat: 1, contrast: 1.05,
      lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], vignette: .35, grain: .045, ca: 0.0015,
      ink: 0, inkPaper: [0.93, 0.9, 0.84], inkInk: [0.05, 0.05, 0.08], inkScale: 7, inkAngle: .5,
      letterbox: 0, flash: 0, flashColor: [1, 1, 1], fade: 0, fadeColor: [0, 0, 0],
      mix: 0, mixMode: 0, preGain: 1, shake: [0, 0], blurDir: [0, 0], invert: 0,
    };
  }
  _mats() {
    const mixFrag = `varying vec2 vUv; uniform sampler2D tA, tB, tMask, tPre; uniform float uMix, uMode, uPreGain, uTime; uniform vec2 uBlurDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      vec4 samp(sampler2D t, vec2 uv){ if(length(uBlurDir) < 1e-5) return texture2D(t, uv);
        vec4 c = vec4(0.); for(int i=0;i<9;i++){ float o = (float(i)/8. - .5); c += texture2D(t, uv + uBlurDir*o); } return c/9.; }
      void main(){
        vec4 a = samp(tA, vUv); vec3 col = a.rgb;
        if(uMode > .5){ vec4 b = samp(tB, vUv); float m = uMix;
          if(uMode > 1.5) { m = texture2D(tMask, vUv).a; }
          col = mix(a.rgb, b.rgb, clamp(m, 0., 1.)); }
        vec4 p = texture2D(tPre, vUv); col += p.rgb * uPreGain;
        gl_FragColor = vec4(col, 1.);
      }`;
    this.mixMat = new THREE.ShaderMaterial({ vertexShader: FSQ_VERT, fragmentShader: mixFrag, depthTest: false, depthWrite: false,
      uniforms: { tA: { value: null }, tB: { value: null }, tMask: { value: null }, tPre: { value: null }, uMix: { value: 0 }, uMode: { value: 0 }, uPreGain: { value: 1 }, uTime: { value: 0 }, uBlurDir: { value: new THREE.Vector2() } } });
    // dual kawase
    this.downMat = new THREE.ShaderMaterial({ vertexShader: FSQ_VERT, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThresh: { value: 0 }, uFirst: { value: 0 } },
      fragmentShader: `varying vec2 vUv; uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThresh, uFirst;
        vec3 pre(vec3 c){ if(uFirst < .5) return c; float l = max(c.r, max(c.g, c.b)); float k = max(l - uThresh, 0.); k = k*k/(k + .5 + 1e-4); return c * (k / max(l, 1e-4)); }
        void main(){ vec2 o = uTexel; vec3 s = pre(texture2D(tSrc, vUv).rgb) * 4.;
          s += pre(texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb); s += pre(texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb);
          s += pre(texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb); s += pre(texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb);
          gl_FragColor = vec4(min(s / 8., vec3(64.)), 1.); }` });
    this.upMat = new THREE.ShaderMaterial({ vertexShader: FSQ_VERT, depthTest: false, depthWrite: false,
      uniforms: { tSrc: { value: null }, tAdd: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } },
      fragmentShader: `varying vec2 vUv; uniform sampler2D tSrc, tAdd; uniform vec2 uTexel; uniform float uRadius;
        void main(){ vec2 o = uTexel * uRadius; vec3 s = vec3(0.);
          s += texture2D(tSrc, vUv + vec2(-o.x*2., 0.)).rgb; s += texture2D(tSrc, vUv + vec2(o.x*2., 0.)).rgb;
          s += texture2D(tSrc, vUv + vec2(0., -o.y*2.)).rgb; s += texture2D(tSrc, vUv + vec2(0., o.y*2.)).rgb;
          s += texture2D(tSrc, vUv + vec2(-o.x, o.y)).rgb * 2.; s += texture2D(tSrc, vUv + vec2(o.x, o.y)).rgb * 2.;
          s += texture2D(tSrc, vUv + vec2(-o.x, -o.y)).rgb * 2.; s += texture2D(tSrc, vUv + vec2(o.x, -o.y)).rgb * 2.;
          gl_FragColor = vec4(s / 12. + texture2D(tAdd, vUv).rgb, 1.); }` });
    this.finalMat = new THREE.ShaderMaterial({ vertexShader: FSQ_VERT, depthTest: false, depthWrite: false,
      uniforms: {
        tHDR: { value: null }, tBloom: { value: null }, tPost: { value: null }, uTime: { value: 0 }, uFrame: { value: 0 },
        uExposure: { value: 1 }, uBloom: { value: 1 }, uTemp: { value: 0 }, uTint: { value: 0 }, uSat: { value: 1 }, uContrast: { value: 1 },
        uLift: { value: new THREE.Vector3() }, uGamma: { value: new THREE.Vector3(1, 1, 1) }, uGain: { value: new THREE.Vector3(1, 1, 1) },
        uVignette: { value: .3 }, uGrain: { value: .04 }, uCA: { value: .001 }, uInk: { value: 0 }, uInkPaper: { value: new THREE.Vector3() }, uInkInk: { value: new THREE.Vector3() },
        uInkScale: { value: 7 }, uInkAngle: { value: .5 }, uLetterbox: { value: 0 }, uFlash: { value: 0 }, uFlashColor: { value: new THREE.Vector3(1, 1, 1) },
        uFade: { value: 0 }, uFadeColor: { value: new THREE.Vector3() }, uRes: { value: new THREE.Vector2(GW, GH) }, uShake: { value: new THREE.Vector2() }, uInvert: { value: 0 },
      },
      fragmentShader: `varying vec2 vUv; uniform sampler2D tHDR, tBloom, tPost; uniform float uTime, uFrame, uExposure, uBloom, uTemp, uTint, uSat, uContrast,
        uVignette, uGrain, uCA, uInk, uInkScale, uInkAngle, uLetterbox, uFlash, uFade, uInvert; uniform vec3 uLift, uGamma, uGain, uInkPaper, uInkInk, uFlashColor, uFadeColor; uniform vec2 uRes, uShake;
        vec3 aces(vec3 x){ const float a=2.51,b=.03,c=2.43,d=.59,e=.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.,1.); }
        float hash(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
        vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1./2.4)) - .055, step(.0031308, c)); }
        float luma(vec3 c){ return dot(c, vec3(.2126,.7152,.0722)); }
        vec3 hdrAt(vec2 uv){ return texture2D(tHDR, uv).rgb + texture2D(tBloom, uv).rgb * uBloom; }
        void main(){
          vec2 uv = vUv + uShake;
          vec2 d = uv - .5; float r2 = dot(d, d);
          vec3 c;
          if (uCA > 0.) { vec2 o = d * uCA * (1. + r2 * 4.);
            c = vec3(hdrAt(uv - o).r, hdrAt(uv).g, hdrAt(uv + o).b); } else c = hdrAt(uv);
          c *= uExposure;
          // white balance (temperature / tint) in linear
          c *= vec3(1. + uTemp * .18, 1. + uTint * .08, 1. - uTemp * .18);
          c = aces(c);
          // grade: lift/gamma/gain, contrast around mid grey, saturation
          c = pow(max(c * uGain + uLift * (1. - c), 0.), 1. / uGamma);
          c = (c - .18) * uContrast + .18; c = max(c, 0.);
          float l = luma(c); c = mix(vec3(l), c, uSat);
          vec3 s = toSRGB(clamp(c, 0., 1.));
          // ink / halftone print look (3D -> 2D bridge)
          if (uInk > 0.) {
            float L = luma(s);
            vec2 px = gl_FragCoord.xy * (1920. / uRes.x); float ca = cos(uInkAngle), sa = sin(uInkAngle);
            vec2 q = mat2(ca, -sa, sa, ca) * px / uInkScale; vec2 cell = fract(q) - .5;
            float dotR = sqrt(clamp(1. - L, 0., 1.)) * .62; float dt = smoothstep(dotR + .06, dotR - .06, length(cell));
            // edge detect
            vec2 e = 1. / uRes; float lx = luma(aces(hdrAt(uv + vec2(e.x, 0.))*uExposure)) - luma(aces(hdrAt(uv - vec2(e.x, 0.))*uExposure));
            float ly = luma(aces(hdrAt(uv + vec2(0., e.y))*uExposure)) - luma(aces(hdrAt(uv - vec2(0., e.y))*uExposure));
            float edge = smoothstep(.05, .2, length(vec2(lx, ly)));
            float inkv = max(dt, edge); inkv = max(inkv, step(L, .08));
            vec3 printed = mix(uInkPaper, uInkInk, inkv);
            s = mix(s, printed, uInk);
          }
          s = mix(s, 1. - s, uInvert);
          // vignette
          s *= mix(1., smoothstep(1.05, .2, length(d * vec2(1.15, 1.))), uVignette);
          // flash
          s = mix(s, uFlashColor, clamp(uFlash, 0., 1.)) + uFlashColor * max(uFlash - 1., 0.);
          // grain (luma-weighted, per frame)
          float g = hash(vec3(gl_FragCoord.xy, uFrame)) - .5; s += g * uGrain * (1. - luma(s) * .6);
          // 2D post overlay (premultiplied)
          vec4 p = texture2D(tPost, vUv); s = s * (1. - p.a) + p.rgb;
          s = mix(s, uFadeColor, uFade);
          // letterbox
          float lb = uLetterbox * .5; if (vUv.y < lb || vUv.y > 1. - lb) s = vec3(0.);
          gl_FragColor = vec4(clamp(s, 0., 1.), 1.);
        }` });
  }
  _pass(mat, target) { this.quad.material = mat; this.renderer.setRenderTarget(target); this.renderer.render(this.fsScene, this.fsCam); }
  beginFrame() {
    for (const k of ['post', 'pre', 'mask']) { const L = this[k]; L.ctx.setTransform(1, 0, 0, 1, 0, 0); L.ctx.clearRect(0, 0, L.c.width, L.c.height); L.ctx.setTransform(SC, 0, 0, SC, 0, 0); L.used = false; L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = 'source-over'; }
    this.resetFX();
  }
  renderLayer(which, scene, camera) {
    const target = which === 'B' ? this.rtB : this.rtA;
    this.renderer.setRenderTarget(target); this.renderer.setClearColor(0x000000, 1); this.renderer.clear(); this.renderer.render(scene, camera);
  }
  // render several cameras into scissored panels of one layer (comic multi-angle freeze frames)
  renderPanels(which, scene, cams, rects) {
    const target = which === 'B' ? this.rtB : this.rtA, r = this.renderer;
    r.setRenderTarget(target); r.setClearColor(0x000000, 1); r.clear();
    target.scissorTest = true;
    cams.forEach((c, i) => { const [x, y, w, h] = rects[i].map(v => Math.round(v * SC)); c.aspect = w / h; c.updateProjectionMatrix();
      target.viewport.set(x, y, w, h); target.scissor.set(x, y, w, h); r.setRenderTarget(target); r.render(scene, c); });
    target.viewport.set(0, 0, GW, GH); target.scissor.set(0, 0, GW, GH); target.scissorTest = false; r.setRenderTarget(null);
  }
  compose(t, frame, hasB) {
    const fx = this.fx, r = this.renderer;
    for (const k of ['post', 'pre', 'mask']) if (this[k].used) this[k].tex.needsUpdate = true;
    const mu = this.mixMat.uniforms;
    mu.tA.value = this.rtA.texture; mu.tB.value = hasB ? this.rtB.texture : this.rtA.texture;
    mu.tMask.value = this.mask.used ? this.mask.tex : this.blank; mu.tPre.value = this.pre.used ? this.pre.tex : this.blank;
    mu.uMix.value = fx.mix; mu.uMode.value = hasB ? (fx.mixMode || 1) : 0; mu.uPreGain.value = fx.preGain; mu.uBlurDir.value.set(fx.blurDir[0], fx.blurDir[1]);
    this._pass(this.mixMat, this.rtMix);
    // bloom
    let src = this.rtMix.texture;
    const L = this.bloomLv;
    const nb = (window.DBG || '').includes('bloom') ? 0 : L.length;
    for (let i = 0; i < L.length; i++) {
      const u = this.downMat.uniforms; u.tSrc.value = src; u.uFirst.value = i === 0 ? 1 : 0; u.uThresh.value = fx.bloomThreshold;
      const sw = i === 0 ? GW : L[i - 1].w, sh = i === 0 ? GH : L[i - 1].h; u.uTexel.value.set(1 / sw, 1 / sh);
      this._pass(this.downMat, L[i].down); src = L[i].down.texture;
    }
    let up = L[L.length - 1].down.texture;
    for (let i = L.length - 2; i >= 0; i--) {
      const u = this.upMat.uniforms; u.tSrc.value = up; u.tAdd.value = L[i].down.texture; u.uRadius.value = fx.bloomRadius;
      u.uTexel.value.set(1 / L[i + 1].w, 1 / L[i + 1].h); this._pass(this.upMat, L[i].up); up = L[i].up.texture;
    }
    const f = this.finalMat.uniforms;
    f.tHDR.value = this.rtMix.texture; f.tBloom.value = up; f.tPost.value = this.post.used ? this.post.tex : this.blank;
    f.uTime.value = t; f.uFrame.value = frame % 997; f.uExposure.value = fx.exposure; f.uBloom.value = fx.bloom / 5; f.uTemp.value = fx.temp; f.uTint.value = fx.tint;
    f.uSat.value = fx.sat; f.uContrast.value = fx.contrast; f.uLift.value.fromArray(fx.lift); f.uGamma.value.fromArray(fx.gamma); f.uGain.value.fromArray(fx.gain);
    f.uVignette.value = fx.vignette; f.uGrain.value = fx.grain; f.uCA.value = fx.ca; f.uInk.value = fx.ink; f.uInkPaper.value.fromArray(fx.inkPaper); f.uInkInk.value.fromArray(fx.inkInk);
    f.uInkScale.value = fx.inkScale; f.uInkAngle.value = fx.inkAngle; f.uLetterbox.value = fx.letterbox; f.uFlash.value = fx.flash; f.uFlashColor.value.fromArray(fx.flashColor);
    f.uFade.value = fx.fade; f.uFadeColor.value.fromArray(fx.fadeColor); f.uShake.value.set(fx.shake[0], fx.shake[1]); f.uInvert.value = fx.invert;
    this._pass(this.finalMat, null);
  }
  finish() { if (QS.get('live')) return; const gl = this.renderer.getContext(); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); }
}
