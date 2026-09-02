const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 8787);
const ROOT = __dirname;
const WEB_ROOT = path.join(ROOT, "web");
const rooms = new Map();
const ROOM_TTL = 2 * 60 * 60 * 1000;

function loadCards() {
  const files = ["tarjetas.json", "datos-tarjetas.json", "cards.json", "cards-data.json"];
  for (const file of files) {
    try {
      const p = path.join(ROOT, file);
      if (!fs.existsSync(p)) continue;
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Array.isArray(data)) return data;
      if (Array.isArray(data?.cards)) return data.cards;
      if (Array.isArray(data?.tarjetas)) return data.tarjetas;
    } catch (e) {
      console.error(`Error leyendo ${file}:`, e.message);
    }
  }
  console.error("NO SE ENCONTRARON LAS TARJETAS.");
  return [];
}

const cards = loadCards();
console.log(`Tarjetas disponibles: ${cards.length}`);

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

function text(res, status, body, type = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  });
  res.end(body);
}

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
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
    req.on("error", reject);
  });
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = "";
    for (let i = 0; i < 6; i++) code += chars[crypto.randomInt(chars.length)];
  } while (rooms.has(code));
  return code;
}

function makeToken() {
  return crypto.randomBytes(20).toString("hex");
}

function cleanName(value, fallback) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return name || fallback;
}

function initialState() {
  return {
    round: 0,
    started: false,
    answers: {},
    scores: { A: 0, B: 0 },
    rolls: 0,
    intensity: 1,
    drinks: 0,
    matches: 0,
    moments: []
  };
}

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
  const key = String(code || "").trim().toUpperCase();
  const room = rooms.get(key);
  if (!room) return null;
  if (Date.now() - room.updatedAt > ROOM_TTL) {
    rooms.delete(key);
    return null;
  }
  room.updatedAt = Date.now();
  return room;
}

function publicRoom(room) {
  return {
    code: room.code,
    players: Object.entries(room.players).map(([slot, p]) => ({
      id: p.token,
      slot,
      name: p.name,
      profile: slot
    }))
  };
}

function playerSlot(room, token) {
  for (const slot of ["A", "B"]) {
    if (room.players[slot]?.token === token) return slot;
  }
  return null;
}

function updateRoomState(room, newState) {
  if (!newState || typeof newState !== "object" || Array.isArray(newState)) {
    return { ok: false, error: "Estado no válido." };
  }

  const old = room.state || initialState();

  const scores = newState.scores && typeof newState.scores === "object"
    ? newState.scores
    : old.scores;

  const answers = newState.answers && typeof newState.answers === "object"
    ? newState.answers
    : old.answers;

  const moments = Array.isArray(newState.moments)
    ? newState.moments
    : old.moments;

  room.state = {
    ...initialState(),
    ...old,
    ...newState,
    scores: {
      A: Number(scores?.A || 0),
      B: Number(scores?.B || 0)
    },
    answers,
    moments
  };

  room.updatedAt = Date.now();

  return {
    ok: true,
    state: room.state
  };
}

function serveFile(res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      return text(res, 404, "Not found");
    }

    const ext = path.extname(filePath).toLowerCase();
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
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*"
    });

    fs.createReadStream(filePath).pipe(res);
  });
}

