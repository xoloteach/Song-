# TEN — official animated music video · production report

**Song:** "Ten" — Anno Domini Beats (original MP3, 163.500 s container / 163.468 s decoded PCM, 44.1 kHz, 320 kbps)
**Deliverable:** `final/music-video.mp4` — 1920×1080, 30 fps constant, H.264 High / yuv420p, AAC from the original MP3, 163.5 s.

---

## 1. Concept — "From Zero to Ten"

*Ten* is about ambition, relentless work, self-made success, momentum and winning again and again. The film shows
this as **one night of work by one person, counted from 0 to 10.**

- **ZERO** is the hero. He's a faceless runner in a charcoal hoodie, with a glossy black mask and a single gold visor slit. His jersey
  number is the film's scoreboard: it reads **0** at the start and flips at every win until it reads **10** at sunrise.
- **The Echoes** are the self-made crew. Each win splits off a translucent glass "echo" of Zero, numbered 1–9, which
  keeps dancing beside him. Nobody joins him from outside: the crew is every version of himself that kept going.
  The echo tints move from cool cyan (I) through violet and rose to gold (IX), so the cast warms toward dawn.
- **Ten = X.** The artist is *Anno Domini* (Latin), so every win is also titled with a Roman numeral, I … X. The **X** is
  the motif that runs through the film:
  - the signature dance move (arms cross into an X, then burst into a full-body X)
  - the tally marks (each group of five is struck through by a diagonal)
  - the painted court lines (an X plus an O = 10)
  - searchlights that cross in the sky
  - brush-stroke X's in the 2D layer
  - the gold X at the end of the title card.
- **The night clock.** A clock in the HUD (and on a neon billboard) runs from **03:00 to 06:11**. Night grades into sunrise exactly at
  WIN X, so the colour grade carries the story: sodium-and-rain blue, then neon magenta, then blueprint blue, then midnight
  violet, then pre-dawn lavender, then gold.

### Story / structure (all times verified against the audio, see §4)

| Time | Act | Music (own analysis) | What happens |
|---|---|---|---|
| 0.0–5.8 | **Prologue — Zero Hour** | sparse intro, vocals, no 808 | On black paper an ink stopwatch draws itself, one tick per beat. The drawn **0** is a lens onto a rain-soaked rooftop. On the first impact (5.77 s) the ring blows open into 3D. |
| 5.8–23.9 | **I — The Grind** | groove without 808 | 3 a.m. rooftop: rain, one work lamp, a neon clock billboard. Zero shadow-boxes on the beat (jab/jab/cross/hook land on the beats). A kinetic REP counter and tally marks count every beat. Then feet in puddles, a crane reveal of the city, a visor close-up and a stopwatch build. **22.91 s, the 808 enters → WIN I**: jersey 0→1, X-hit, floor shockwave, and Echo I splits away. |
| 23.9–38.1 | **II — Momentum** | 808 groove | Side-scrolling rooftop sprint. 2D paper-cut skylines hang at real depths in 3D. Every take-off lands on a beat. **WIN II** comes mid-leap, under the moon. In the 2-bar 808 break (36.2–38.1 s) the jump turns into **bullet-time printed in ink** (0.25× time-warp, halftone comic rendering, brush X). |
| 38.1–67.7 | **III — The Crew** | full drop, 808 drops out every 8 beats | A neon court whose painted lines are an X and an O, with LED pylons showing live EQ and the round numeral. 8-beat phrases: 4 beats of groove (stomp, step-touch, chest pops, arm waves, running man, boxing callback), then a **2-beat FREEZE exactly where the 808 drops out**, then a transition move and a formation change (V, line, diamond, column, arc). Freezes alternate between an ink-halftone still and a **three-camera comic split** of the same frozen moment. **WIN III** on the landing; **WIN IV** at 53.4 s. |
| 67.7–84.6 | **IV-a — Blueprint** | steady 808 section | The world becomes a technical drawing. Zero sketches "X = 10", then the tower he drew **slams in one floor every 2¾ beats**. Each floor carries 2D dimension labels that are projected from the 3D model. A drafting title block, and red rubber stamps for **WIN V** and **WIN VI**. |
| 84.6–86.2 | morph | | The blueprint **fills into reality**: an ink wipe with a glowing seam rises up the frame. |
| 86.2–99.1 | **IV-b — Rise** | build; 808 returns 91.5 s; hit + 2-beat silence 97.2 s | The crew sprints up a spiral stair past giant gold **floor numerals** (Blender glyphs), with an altimeter HUD. The climb doubles in speed when the 808 returns. On the 97.2 s hit they reach the summit and freeze through the silence. |
| 99.1–129.6 | **V — Arena** | biggest drop, 8-beat 808 drop-outs | A stage on top of the tower: a bouncing crowd of 420, a rotating halo light rig, laser fans and floating screens. Eight dancers, then nine (**WIN VII**, **WIN VIII**). Formations include an **X formation**, best seen in the top-down camera. Freezes cycle through ink, comic panels and a strobing negative. The lights fade at the end. |
| 129.6–144.8 | **VI — Nine** | the 808 vanishes (quiet bridge) | Pre-dawn (Blender physical sky). **WIN IX** arrives quietly. The echoes dissolve into light. **Memories** drift past: polaroids that the film rendered of its own earlier scenes. Then the echoes return one per beat on pillars of light. The opening **stopwatch returns** and closes in on X. |
| 144.8–160.1 | **VII — Ten** | final drop | **Sunrise.** The Blender "10" monument rises behind the stage. A gold laurel and brush X mark **WIN X**, and the jersey reads 10. Ten dancers perform one choreography (X formation, V, line of ten) with gold halftone freezes and confetti. |
| 160.1–163.5 | **Outro** | music ends ≈160.7 s, then silence | The last pose **prints itself into ink** (3D→2D). It becomes the title card: **TEN / ANNO DOMINI BEATS / I II III … X**, then fades to black on the final frame. |

