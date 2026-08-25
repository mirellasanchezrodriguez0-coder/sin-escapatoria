const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 10000;
const HOST = "0.0.0.0";

const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf"
};

function sendResponse(res, statusCode, contentType, content) {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Cache-Control": "no-cache"
  });

  res.end(content);
}

function serveFile(res, filePath) {
  fs.stat(filePath, (error, stats) => {
    if (error) {
      sendResponse(
        res,
        404,
        "text/plain; charset=utf-8",
        "Archivo no encontrado"
      );
      return;
    }

    if (stats.isDirectory()) {
      serveFile(res, path.join(filePath, "index.html"));
      return;
    }

    const extension = path.extname(filePath).toLowerCase();

    const contentType =
      MIME_TYPES[extension] || "application/octet-stream";

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        sendResponse(
          res,
          500,
          "text/plain; charset=utf-8",
          "Error al leer el archivo"
        );
        return;
      }

      res.writeHead(200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache"
      });

      res.end(data);
    });
  });
}

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = url.parse(req.url);

    let pathname = decodeURIComponent(
      parsedUrl.pathname || "/"
    );

    if (pathname === "/api/health") {
      sendResponse(
        res,
        200,
        "application/json; charset=utf-8",
        JSON.stringify({
          status: "ok",
          message: "Servidor funcionando",
          service: "sin-escapatoria"
        })
      );

      return;
    }

    if (pathname === "/") {
      pathname = "/index.html";
    }

    const requestedPath = path.normalize(
      path.join(ROOT, pathname)
    );

    if (!requestedPath.startsWith(ROOT)) {
      sendResponse(
        res,
        403,
        "text/plain; charset=utf-8",
        "Acceso denegado"
      );

      return;
    }

    serveFile(res, requestedPath);

  } catch (error) {
    console.error("Error:", error);

    sendResponse(
      res,
      500,
      "text/plain; charset=utf-8",
      "Error interno del servidor"
    );
  }
});

server.listen(PORT, HOST, () => {
  console.log("=================================");
  console.log("SIN ESCAPATORIA");
  console.log("Servidor iniciado correctamente");
  console.log(`Host: ${HOST}`);
  console.log(`Puerto: ${PORT}`);
  console.log("=================================");
});
