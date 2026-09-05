SIN ESCAPATORIA — V11 5D · EDICIÓN MAESTRA

PROPÓSITO
Juego de pareja para dos jugadores, pensado como experiencia progresiva y rejugable, con modo remoto (dos dispositivos) y modo local (un dispositivo compartido).

HISTORIAL CONSOLIDADO
V1 / base: perfiles A/B, nombres, salas por código, sincronización, cartas y estado compartido.
V2: ampliación de cartas y flujo de partida.
V3: 8 modos, tablero de 40 casillas, dados, eventos, puntos, rachas, bonificaciones, temporizador, logros, chat y final.
V4: Modo Completo, campaña de 10 niveles, mezclas por nivel y desbloqueos.
V5: rediseño premium oscuro con profundidad, neón y animaciones.
V6: 169 cartas, 10 niveles con mecánicas/mapas/jefes/recompensas/desbloqueos, casillas especiales, objetos, eventos y 4 finales.
V7: 209 cartas y sistema explícito de intensidad 0–100: Suave, Coqueta, Atrevida y Picante.
V8: revisión de flujo remoto y sincronización.
V9: amigos, códigos de amigo e invitaciones compartibles; modo local/remoto.
V10: capa visual inmersiva con partículas, parallax, microsonido, vibración y PWA.
V11: auditoría integral, corrección del filtrado de intensidad, capa 5D visual/sensorial, limpieza de caché PWA y endurecimiento del servidor.

CONTENIDO
- 209 cartas únicas; las 47 cartas originales están preservadas por contenido.
- 10 niveles de campaña.
- 8 modos libres + Modo Completo.
- Tablero de 40 casillas.
- Dados, eventos, objetos, rachas, puntuación, gemas, logros, jefes, recompensas y 4 finales.
- Intensidad 0–100 con límite seleccionable.
- Progresión: Suave → Coqueta → Atrevida → Picante.
- Consentimiento: cada carta puede pasarse sin explicaciones.

MODO DE JUEGO
REMOTO: cada jugador entra desde su dispositivo a la misma sala.
LOCAL: ambos juegan en el mismo dispositivo, pasando el móvil al cambiar el turno.
AMIGOS: cada instalación genera una identidad SE-XXXXXXXX; se puede registrar nombre, añadir un código de amigo y compartir una invitación de sala.

CAPA 5D
No se trata de hardware 5D literal: es una presentación inmersiva combinando perspectiva 3D, profundidad CSS, parallax, partículas, luz dinámica, microsonidos y haptic cuando el navegador/dispositivo lo permite. Respeta prefers-reduced-motion.

CALIDAD Y COMPATIBILIDAD
- Server.js sin dependencias externas.
- Node.js.
- PWA con manifest y service worker.
- CORS abierto para despliegues sencillos; en producción se recomienda restringirlo al dominio de la app.
- Las salas son temporales en memoria; el sistema de amigos se guarda en friends.json.
- Las salas caducan tras 24 h.

NOTA DE PRODUCCIÓN
Para una app pública real conviene añadir autenticación, base de datos persistente de cuentas/amigos, HTTPS, rate limiting, notificaciones push y una política de CORS restringida. Esta V11 no finge que esas capas estén implementadas.
