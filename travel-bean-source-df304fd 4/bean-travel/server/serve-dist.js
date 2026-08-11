const fs = require("fs");
const http = require("http");
const path = require("path");

const distRoot = path.resolve(__dirname, "..", "dist");
const indexPath = path.join(distRoot, "index.html");
const port = Number(process.env.PORT || 8091);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    "content-type": mimeTypes[ext] || "application/octet-stream",
  });
  fs.createReadStream(filePath).pipe(res);
}

function fileForRequest(urlPath) {
  const decodedPath = decodeURIComponent(urlPath.split("?")[0] || "/");
  const safePath = path.normalize(decodedPath).replace(/^(\.\.(\/|\\|$))+/, "");
  const filePath = path.join(distRoot, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(distRoot)) {
    return null;
  }

  return filePath;
}

http
  .createServer((req, res) => {
    const filePath = fileForRequest(req.url || "/");

    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendFile(res, filePath);
      return;
    }

    const looksLikeAsset = path.extname(filePath).length > 0;
    if (looksLikeAsset) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    sendFile(res, indexPath);
  })
  .listen(port, "0.0.0.0", () => {
    console.log(`Serving Travel Bean dist preview on http://127.0.0.1:${port}/`);
  });