---

## 2. 2D + 3D techniques (one language, not separate sections)

**3D (Three.js r180, custom shaders)**
- **Lighting.** SwiftShader runs PBR at about 1.4 s/frame, so I wrote a lightweight cinematic shading model instead: a shared global rig of hemisphere,
  key and three point lights, Blinn specular, Fresnel rim, **Blender-path-traced matcap reflections**, emissive, noise
  dissolve with a glowing edge, and height fog.
- **Characters** are procedural "designer-toy" humanoids built from a bone hierarchy. They have FK arms and spine, and
  **analytic two-bone leg IK** so feet stay planted while hips bounce. The echoes use a glass/hologram shader with
  scan-lines and a dissolve for spawning. A blueprint variant uses a line/Fresnel shader.
- **Choreography** comes from a vocabulary of about 40 beat-locked moves and poses: boxing combos, grooves, step-touch, chest pop,
  travelling arm wave, running man, stomp, the X-hit signature, spins, run cycle, leaps, kneels, victory poses.
  Moves are keyframed in beats, so hits arrive on the transient with outExpo/outBack easing. They are cross-faded,
  canon-offset per dancer, and composed with formation curves.
- **Environments**
  - Procedural window-shader skyscrapers. The far city is **baked once into a cubemap** per scene: it barely parallaxes, and baking cut frame time by about 40%.
  - **Planar reflections** on wet floors, with oblique clipping and rain ripples.
  - Volumetric light cones, rain streaks, GPU particles, trail ribbons and lathe-built tiers.
  - An instanced crowd animated in the vertex shader on the beat.
- **Post-processing**
  - HDR layers with a mask-driven transition mix and dual-Kawase bloom.
  - ACES tone mapping, white balance, lift/gamma/gain, contrast and saturation.
  - Chromatic aberration kicked by the kick drum, vignette and grain.
  - An **ink/halftone print mode** (rotated halftone dots plus edge detection) that turns any 3D frame into a 2D print.

**2D (Canvas 2D, SVG path data, Anime.js 4.2.2)**
- Ink-brush strokes with deterministic wobble, tally marks, the stopwatch, brush X's, laurels (SVG `Path2D` leaves),
  halftone fields, speed lines, comic panels, rubber stamps and the drafting title block.
- **Anime.js timelines** (seeked every frame, never auto-played) choreograph the win cards: staggered Roman-numeral
  letters with outBack, rule draw-on, ring draw-on, caption.
- A persistent HUD: ROUND nn/10, a tally of wins and the night clock.

