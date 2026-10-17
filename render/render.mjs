#!/usr/bin/env node
// Production renderer: deterministic frames [start, end) of video/index.html -> lossless-ish H.264 segment.
// node render/render.mjs --start 0 --end 4905 --out render/segments/seg_000.mp4 [--fps 30] [--q msaa=4]
import puppeteer from '../tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { createServer } from './server.mjs';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].slice(2)] = process.argv[i + 1];
const fps = Number(A.fps || 30);
// --ranges "0-300,300-600" --dir render/segments  (one browser session, one segment file per range)
const ranges = A.ranges ? A.ranges.split(',').map(r => r.split('-').map(Number)) : [[Number(A.start), Number(A.end)]];
const segName = (a) => A.dir ? `${A.dir}/seg_${String(a).padStart(5, '0')}.mp4` : A.out;
mkdirSync(A.dir || dirname(A.out), { recursive: true });
const srv = createServer(); await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const browser = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true, protocolTimeout: 600000,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const pg = await browser.newPage(); await pg.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
let errors = 0; pg.on('pageerror', e => { errors++; console.error('PAGE ERROR', e.message); }); pg.on('console', m => { if (m.type() === 'error' && !/404/.test(m.text())) { errors++; console.error('console.error:', m.text()); } });
await pg.goto(`http://127.0.0.1:${srv.address().port}/video/index.html?${A.q || ''}`); await pg.waitForFunction('window.ready===true', { timeout: 600000 });
const cdp = await pg.createCDPSession();
for (const [start, end] of ranges) { const out = segName(start);
const ff = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
  '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '10', '-pix_fmt', 'yuv444p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
const t0 = Date.now(); const log = [];
for (let f = start; f < end; f++) {
  const t = f / fps;
  await pg.evaluate(async t => { await window.renderFrameAt(t); }, t);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  const buf = Buffer.from(shot.data, 'base64');
  if (!ff.stdin.write(buf)) await new Promise(ok => ff.stdin.once('drain', ok));
  if ((f - start) % 30 === 0) { const el = (Date.now() - t0) / 1000, done = f - start + 1; console.log(`[${out}] frame ${f} (${done}/${end - start}) ${(el / done).toFixed(2)} s/f, eta ${((end - f) * el / done / 60).toFixed(1)} min`); }
}
ff.stdin.end(); await new Promise((ok, bad) => ff.once('close', c => c === 0 ? ok() : bad(Error('ffmpeg ' + c))));
writeFileSync(out + '.done.json', JSON.stringify({ start, end, errors, seconds: (Date.now() - t0) / 1000 }));
console.log('DONE', out, 'errors', errors, 'time', ((Date.now() - t0) / 1000).toFixed(0), 's');
}
await browser.close(); srv.close();
