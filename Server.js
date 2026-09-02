const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;

const rooms = new Map();
const ROOM_TTL = 2 * 60 * 60 * 1000;

/* =========================================================
   CARGAR TARJETAS
   ========================================================= */

function loadCards() {
  const possibleFiles = [
    "tarjetas.json",
    "datos-tarjetas.json",
    "cards.json",
    "cards-data.json"
  ];

  for (const file of possibleFiles) {
    try {
      const filePath = path.join(ROOT, file);

      if (!fs.existsSync(filePath)) {
        continue;
      }

      const raw = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(raw);

      if (Array.isArray(data)) {
        console.log(`Tarjetas cargadas desde ${file}: ${data.length}`);
        return data;
      }

      if (data && Array.isArray(data.cards)) {
        console.log(`Tarjetas cargadas desde ${file}: ${data.cards.length}`);
        return data.cards;
      }

      if (data && Array.isArray(data.tarjetas)) {
        console.log(`Tarjetas cargadas desde ${file}: ${data.tarjetas.length}`);
        return data.tarjetas;
      }

    } catch (error) {
      console.error(`Error leyendo ${file}:`, error.message);
    }
  }

  console.error("NO SE ENCONTRARON LAS TARJETAS.");

  return [];
}

const cards = loadCards();

/* =========================================================
   RESPUESTAS
   ========================================================= */

function json(res, status, data) {
  const body = JSON.stringify(data);

  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });

  res.end(body);
}

function text(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store"
  });

  res.end(body);
}

/* =========================================================
   LEER BODY
   ========================================================= */

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";

    req.on("data", chunk => {
      body += chunk;

      if (body.length > 100000) {
        reject(new Error("Datos demasiado grandes"));
        req.destroy();
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        resolve({});
      }
    });

    req.on("error", reject);
  });
}

/* =========================================================
   CÓDIGOS Y JUGADORES
   ========================================================= */

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
  return crypto.randomBytes(20).toString("hex");
}

function cleanName(value, fallback) {
  const name = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 40);

  return name || fallback;
}

/* =========================================================
   ESTADO INICIAL
   ========================================================= */

function initialState() {
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

/* =========================================================
   SALAS
   ========================================================= */

function createRoom() {
  const code = makeCode();

  const room = {
    code,
    createdAt: Date.now(),
    updatedAt: Date.now(),

    players: {},

    state: initialState()
  };

  rooms.set(code, room);

  return room;
}

function findRoom(code) {
  if (!code) {
    return null;
  }

  const room = rooms.get(
    String(code).trim().toUpperCase()
  );

  if (!room) {
    return null;
  }

  room.updatedAt = Date.now();

    return room;
}

/* =========================================================
   SALA PÚBLICA
   ========================================================= */

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

/* =========================================================
   BUSCAR JUGADOR
   ========================================================= */

function playerSlot(room, token) {
  if (!token) {
    return null;
  }

  for (const slot of ["A", "B"]) {
    if (
      room.players[slot] &&
      room.players[slot].token === token
    ) {
      return slot;
    }
  }

  return null;
}

/* =========================================================
   ESTADO DE SALA
   ========================================================= */

function roomStateResponse(room, token) {
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

    state: room.state,

    player: {
      id: token,
      slot,
      name: room.players[slot].name
    }
  };
}

/* =========================================================
   ACTUALIZAR ESTADO
   ========================================================= */

function updateRoomState(room, newState) {
  if (
    !newState ||
    typeof newState !== "object" ||
    Array.isArray(newState)
  ) {
    return {
      ok: false,
      error: "Estado no válido."
    };
  }

  const oldState = room.state || initialState();

  room.state = {
    ...initialState(),
    ...oldState,
    ...newState,

    scores: {
      A: Number(
        newState.scores &&
        newState.scores.A !== undefined
          ? newState.scores.A
          : oldState.scores.A || 0
      ),

      B: Number(
        newState.scores &&
        newState.scores.B !== undefined
          ? newState.scores.B
          : oldState.scores.B || 0
      )
    },

    answers:
      newState.answers &&
      typeof newState.answers === "object"
        ? newState.answers
        : oldState.answers || {},

    moments:
      Array.isArray(newState.moments)
        ? newState.moments
        : oldState.moments || []
  };

  room.updatedAt = Date.now();

  return {
    ok: true,
    state: room.state
  };
}

/* =========================================================
   ARCHIVOS ESTÁTICOS
   ========================================================= */

function serveStatic(pathname, res) {

  let requestedFile;

  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/indice.html"
  ) {
    requestedFile = "índice.html";
  } else {
    requestedFile = pathname.replace(/^\/+/, "");
  }

  const filePath = path.resolve(
    ROOT,
    requestedFile
  );

  if (
    filePath !== ROOT &&
    !filePath.startsWith(ROOT + path.sep)
  ) {
    return text(res, 403, "Forbidden");
  }

  fs.stat(filePath, (error, stats) => {

    if (error || !stats.isFile()) {

      if (
        pathname === "/" ||
        pathname === "/index.html"
      ) {
        const fallbackFiles = [
          "índice.html",
          "index.html"
        ];

        for (const file of fallbackFiles) {
          const fallbackPath = path.join(
            ROOT,
            file
          );

          if (fs.existsSync(fallbackPath)) {
            return fs.readFile(
              fallbackPath,
              (readError, data) => {

                if (readError) {
                  return text(
                    res,
                    500,
                    "Error cargando la aplicación."
                  );
                }

                return text(
                  res,
                  200,
                  data,
                  "text/html; charset=utf-8"
                );
              }
            );
          }
        }
      }

      return text(res, 404, "Not found");
    }

    const extension = path
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
      ".ico": "image/x-icon"
    };

    res.writeHead(200, {
      "Content-Type":
        types[extension] ||
        "application/octet-stream",

      "Cache-Control": "no-cache"
    });

    fs.createReadStream(filePath).pipe(res);
  });
}