function serveStatic(pathname, res) {
  // IMPORTANTE: la pantalla principal se sirve desde web/index.html.
  // Si todavía no existe la carpeta web en un despliegue, usamos el index de raíz.

  let requested;

  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/indice.html"
  ) {
    requested = fs.existsSync(path.join(WEB_ROOT, "index.html"))
      ? path.join(WEB_ROOT, "index.html")
      : path.join(ROOT, "index.html");
  } else {
    const relative = pathname.replace(/^\/+/, "");

    const candidateWeb = path.resolve(WEB_ROOT, relative);
    const candidateRoot = path.resolve(ROOT, relative);

    const safeWeb =
      candidateWeb === WEB_ROOT ||
      candidateWeb.startsWith(WEB_ROOT + path.sep);

    const safeRoot =
      candidateRoot === ROOT ||
      candidateRoot.startsWith(ROOT + path.sep);

    if (!safeWeb || !safeRoot) {
      return text(res, 403, "Forbidden");
    }

    requested = fs.existsSync(candidateWeb)
      ? candidateWeb
      : candidateRoot;
  }

  return serveFile(res, requested);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`
    );

    const pathname = decodeURIComponent(url.pathname);
    const method = req.method || "GET";

    if (method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS"
      });

      return res.end();
    }

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

    if (
      method === "GET" &&
      [
        "/cards.json",
        "/cards-data.json",
        "/tarjetas.json",
        "/datos-tarjetas.json"
      ].includes(pathname)
    ) {
      return json(res, 200, { cards });
    }

    if (
      method === "POST" &&
      pathname === "/api/create-room"
    ) {
      const body = await parseBody(req);

      const profile =
        String(body.profile || "A").toUpperCase() === "B"
          ? "B"
          : "A";

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

    if (
      method === "POST" &&
      pathname === "/api/join-room"
    ) {
      const body = await parseBody(req);

      const code = String(body.code || "")
        .trim()
        .toUpperCase();

      if (!/^[A-Z0-9]{6}$/.test(code)) {
        return json(res, 400, {
          ok: false,
          error: "El código de la sala no es válido."
        });
      }

      const room = findRoom(code);

      if (!room) {
        return json(res, 404, {
          ok: false,
          error: "La sala no existe o ha caducado."
        });
      }

      if (room.players.A && room.players.B) {
        return json(res, 409, {
          ok: false,
          error: "La sala ya tiene dos jugadores."
        });
      }

      const slot = room.players.A ? "B" : "A";

      room.players[slot] = {
        token: makeToken(),
        name: cleanName(
          body.name,
          slot === "A"
            ? "Jugador 1"
            : "Jugador 2"
        )
      };

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

    const roomMatch =
      pathname.match(/^\/api\/room\/([^/]+)$/);

    if (
      method === "GET" &&
      roomMatch
    ) {
      const room = findRoom(roomMatch[1]);

      if (!room) {
        return json(res, 404, {
          ok: false,
          error: "La sala no existe o ha caducado."
        });
      }

      const token =
        url.searchParams.get("player");

      if (token) {
        const slot = playerSlot(room, token);

        if (!slot) {
          return json(res, 401, {
            ok: false,
            error: "Jugador no válido."
          });
        }

        return json(res, 200, {
          ok: true,
          room: publicRoom(room),
          state: room.state,
          player: {
            id: token,
            slot,
            name: room.players[slot].name
          }
        });
      }

      return json(res, 200, {
        ok: true,
        room: publicRoom(room),
        state: room.state
      });
    }

    const stateMatch =
      pathname.match(/^\/api\/room\/([^/]+)\/state$/);

    if (
      method === "POST" &&
      stateMatch
    ) {
      const room = findRoom(stateMatch[1]);

      if (!room) {
        return json(res, 404, {
          ok: false,
          error: "La sala no existe o ha caducado."
        });
      }

      const body = await parseBody(req);

      const result =
        updateRoomState(room, body.state);

      return json(
        res,
        result.ok ? 200 : 400,
        result
      );
    }

    // Compatibilidad con rutas antiguas del proyecto.

    if (
      method === "POST" &&
      pathname === "/room"
    ) {
      const body = await parseBody(req);

      const profile =
        String(body.profile || "A").toUpperCase() === "B"
          ? "B"
          : "A";

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

    const joinLegacy =
      pathname.match(/^\/join\/([^/]+)$/);

    if (
      method === "POST" &&
      joinLegacy
    ) {
      const body = await parseBody(req);

      const room =
        findRoom(joinLegacy[1]);

      if (!room) {
        return json(res, 404, {
          ok: false,
          error: "La sala no existe o ha caducado."
        });
      }

      if (room.players.A && room.players.B) {
        return json(res, 409, {
          ok: false,
          error: "La sala ya tiene dos jugadores."
        });
      }

      const slot =
        room.players.A ? "B" : "A";

      room.players[slot] = {
        token: makeToken(),
        name: cleanName(
          body.name,
          slot === "A"
            ? "Jugador 1"
            : "Jugador 2"
        )
      };

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

    const legacyState =
      pathname.match(/^\/state\/([^/]+)$/);

    if (
      method === "GET" &&
      legacyState
    ) {
      const room =
        findRoom(legacyState[1]);

      if (!room) {
        return json(res, 404, {
          ok: false,
          error: "La sala no existe o ha caducado."
        });
      }

      return json(res, 200, {
        ok: true,
        room: publicRoom(room),
        state: room.state
      });
    }

    if (
      method === "POST" &&
      legacyState
    ) {
      const room =
        findRoom(legacyState[1]);

      if (!room) {
        return json(res, 404, {
          ok: false,
          error: "La sala no existe o ha caducado."
        });
      }

      const body = await parseBody(req);

      return json(
        res,
        200,
        updateRoomState(
          room,
          body.state || body
        )
      );
    }

    if (
      method === "GET" ||
      method === "HEAD"
    ) {
      return serveStatic(pathname, res);
    }

    return json(res, 404, {
      ok: false,
      error: "Ruta no encontrada."
    });

  } catch (error) {
    console.error(
      "ERROR SERVIDOR:",
      error
    );

    return json(res, 500, {
      ok: false,
      error: "Error interno del servidor."
    });
  }
});

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
}, 5 * 60 * 1000).unref();

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `SIN ESCAPATORIA online en puerto ${PORT}`
    );

    console.log(
      `Interfaz principal: ${
        fs.existsSync(
          path.join(
            WEB_ROOT,
            "index.html"
          )
        )
          ? "web/index.html"
          : "index.html"
      }`
    );
  }
);
