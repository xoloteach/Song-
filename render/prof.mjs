import puppeteer from '../tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
import { createServer } from './server.mjs';
const srv = createServer(); await new Promise(ok => srv.listen(0, '127.0.0.1', ok));
const b = await puppeteer.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage(); await pg.setViewport({ width: 1920, height: 1080 }); pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://127.0.0.1:${srv.address().port}/${process.argv[2]}`); await pg.waitForFunction('window.ready===true', { timeout: 180000 });
const t = Number(process.argv[3] || 11);
for (let k = 0; k < 3; k++) { const t0 = Date.now(); await pg.evaluate(async t => { await window.renderFrameAt(t); }, t + k / 30); console.log('frame', Date.now() - t0, 'ms'); }
await b.close(); srv.close();
