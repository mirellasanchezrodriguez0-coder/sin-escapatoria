const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const ROOM_TTL = 2 * 60 * 60 * 1000;
const rooms = new Map();

function loadCards() {
  try {
    const raw = JSON.parse(
      fs.readFileSync(path.join(ROOT, "cards.json"), "utf8")
    );

    return Array.isArray(raw)
      ? raw
      : (Array.isArray(raw.cards) ? raw.cards : []);
  } catch (err) {
    console.error("No se pudo cargar cards.json:", err.message);
    return [];
  }
}

const cards = loadCards();

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
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
    "Cache-Control": "no-store"
  });

  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 100000) {
        req.destroy();
        reject(new Error("Payload demasiado grande"));
      }
    });

    req.on("end", () => {
      if (!body) {
        return resolve({});
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}

function makeCode() {
const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code;

  do {
    code = "";

    for (let i = 0; i < 6; i++) {
      code += chars[crypto.randomInt(chars.length)];
    }
  } while (rooms.has(code));

  return code;
}

function makeToken() {
  return crypto.randomBytes(18).toString("hex");
}

function cleanName(value, fallback) {
  const name = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);

  return name || fallback;
}

function makeInitialState() {
  return {
    round: 0,
    started: false,
    answers: {},
    scores: {
      A: 0,
      B: 0
    },
    rolls: 0,
    intensity: 1,
    drinks: 0,
    matches: 0,
    moments: []
  };
}

function makeRoom() {
  const code = makeCode();

  const room = {
    code,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: {},
    state: makeInitialState()
  };

  rooms.set(code, room);

  return room;
}

function getRoom(code) {
  const room = rooms.get(
    String(code || "").toUpperCase()
  );

  if (!room) {
    return null;
  }

  room.updatedAt = Date.now();

  return room;
}

function playerSlot(room, token) {
  for (const slot of ["A", "B"]) {
    if (room.players[slot]?.token === token) {
      return slot;
    }
  }

  return null;
}

function publicRoom(room) {
  return {
    code: room.code,

    players: Object.entries(room.players).map(
      ([slot, player]) => ({
        id: player.token,
        slot,
        name: player.name,
        profile: slot
      })
    )
  };
}

function stateResponse(room, token) {
  const slot = playerSlot(room, token);

  if (!slot) {
    return {
      ok: false,
      error: "Jugador no válido."
    };
  }

  return {
    ok: true,
    room: publicRoom(room),
    state: room.state
  };
}

function updateState(room, state) {
  if (
    !state ||
    typeof state !== "object" ||
    Array.isArray(state)
  ) {
    return {
      ok: false,
      error: "Estado no válido."
    };
  }

  room.state = {
 ...makeInitialState(),
    ...room.state,
    ...state,

    scores: {
      A: Number(
        state.scores?.A ??
        room.state.scores?.A ??
        0
      ),

      B: Number(
        state.scores?.B ??
        room.state.scores?.B ??
        0
      )
    },

    answers:
      state.answers &&
      typeof state.answers === "object"
        ? state.answers
        : {},

    moments:
      Array.isArray(state.moments)
        ? state.moments
        : []
  };

  room.updatedAt = Date.now();

  return {
    ok: true,
    state: room.state
  };
}

function serveStatic(req, res, pathname) {
  const requested =
    pathname === "/"
      ? "/index.html"
      : pathname;

  const filePath = path.resolve(
    ROOT,
    "." + requested
  );

  if (
    !filePath.startsWith(ROOT + path.sep) &&
    filePath !== ROOT
  ) {
    return text(res, 403, "Forbidden");
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      if (
        pathname === "/" ||
        !path.extname(pathname)
      ) {
        return fs.readFile(
          path.join(ROOT, "index.html"),
          (e, data) => {
            if (e) {
              return text(res, 404, "Not found");
            }

            text(
              res,
              200,
              data,
              "text/html; charset=utf-8"
            );
          }
        );
      }

      return text(res, 404, "Not found");
    }

    const ext = path
      .extname(filePath)
      .toLowerCase();

    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".ico": "image/x-icon",
      ".webmanifest":
        "application/manifest+json; charset=utf-8"
    };

    res.writeHead(200, {
      "Content-Type":
        types[ext] ||
        "application/octet-stream",

      "Cache-Control": "no-cache"
    });

    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(
  async (req, res) => {
    try {
      const url = new URL(
        req.url,
        `http://${req.headers.host || "localhost"}`
      );

      const pathname = decodeURIComponent(
        url.pathname
      );

      const method = req.method || "GET";

      if (method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Headers":
            "Content-Type",
          "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS"
        });

        return res.end();
      }

      /*
       * HEALTH CHECK
       */

      if (
        pathname === "/health" ||
        pathname === "/api/health"
      ) {
        return json(res, 200, {
          ok: true,
          status: "online",
          service: "sin-escapatoria",
          port: PORT,
          rooms: rooms.size,
          cards: cards.length
        });
      }

      /*
     * CARTAS
       */

      if (
        method === "GET" &&
        (
          pathname === "/cards.json" ||
          pathname === "/cards-data.json"
        )
      ) {
        return json(res, 200, {
          cards
        });
      }

      /*
       * CREAR SALA
       */

      if (
        method === "POST" &&
        pathname === "/api/create-room"
      ) {
        const body = await parseBody(req);

        const requested =
          String(body.profile || "A")
            .toUpperCase() === "B"
            ? "B"
            : "A";

        const room = makeRoom();

        room.players[requested] = {
          token: makeToken(),

          name: cleanName(
            body.name,
            requested === "A"
              ? "Jugador 1"
              : "Jugador 2"
          )
        };

        room.updatedAt = Date.now();

        return json(res, 200, {
          ok: true,
          code: room.code,

          player: {
            id: room.players[requested].token
          },

          room: publicRoom(room)
        });
      }

      /*
       * UNIRSE A SALA
       */

      if (
        method === "POST" &&
        pathname === "/api/join-room"
      ) {
        const body = await parseBody(req);

        const code = String(
          body.code || ""
        )
          .trim()
          .toUpperCase();

        if (!/^[A-Z0-9]{6}$/.test(code)) {
          return json(res, 400, {
            ok: false,
            error:
              "El código debe tener 6 caracteres."
          });
        }

        const room = getRoom(code);

        if (!room) {
          return json(res, 404, {
            ok: false,
            error:
              "La sala no existe o ha caducado."
          });
        }

        if (
          room.players.A &&
          room.players.B
        ) {
          return json(res, 409, {
            ok: false,
            error:
              "La sala ya tiene dos jugadores."
          });
        }

        const slot =
          room.players.A
            ? "B"
            : "A";

        room.players[slot] = {
          token: makeToken(),

          name: cleanName(
            body.name,
            slot === "A"
              ? "Jugador 1"
              : "Jugador 2"
          )
        };

        room.updatedAt = Date.now();

        return json(res, 200, {
          ok: true,
          code: room.code,

          player: {
            id: room.players[slot].token
          },

          room: publicRoom(room)
        });
      }

      /*
       * LEER SALA
       */

      const roomMatch =
        pathname.match(
          /^\/api\/room\/([^/]+)$/
        );

      if (
        method === "GET" &&
        roomMatch
      ) {
        const room =
          getRoom(roomMatch[1]);

        if (!room) {
          return json(res, 404, {
            ok: false,
            error:
              "La sala no existe o ha caducado."
          });
        }

        const token =
          url.searchParams.get("player");

        if (token) {
          return json(
            res,
            200,
            stateResponse(
              room,
              token
            )
          );
        }

        return json(res, 200, {
          ok: true,
          room: publicRoom(room),
          state: room.state
        });
      }

      /*
 * ACTUALIZAR ESTADO
       */

      const stateMatch =
        pathname.match(
          /^\/api\/room\/([^/]+)\/state$/
        );

      if (
        method === "POST" &&
        stateMatch
      ) {
        const room =
          getRoom(stateMatch[1]);

        if (!room) {
          return json(res, 404, {
            ok: false,
            error:
              "La sala no existe o ha caducado."
          });
        }

        const body =
          await parseBody(req);

        return json(
          res,
          200,
          updateState(
            room,
            body.state
          )
        );
      }

      /*
       * ENDPOINT ANTIGUO:
       * CREAR SALA
       */

      if (
        method === "POST" &&
        pathname === "/room"
      ) {
        const body =
          await parseBody(req);

        const room = makeRoom();

        room.players.A = {
          token: makeToken(),

          name: cleanName(
            body.name,
            "Jugador 1"
          )
        };

        room.state = {
          ...makeInitialState(),
          round: 0,
          started: false
        };

        return json(res, 200, {
          ok: true,
          code: room.code,
          player:
            room.players.A.token
        });
      }

      /*
       * ENDPOINT ANTIGUO:
       * UNIRSE
       */

      const legacyJoin =
        pathname.match(
          /^\/join\/([^/]+)$/
        );

      if (
        method === "POST" &&
        legacyJoin
      ) {
        const room =
          getRoom(legacyJoin[1]);

        if (!room) {
          return json(res, 404, {
            ok: false,
            error:
              "Sala no encontrada."
          });
        }

        if (
          room.players.A &&
          room.players.B
        ) {
          return json(res, 409, {
            ok: false,
            error:
              "La sala ya tiene dos jugadores."
          });
        }

        const body =
          await parseBody(req);

        room.players.B = {
          token: makeToken(),

          name: cleanName(
            body.name,
            "Jugador 2"
          )
        };

        return json(res, 200, {
          ok: true,
          code: room.code,
          player:
            room.players.B.token
        });
      }

      /*
       * ARCHIVOS ESTÁTICOS
       */

      return serveStatic(
        req,
        res,
        pathname
      );

    } catch (err) {
      console.error(err);

      return json(res, 500, {
        ok: false,
        error:
           "Error interno del servidor."
      });
    }
  }
);

/*
 * LIMPIEZA DE SALAS ANTIGUAS
 */

setInterval(() => {
  const now = Date.now();

  for (const [code, room] of rooms) {
    if (
      now - room.updatedAt >
      ROOM_TTL
    ) {
      rooms.delete(code);
    }
  }
}, 10 * 60 * 1000).unref();

/*
 * INICIAR SERVIDOR
 */

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Sin Escapatoria escuchando en el puerto ${PORT}`
    );

    console.log(
      `Cartas cargadas: ${cards.length}`
    );
  }
);
