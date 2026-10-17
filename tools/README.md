# TOOLS — Motion Graphics / Music Video Agent Toolkit

**All project material stays inside this folder or its parent project.** This kit supplies working browser scenes, a local server, a programmable Chrome renderer, an optional Blender scene/runner, and FFmpeg video+audio integration.

## Included tools

| Tool | Files / requirements | Use |
|---|---|---|
| Three.js 3D | `demos/three_scene.html`, npm package `three` | Real-time WebGL 3D |
| Canvas 2D | `demos/canvas2d.html` | 2D raster animation, kinetic typography |
| SVG | `demos/svg_animation.html`, `svg/star.svg` | Vector shapes, strokes, curves |
| Anime.js | `demos/anime_animation.html`, npm package `animejs` | Declarative DOM/SVG motion |
| Blender Runner | `scripts/blender_runner.py`, `blender/scene.py` | Optional background 3D renders |
| Python | `scripts/blender_runner.py`, `scripts/verify.py` | Render launch and media verification |
| Node.js | `scripts/serve.mjs`, `scripts/render.mjs` | Local web server, automated frame rendering |
| FFmpeg/ffprobe | auto-detected system executables | H.264 encoding and audio muxing |
| Chrome/Chromium | auto-detected browser | Offscreen HTML frame rendering |
| Blender | auto-detected `blender` system command | Optional 3D offline render |

**Important:** Native Blender, Python, Node, FFmpeg, and Chrome executables are NOT included. They must already be installed on the machine. Three.js/Anime.js/Puppeteer are specified in `package.json` and installed into `node_modules/` by `npm install` with internet access. `Canvas 2D` and `SVG` are built into browsers. No copyrighted footage or artwork is included. Chromium may not be available in Android Chrome/Termux directly; this renderer is meant for a PC/server environment.

## Quick start (PC/cloudshell with Chrome/Chromium, Node 20+, FFmpeg)

From the `tools/` folder:

```bash
npm install
npm run check
npm start
```

Visit http://127.0.0.1:4173/ and open a demo. Press `Ctrl+C` to stop the server.

### Render motion graphics into a music video

With an existing song in the parent `song/` folder:

```bash
node scripts/render.mjs --scene demos/canvas2d.html --audio ../song/passage.mp3 --output ../final/music-video.mp4 --fps 30 --width 1920 --height 1080
```

The renderer determines duration from the source audio, renders deterministic frames by calling `window.renderFrameAt(seconds)`, and muxes source audio into the final MP4. This uses **AAC encoding** for compatibility; it does not change musical content, but it is **not bit-for-bit identical audio**. Do not claim the encoded AAC bytes are unchanged. To preserve an MP3 stream bit-for-bit instead, one can separately remux it with `-c:a copy` where the player/container supports it.

Without source audio, give `--duration 3` (seconds). Rendering 2,375 frames may take minutes to hours depending on hardware and complexity; expect this on a local machine, not a lightweight browser tablet.

For a specific scene:

```bash
node scripts/render.mjs --scene demos/three_scene.html --audio ../song/passage.mp3 --output ../final/three.mp4
node scripts/render.mjs --scene demos/svg_animation.html --duration 3 --output ../final/svg.mp4
node scripts/render.mjs --scene demos/anime_animation.html --duration 3 --output ../final/anime.mp4
```

For Blender (separate system installation):

```bash
python3 scripts/blender_runner.py --output ../final/blender-frame.png --frame 48
```

To verify duration and streams:

```bash
python3 scripts/verify.py ../final/music-video.mp4 --audio ../song/passage.mp3
```

## Agent instructions: read this before making a music video

1. Read `song/README.md`, `song/analysis.json`, and `song/storyboard.json` when present. Treat their beat and lyric confidence honestly; don't invent meaning.
2. Use the entire source song and synchronize important changes to analysis timestamps. Create a unique story or choreography with recognizable motifs and visual progress, not hundreds of disconnected random shots.
3. Build any scene in HTML Canvas 2D, SVG, Anime.js, or Three.js. Each browser scene MUST implement `window.renderFrameAt(timeSeconds)` to make deterministic frame extraction possible. Frame 0 and frame N must depend only on time + explicit assets/analysis; avoid wall-clock animations when rendering.
4. Optional Blender renders use `blender/scene.py` or a newly built Blender scene. Chrome and FFmpeg are the default renderer on machines with them installed.
5. Save one finished `final/music-video.mp4` at 1920×1080, 30fps, H.264/yuv420p with AAC, full song length. Preserve the song's timing and musical content. Do not use fake footage or externally downloaded assets unless permission is given.
6. Validate with `scripts/verify.py`, watch a playback sample or decode the whole video with FFmpeg, and write a `report.md` documenting concept, tools, actual tests, and limitations.
7. Every path and tool requirement must be checked (`npm run check`) before beginning rendering; if unavailable, use a documented supported fallback.

## Individual files

- `index.html` – local tool dashboard
- `demos/canvas2d.html` – no-dependency synchronized 2D animation
- `demos/svg_animation.html` – no-dependency vector animation
- `demos/three_scene.html` – Three.js 3D demonstration
- `demos/anime_animation.html` – Anime.js demonstration
- `scripts/check.mjs` – installation check
- `scripts/serve.mjs` – static localhost file server
- `scripts/render.mjs` – Puppeteer/Chrome frame renderer + FFmpeg video/audio encoder
- `scripts/verify.py` – ffprobe duration and codec verification
- `scripts/blender_runner.py`, `blender/scene.py` – optional Blender headless scene

### Dependencies and licenses

The package does not ship third-party binaries or library source files. NPM install downloads libraries to `node_modules/` with their own licenses; consult each `node_modules/<package>/LICENSE` and keep license notices if redistributing. The original examples, helpers, and assets in this folder are released into the public domain under CC0 (see `licenses/EXAMPLES-CC0.txt`).