**Where 2D and 3D meet**
- A 2D ring is the **mask** that reveals the 3D world (prologue).
- 2D paper-cut skylines are **cards in 3D depth** with true parallax (Act II).
- **3D frames are printed into 2D halftone** for bullet-time, the freezes and the outro.
- 3D is split into **2D comic panels** (multi-camera scissor rendering).
- 2D annotations are **anchored to projected 3D geometry** (blueprint).
- 2D canvases are textures inside 3D: neon clock, LED pylons, screens, court markings, jersey numbers.
- A **2D ink wipe** turns a line-drawn 3D world into a lit 3D world (blueprint→rise).
- **Frames of the film itself** are re-used as 2D photographs inside the 3D world (memories).

**Blender 5.2.2 (bpy module, Cycles CPU)**, scripts in `blender/`:
- six path-traced **matcaps** (chrome-night, gold, obsidian, glass-echo, pearl-dawn, clay)
- beveled, extruded **digit glyphs 0–9 and "10"**, plus the **"10" monument** with a stepped plinth (GLB)
- three **physically based sky panoramas** (pre-dawn −3.5°, sunrise +2.2°, golden +9°) using the multiple-scattering sky model.

All geometry, textures and skies were generated locally. **No footage, stock art or downloaded assets were used.**

---

## 3. Tools & pipeline

| Stage | Tool |
|---|---|
| Audio analysis | Python 3.13 + librosa / numpy (`analysis/analyze.py`, `analysis/export_video_data.py`) |
| 3D assets | Blender 5.2.2 LTS as the `bpy` Python module (pip; no system Blender existed), Cycles CPU |
| Scene / animation | Three.js 0.180.0, Canvas 2D, SVG `Path2D`, Anime.js 4.2.2 (`video/`) |
| Rendering | Node 22 + puppeteer-core 24.22, Chromium 141 headless, WebGL2 on SwiftShader (no GPU) (`render/render.mjs`) |
| Encoding / muxing | FFmpeg 6.1.1, libx264 two-pass, AAC (`render/assemble.sh`) |
| Verification | ffprobe / ffmpeg filters + Python (`tools/scripts/verify.py`, `render/verify_final.py`) |

**Rendering process**
1. `video/index.html` exposes `window.renderFrameAt(t)`. Every frame is a pure function of `t` plus local assets: no
   wall clock, no simulation state, deterministic hashes. This is why frames can be rendered in any order or in separate runs.
2. `render/render.mjs` renders frame *f* at *t = f/30*, takes a PNG screenshot over CDP, and pipes it into FFmpeg. Each
   10-second segment becomes a near-lossless intermediate (x264 CRF 10, 4:4:4), so problem sections can be re-rendered on their own.
3. `render/assemble.sh` concatenates the segments, two-pass encodes H.264 High yuv420p at 30 fps CFR, and muxes AAC
   encoded from the untouched original MP3 (no trim, speed, pitch or gain change). The audio is re-encoded as AAC as
   required. It is therefore not bit-identical to the MP3, but the musical content is unchanged (see §4).
4. Performance: about 1.5–1.9 s per frame on 4 CPU cores. A full pass is 4,905 frames in about 2.5 h. Parallel browsers gave no gain because
   the job is CPU-bound.

---

## 4. Verification

### 4.1 Musical timing — supplied package vs. own analysis
The supplied package was treated as a reference only, and I checked the critical timings against the audio:
- **Tempo/grid.** A least-squares fit of the tracked beats gives **126.0 BPM, beat n at t = 0.0532 + 0.47619·n s**.
  This matches the package's 126 BPM, and the grid drifts by less than 20 ms over the song. Downbeats sit on n ≡ 0 (mod 4).
- **Downbeat phase differs from the package.** The package puts bar 1 at 1.451 s (beat 3). The 808 entries
  (22.90 s = beat 48, 38.15 s = beat 80, 99.10 s = beat 208, 144.83 s = beat 304) and the sub-bass drop-outs, which
  always fall on beats ≡ 4 mod 8, all sit on multiples of 4. So I used my own phase.
- **Structure used for the edit:** 808 enters 22.90 s · 2-bar break 36.27–38.13 s · 808 drop-outs every 8 beats in all
  drop sections · continuous-808 section 67.7–85.8 s · hit + silence 97.2–99.1 s · no 808 at all 129.6–144.8 s · audio
  ends ≈160.7 s, then silence (it falls below −50 dBFS after 160.67 s).
