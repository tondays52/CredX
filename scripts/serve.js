const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

function serveFile(res, targetPath) {
  const ext = path.extname(targetPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(targetPath).pipe(res);
}

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // Route root and aliases
  if (reqPath === '/' || reqPath === '' || reqPath === '/landing') {
    return serveFile(res, path.join(PUBLIC_DIR, 'landing.html'));
  }
  if (reqPath === '/app' || reqPath === '/dashboard') {
    return serveFile(res, path.join(PUBLIC_DIR, 'index.html'));
  }
  if (reqPath === '/arena') {
    return serveFile(res, path.join(PUBLIC_DIR, 'arena.html'));
  }

  let filePath = path.join(PUBLIC_DIR, reqPath);
  
  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (!err && stats.isFile()) {
      return serveFile(res, filePath);
    }

    if (!err && stats.isDirectory()) {
      const indexSub = path.join(filePath, 'landing.html');
      if (fs.existsSync(indexSub)) {
        return serveFile(res, indexSub);
      }
    }

    // Try appending .html (e.g. /landing -> /landing.html, /index -> /index.html)
    const htmlFallback = filePath + '.html';
    if (fs.existsSync(htmlFallback) && fs.statSync(htmlFallback).isFile()) {
      return serveFile(res, htmlFallback);
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('404 Not Found');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`CredX Server running at: http://localhost:${PORT}`);
  console.log(`  - Landing Page: http://localhost:${PORT}/ (or /landing)`);
  console.log(`  - Protocol Terminal App: http://localhost:${PORT}/app (or /index.html)`);
  console.log(`  - PredictBay Arena: http://localhost:${PORT}/arena`);
});
