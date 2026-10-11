// Local static server for e2e tests: serves the Vercel output directory and
// applies the same response headers declared in vercel.json.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(fileURLToPath(new URL('..', import.meta.url)));
const vercel = JSON.parse(await readFile(join(ROOT_DIR, 'vercel.json'), 'utf8'));
const PUBLIC_DIR = resolve(ROOT_DIR, vercel.outputDirectory ?? 'public');
const PORT = Number(process.env.PORT ?? 3000);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

// vercel.json `source` patterns used here are path prefixes followed by "(.*)".
const headerRules = (vercel.headers ?? []).map((rule) => ({
  pattern: new RegExp('^' + rule.source.replace(/[.+?^${}|[\]\\]/g, '\\$&').replace(/\\?\(\.\*\)/g, '(.*)') + '$'),
  headers: rule.headers,
}));

function headersFor(pathname) {
  const out = {};
  for (const rule of headerRules) {
    if (rule.pattern.test(pathname)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

async function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null; // malformed %-escape: treat as not found
  }
  const relative = normalize(decoded).replace(/^([/\\])+/, '');
  let file = resolve(PUBLIC_DIR, relative);
  if (file !== PUBLIC_DIR && !file.startsWith(PUBLIC_DIR + sep)) return null;
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    await stat(file);
    return file;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  const headers = headersFor(pathname);
  const file = await resolveFile(pathname);
  if (!file) {
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  let body;
  try {
    body = await readFile(file);
  } catch (err) {
    console.error(`[serve] cannot read ${file}:`, err.message);
    res.writeHead(500, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal server error');
    return;
  }
  res.writeHead(200, { ...headers, 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  res.end(req.method === 'HEAD' ? undefined : body);
}).listen(PORT, '127.0.0.1', () => {
  console.log(`Serving ${PUBLIC_DIR} on http://127.0.0.1:${PORT}`);
});
