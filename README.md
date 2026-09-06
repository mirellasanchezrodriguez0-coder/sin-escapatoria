# SIN ESCAPATORIA — edición definitiva

Proyecto web listo para desplegar como servicio Node en Render.

## Incluye
- `index.html`: interfaz negra/dorada/roja con el logo definitivo.
- `app_logo.png`: logo elegido.
- `server.js`: servidor y salas para 2 dispositivos.
- `cards.json`: baraja del juego.
- `manifest.json` + `sw.js`: instalación como app web.
- `Dockerfile` + `package.json`: despliegue directo en Render/Docker.

## Dos dispositivos
1. Jugador 1 crea una partida.
2. Se genera un código de 6 caracteres.
3. Jugador 2 abre el mismo enlace, escribe el código y pulsa UNIRSE.
4. El estado, respuestas, puntuación y ronda se sincronizan mediante el servidor.

Las salas son temporales y se guardan en memoria del servidor.
