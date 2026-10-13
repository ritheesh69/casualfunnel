// Tiny static server for the demo storefront. No dependencies.
//   node demo/serve.js        (default port 5500, override with DEMO_PORT)
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const port = Number(process.env.DEMO_PORT) || 5500;
const demoDir = __dirname;
const trackerFile = path.join(__dirname, '..', 'tracker', 'tracker.js');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function resolveFile(urlPath) {
  let pathname;
  try {
    pathname = decodeURIComponent(urlPath.split('?')[0]);
  } catch {
    return null;
  }
  if (pathname === '/') pathname = '/index.html';
  // The tracker lives outside the demo folder; expose it at /tracker.js.
  if (pathname === '/tracker.js') return trackerFile;
  const file = path.normalize(path.join(demoDir, pathname));
  if (!file.startsWith(demoDir + path.sep) || path.basename(file) === 'serve.js') return null;
  return file;
}

http
  .createServer((req, res) => {
    const file = req.method === 'GET' || req.method === 'HEAD' ? resolveFile(req.url) : null;
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('Not found');
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  })
  .listen(port, () => {
    console.log(`Demo storefront: http://localhost:${port}`);
  });
