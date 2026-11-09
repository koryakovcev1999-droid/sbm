import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const port = Number(process.env.SBM_PREVIEW_PORT || process.env.PORT || 4173);
const host = process.env.SBM_PREVIEW_HOST || '127.0.0.1';
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.webm': 'video/webm', '.mp4': 'video/mp4', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };
createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403).end(); return; }
    const content = await readFile(file);
    const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes' };
    const range = req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, content.length - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), content.length - 1) : content.length - 1;
      if (start > end || start >= content.length) { res.writeHead(416, { 'Content-Range': `bytes */${content.length}` }).end(); return; }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${content.length}`, 'Content-Length': end - start + 1 });
      res.end(req.method === 'HEAD' ? undefined : content.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, { ...headers, 'Content-Length': content.length });
    if (req.method === 'HEAD') { res.end(); return; }
    res.end(content);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port, host, () => console.log(`Preview: http://${host}:${port}`));
