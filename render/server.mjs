// Static file server rooted at the project folder (so pages can import ../tools/node_modules).
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
export const root = resolve(fileURLToPath(new URL('../', import.meta.url)));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.glb': 'model/gltf-binary', '.ttf': 'font/ttf', '.otf': 'font/otf', '.bin': 'application/octet-stream' };
export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let full = resolve(root, '.' + p);
      if (full !== root && !full.startsWith(root + sep)) { res.writeHead(403); return res.end(); }
      if ((await stat(full)).isDirectory()) full = resolve(full, 'index.html');
      const data = await readFile(full);
      res.writeHead(200, { 'Content-Type': types[extname(full)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch { res.writeHead(404); res.end('nf'); }
  });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4180);
  createServer().listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/video/`));
}
