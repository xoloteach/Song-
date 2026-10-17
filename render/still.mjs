// Render selected timestamps of a page to PNG (for review). Usage:
// node render/still.mjs --page "video/index.html?x" --times 1,2.5 --out <dir> [--prefix f]
import puppeteer from '../tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { createServer } from './server.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
const A = {}; for (let i = 2; i < process.argv.length; i += 2) A[process.argv[i].slice(2)] = process.argv[i + 1];
const srv = createServer(); await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
const pg = await b.newPage(); await pg.setViewport({ width: 1920, height: 1080 });
pg.on('console', m => { const t = m.text(); if (!/404/.test(t)) console.log('console:', t); }); pg.on('pageerror', e => console.log('PAGE ERROR', e.message));
await pg.goto(`http://127.0.0.1:${srv.address().port}/${A.page}`); await pg.waitForFunction('window.ready===true', { timeout: 180000 });
mkdirSync(A.out, { recursive: true }); const cdp = await pg.createCDPSession();
for (const ts of A.times.split(',')) {
  const t = Number(ts); const t0 = Date.now();
  await pg.evaluate(async t => { await window.renderFrameAt(t); }, t);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true });
  const f = `${A.out}/${A.prefix || 'f'}_${t.toFixed(2).padStart(7, '0')}.png`; writeFileSync(f, Buffer.from(shot.data, 'base64'));
  console.log(f, Date.now() - t0, 'ms');
}
await b.close(); srv.close();