- **Decoder alignment.** I cross-correlated the librosa decode used for analysis with FFmpeg's decode: **0 samples offset**.
- **Lyrics.** No lyric source exists (the package reports `unverified_no_lyrics_source`). The audio clearly has vocal
  content, but **I did not transcribe or invent lyrics**. On-screen words are design and typography only: title,
  artist, Roman numerals, ROUND/REPS/clock, drafting labels and similar. None of it is presented as lyrics.

### 4.2 Final file
Both scripts were run on the final file: `tools/scripts/verify.py` (toolkit) and `render/verify_final.py` (extended). Overall result: **PASS**.

| Check | Result |
|---|---|
| Container / codec | MP4, **H.264 High**, **yuv420p**; audio **AAC-LC 44.1 kHz stereo, 256 kbps** |
| Resolution | **1920×1080** (16:9) |
| Frame rate | **30/1 constant**. All 4,905 frame timestamps are spaced 0.033333–0.033334 s |
| Frame count | **4,905 frames decoded** = 163.5 s × 30 |
| Duration | video **163.500 s**; source MP3 container 163.500 s (delta 0.000 s); AAC stream 163.468 s (the true decoded PCM length) |
| Full decode | **no errors** (`ffmpeg -f null`) |
| Frozen picture | **no freezes ≥ 1 s** (`freezedetect`, n = 0.0015) |
| Black frames | only 0–0.47 s and 1.2–1.6 s. These are the intended ink-on-black opening, before the stopwatch ring reveals the rooftop |
| Audio sync | **0.0 ms offset** against the source decode (cross-correlation at 30–38 s) |
| Audio level | integrated loudness **−8.9 LUFS** source vs **−9.3 LUFS** final; RMS ratio 0.958. This is AAC encoding loss/limiting on a master that peaks at +0.4 dBTP. No gain, speed, pitch or edit changes were applied |
| Render integrity | 17 segments, **0 page/console errors**. Each segment is a pure `renderFrameAt(t)` evaluation |
| File size | 93.7 MB (about 4.3 Mbps video, two-pass) |

**Visual review.** During development I looked at contact sheets of ~60 stills across every act, which drove the
fixes: city scale, rim-light bug, reflections, window bloom, summit staging, sky stars, flash levels, title timing.
I also reviewed 10 s, 20 s and 110 s preview encodes of the final-quality segments.

---

## 5. Remaining uncertainties and honest limitations
- **Not watched in real time with sound by me.** I can inspect stills, contact sheets and measured data, but I cannot watch
  the playing video or listen to it. Sync is verified numerically (beat grid, 0 ms audio offset, cuts and hits placed on
  analysed beats), not by viewing it as a human would.
- **Not every final frame was reviewed visually.** I reviewed sampled stills (about 1 per 2–3 s), not all 4,905 frames.
  Short glitches between samples are possible: a limb intersecting a body during a blend, a pose pop where a move switches
  between IK and FK legs, or an echo dissolving a beat early or late.
- **Lyrics.** The song has vocals, but there was no lyric source, so the video uses no lyrics. Typography is design-only.
- **Downbeat phase** differs from the supplied package (§4.1). My choice is based on where the 808 enters and drops out. It is a
  judgement call, at 81% / 72% confidence in the package's own terms.
- **Audio is AAC, not the original MP3 bytes.** It was re-encoded as the spec requires. Measured loudness is 0.4 LU lower than the source.
- **Compression.** The file was kept under ~95 MB so it fits in GitHub, at 4.3 Mbps for 1080p30. Busy halftone or rain frames can
  show some x264 softening. The near-lossless 4:4:4 segments can be re-encoded at a higher bitrate (`VB=12M render/assemble.sh`).
- **Character design is stylised and procedural** (segmented "designer-toy" figures, no hand-sculpted meshes or skinning),
  because no external assets were allowed and there is no GPU. The hands are mitts without fingers.
- **Live web player** (GitHub Pages, `video/player.html`) uses the same code in real time on the viewer's GPU. Its frame rate
  depends on the device, and its recordings are real-time captures, not frame-exact. **The MP4 is the reference deliverable.**
