FROM node:22-alpine
WORKDIR /app
COPY . .
EXPOSE 8787
CMD ["sh", "-c", "if [ -f Server.js ]; then exec node Server.js; elif [ -f Servidor.js ]; then exec node Servidor.js; else echo 'No se encuentra Server.js ni Servidor.js'; exit 1; fi"]
