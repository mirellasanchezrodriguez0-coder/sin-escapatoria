const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT) || 8787;
const HOST = "0.0.0.0";

const rooms = new Map();

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
  });

  res.end(body);
}

function text(
  res,
  status,
  body,
  type = "text/plain; charset=utf-8"
) {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(body);
}

function makeCode() {
  let code;

  do {
    code = crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase();
  } while (rooms.has(code));

  return code;
}

function cleanName(value, fallback) {
  const name = String(value || "").trim();

  return name
    ? name.slice(0, 40)
    : fallback;
}

function roomPublic(room) {
  return {
    code: room.code,

    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      profile: p.profile
    })),

    ready: room.players.length >= 2,

    createdAt: room.createdAt
  };
}

function parseBody(req) {
  return new Promise((resolve, reject) => {

    let raw = "";

    req.on("data", chunk => {

      raw += chunk;

      if (raw.length > 1024 * 1024) {
        req.destroy();
        reject(
          new Error("Body too large")
        );
      }

    });

    req.on("end", () => {

      if (!raw) {
        return resolve({});
      }

      try {

        resolve(
          JSON.parse(raw)
        );

      } catch {

        reject(
          new Error("Invalid JSON")
        );

      }

    });

    req.on("error", reject);

  });
}

function serveStatic(req, res, pathname) {

  let filePath;

  if (
    pathname === "/" ||
    pathname === ""
  ) {

    filePath =
      path.join(
        __dirname,
        "index.html"
      );

  } else {

    const safe =
      path
        .normalize(pathname)
        .replace(
          /^(\.\.[/\\])+/,
          ""
        );

    const rootFile =
      path.join(
        __dirname,
        safe
      );

    const webFile =
      path.join(
        __dirname,
        "web",
        safe
      );

    if (
      fs.existsSync(rootFile) &&
      fs.statSync(rootFile).isFile()
    ) {

      filePath = rootFile;

    } else if (
      fs.existsSync(webFile) &&
      fs.statSync(webFile).isFile()
    ) {

      filePath = webFile;

    }

  }

  if (
    !filePath ||
    !fs.existsSync(filePath)
  ) {

    return text(
      res,
      404,
      "Not found"
    );

  }

  const ext =
    path
      .extname(filePath)
      .toLowerCase();

  const types = {

    ".html":
      "text/html; charset=utf-8",

    ".js":
      "application/javascript; charset=utf-8",

    ".css":
      "text/css; charset=utf-8",

    ".json":
      "application/json; charset=utf-8",

    ".png":
      "image/png",

    ".jpg":
      "image/jpeg",

        ".jpeg":
      "image/jpeg",

    ".svg":
      "image/svg+xml",

    ".webp":
      "image/webp",

    ".ico":
      "image/x-icon"

  };

  res.writeHead(200, {

    "Content-Type":
      types[ext] ||
      "application/octet-stream",

    "Cache-Control":
      "no-cache"

  });

  fs
    .createReadStream(filePath)
    .pipe(res);
}

