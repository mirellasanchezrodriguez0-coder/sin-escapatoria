FROM node:22-alpine

WORKDIR /app

COPY paquete.json ./package.json

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["node", "Servidor.js"]
