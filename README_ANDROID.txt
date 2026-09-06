SIN ESCAPATORIA — ANDROID

La aplicación Android utiliza WebView y carga la versión publicada del juego desde:
https://sin-escapatoria.onrender.com/

Esto evita que el APK siga mostrando una copia local antigua de la interfaz.

COMPILACIÓN
1. Abrir esta carpeta en Android Studio.
2. Esperar la sincronización de Gradle.
3. Ejecutar el proyecto en un dispositivo Android.
4. Para APK: Build > Generate App Bundles or APKs > Generate APKs.

MULTIJUGADOR
Las partidas de dos dispositivos usan el servidor HTTPS de Sin Escapatoria.

INVITACIONES
El APK conserva el esquema sinescapatoria://invite?invite=XXXXXX.
La URL web de invitación debe seguir apuntando al servidor publicado.

NOTA
El backend mantiene las salas en memoria. Una reinicialización del servidor elimina las salas activas; no afecta a los perfiles guardados en friends.json.