const server =
  http.createServer(
    async (req, res) => {

      if (
        req.method === "OPTIONS"
      ) {

        res.writeHead(204, {

          "Access-Control-Allow-Origin":
            "*",

          "Access-Control-Allow-Headers":
            "Content-Type",

          "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS"

        });

        return res.end();
      }

      const url =
        new URL(
          req.url,
          `http://${req.headers.host || "localhost"}`
        );

      const pathname =
        url.pathname;


      /* SALUD DEL SERVIDOR */

      if (
        pathname === "/health" ||
        pathname === "/api/health"
      ) {

        return json(
          res,
          200,
          {
            ok: true,
            status: "online",
            service:
              "sin-escapatoria",
            port: PORT,
            rooms:
              rooms.size
          }
        );

      }


      /* CREAR SALA */

      if (
        req.method === "POST" &&
        [
          "/api/create-room",
          "/api/create",
          "/api/rooms"
        ].includes(pathname)
      ) {

        try {

          const body =
            await parseBody(req);

          const player = {

            id:
              crypto.randomUUID(),

            name:
              cleanName(
                body.name ||
                body.player ||
                body.profile,

                "Jugador 1"
              ),

            profile:
              cleanName(
                body.profile ||
                body.name ||
                body.player,

                "Mirella"
              )

          };

          const code =
            makeCode();

          const room = {

            code,

            players: [
              player
            ],

            createdAt:
              Date.now(),

            state: {},

            messages: []

          };

          rooms.set(
            code,
            room
          );

          return json(
            res,
            201,
            {

              ok: true,

              success: true,

              code,

              roomCode:
                code,

              room:
                roomPublic(room),

              player

            }
          );

        } catch (err) {

          return json(
            res,
            400,
            {

              ok: false,

              success: false,

              error:
                err.message

            }
          );

        }

      }

    /* UNIRSE A SALA */

      if (
        req.method === "POST" &&
        [
          "/api/join-room",
          "/api/join",
          "/api/rooms/join"
        ].includes(pathname)
      ) {

        try {

          const body =
            await parseBody(req);

          const code =
            String(
              body.code ||
              body.roomCode ||
              body.room ||
              body.codigo ||
              ""
            )
            .trim()
            .toUpperCase();

          if (!code) {

            return json(
              res,
              400,
              {

                ok: false,

                success: false,

                error:
                  "Falta el código de la sala."

              }
            );

          }

          const room =
            rooms.get(code);

          if (!room) {

            return json(
              res,
              404,
              {

                ok: false,

                success: false,

                error:
                  "La sala no existe o ha caducado."

              }
            );

          }

          if (
            room.players.length >= 2
          ) {

            return json(
              res,
              409,
              {

                ok: false,

                success: false,

                error:
                  "La sala ya tiene dos jugadores."

              }
            );

          }

          const player = {

            id:
              crypto.randomUUID(),

            name:
              cleanName(
                body.name ||
                body.player ||
                body.profile,

                "Jugador 2"
              ),

            profile:
              cleanName(
                body.profile ||
                body.name ||
                body.player,
                "Pedro"
              )

          };

          room.players.push(
            player
          );

          return json(
            res,
            200,
            {

              ok: true,

              success: true,

              code,

              roomCode:
                code,

              room:
                roomPublic(room),

              player

            }
          );

        } catch (err) {

          return json(
            res,
            400,
            {

              ok: false,

              success: false,

              error:
                err.message

            }
          );

        }

      }


      /* CONSULTAR SALA */

      const roomMatch =
        pathname.match(
          /^\/api\/(?:room|rooms)\/([^/]+)$/
        );

      if (
        req.method === "GET" &&
        roomMatch
      ) {

        const code =
          decodeURIComponent(
            roomMatch[1]
          )
          .trim()
          .toUpperCase();

        const room =
          rooms.get(code);

        if (!room) {

          return json(
            res,
            404,
            {

              ok: false,

              success: false,

              error:
                "La sala no existe o ha caducado."
              }
          );

        }

        return json(
          res,
          200,
          {

            ok: true,

            success: true,

            room:
              roomPublic(room),

            state:
              room.state

          }
        );

      }


      /* GUARDAR ESTADO */

      if (
        req.method === "POST" &&
        pathname.match(
          /^\/api\/(?:room|rooms)\/[^/]+\/state$/
        )
      ) {

        try {

          const parts =
            pathname.split("/");

          const code =
            decodeURIComponent(
              parts[3]
            )
            .trim()
            .toUpperCase();

          const room =
            rooms.get(code);

          if (!room) {

            return json(
              res,
              404,
              {

                ok: false,

                error:
                  "Sala no encontrada."

              }
            );

          }

          const body =
            await parseBody(req);

          room.state =
            body.state !== undefined
              ? body.state
              : body;

          return json(
            res,
            200,
            {

              ok: true,

              success: true,

              room:
                roomPublic(room),

              state:
                room.state

            }
          );

        } catch (err) {

          return json(
            res,
            400,
            {

              ok: false,

              success: false,

              error:
                err.message
                }
          );

        }

      }


      /* MENSAJES */

      if (
        req.method === "POST" &&
        pathname.match(
          /^\/api\/(?:room|rooms)\/[^/]+\/message$/
        )
      ) {

        try {

          const parts =
            pathname.split("/");

          const code =
            decodeURIComponent(
              parts[3]
            )
            .trim()
            .toUpperCase();

          const room =
            rooms.get(code);

          if (!room) {

            return json(
              res,
              404,
              {

                ok: false,

                error:
                  "Sala no encontrada."

              }
            );

          }

          const body =
            await parseBody(req);

          const message = {

            id:
              crypto.randomUUID(),

            from:
              body.from ||
              body.player ||
              null,

            text:
              String(
                body.text ||
                body.message ||
                ""
              ).slice(0, 2000),

            at:
              Date.now()

          };

          room.messages.push(
            message
          );

          room.messages =
            room.messages.slice(
              -100
            );

          return json(
            res,
            200,
            {

              ok: true,

              success: true,

              message

            }
          );

        } catch (err) {

          return json(
            res,
            400,
            {
              ok: false,

              success: false,

              error:
                err.message

            }
          );

        }

      }


      /* ESTADO */

      if (
        pathname === "/api/status" ||
        pathname === "/status"
      ) {

        return json(
          res,
          200,
          {

            ok: true,

            status: "online",

            service:
              "sin-escapatoria"

          }
        );

      }


      /* ARCHIVOS */

      return serveStatic(
        req,
        res,
        pathname
      );

    }
  );


/* LIMPIEZA DE SALAS */

setInterval(
  () => {

    const limit =
      Date.now() -
      6 * 60 * 60 * 1000;

    for (
      const [code, room]
      of rooms
    ) {

      if (
        room.createdAt <
        limit
      ) {

        rooms.delete(
          code
        );

      }

    }

  },

  30 * 60 * 1000

).unref();


/* INICIAR SERVIDOR */

server.listen(
  PORT,
  HOST,
  () => {
    console.log(
      `Sin Escapatoria server running on ${HOST}:${PORT}`
    );

  }
);


/* CIERRE */

process.on(
  "SIGTERM",
  () => {

    server.close(
      () =>
        process.exit(0)
    );

  }
);