/* =========================================================
   SERVIDOR
   ========================================================= */

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

      /* ---------------------------------------------
         OPTIONS
         --------------------------------------------- */

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

      /* ---------------------------------------------
         HEALTH
         --------------------------------------------- */

      if (
        pathname === "/health" ||
        pathname === "/api/health"
      ) {

        return json(res, 200, {
          ok: true,
          status: "online",
          service: "sin-escapatoria",
          cards: cards.length,
          rooms: rooms.size
        });
      }

      /* ---------------------------------------------
         TARJETAS
         --------------------------------------------- */

      if (
        method === "GET" &&
        (
          pathname === "/cards.json" ||
          pathname === "/cards-data.json" ||
          pathname === "/tarjetas.json" ||
          pathname === "/datos-tarjetas.json"
        )
      ) {

        return json(res, 200, {
          cards: cards
        });
      }

      /* ---------------------------------------------
         CREAR PARTIDA
         --------------------------------------------- */

      if (
        method === "POST" &&
        pathname === "/api/create-room"
      ) {

        const body = await parseBody(req);

        let profile =
          String(body.profile || "A")
            .toUpperCase();

        if (
          profile !== "A" &&
          profile !== "B"
        ) {
          profile = "A";
        }

        const room = createRoom();

        room.players[profile] = {
          token: makeToken(),

          name: cleanName(
            body.name,
            profile === "A"
              ? "Jugador 1"
              : "Jugador 2"
          )
        };

        room.updatedAt = Date.now();

        return json(res, 200, {
          ok: true,

          code: room.code,

          player: {
            id: room.players[profile].token,

            slot: profile,

            name: room.players[profile].name
          },

          room: publicRoom(room)
        });
      }

      /* ---------------------------------------------
         UNIRSE A PARTIDA
         --------------------------------------------- */

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
              "El código de la sala no es válido."
          });
        }

        const room = findRoom(code);

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
            id: room.players[slot].token,

            slot,

            name: room.players[slot].name
          },

          room: publicRoom(room)
        });
      }

      /* ---------------------------------------------
         OBTENER SALA
         --------------------------------------------- */

      const roomMatch =
        pathname.match(
          /^\/api\/room\/([^/]+)$/
        );

      if (
        method === "GET" &&
        roomMatch
      ) {

        const room =
          findRoom(roomMatch[1]);

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
            roomStateResponse(
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

      /* ---------------------------------------------
         ACTUALIZAR ESTADO
         --------------------------------------------- */

      const stateMatch =
        pathname.match(
          /^\/api\/room\/([^/]+)\/state$/
        );

      if (
        method === "POST" &&
        stateMatch
      ) {

        const room =
          findRoom(stateMatch[1]);

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
          updateRoomState(
            room,
            body.state
          )
        );
      }

      /* ---------------------------------------------
         ENDPOINT ANTIGUO /room
         --------------------------------------------- */

      if (
        method === "POST" &&
        pathname === "/room"
      ) {

        const body =
          await parseBody(req);

        const room =
          createRoom();

        room.players.A = {
          token: makeToken(),

          name: cleanName(
            body.name,
            "Jugador 1"
          )
        };

        return json(res, 200, {
          ok: true,

          code: room.code,

          player:
            room.players.A.token,

          room: publicRoom(room)
        });
      }

      /* ---------------------------------------------
         ENDPOINT ANTIGUO /join
         --------------------------------------------- */

      const legacyJoin =
        pathname.match(
          /^\/join\/([^/]+)$/
        );

      if (
        method === "POST" &&
        legacyJoin
      ) {

        const room =
          findRoom(
            legacyJoin[1]
          );

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

        room.updatedAt = Date.now();

        return json(res, 200, {
          ok: true,

          code: room.code,

          player:
            room.players.B.token,

          room: publicRoom(room)
        });
      }

      /* ---------------------------------------------
         ARCHIVOS
         --------------------------------------------- */

      return serveStatic(
        pathname,
        res
      );

    } catch (error) {

      console.error(
        "ERROR DEL SERVIDOR:",
        error
      );

      return json(res, 500, {
        ok: false,
        error:
          "Error interno del servidor."
      });
    }
  }
);

/* =========================================================
   LIMPIAR SALAS ANTIGUAS
   ========================================================= */

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

/* =========================================================
   ARRANCAR
   ========================================================= */

server.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      "================================="
    );

    console.log(
      "SIN ESCAPATORIA"
    );

    console.log(
      "Servidor iniciado correctamente"
    );

    console.log(
      "Puerto:",
      PORT
    );

    console.log(
      "Tarjetas:",
      cards.length
    );

    console.log(
      "================================="
    );
  }
);
            
