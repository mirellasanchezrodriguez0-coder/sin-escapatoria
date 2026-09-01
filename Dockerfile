FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY Server.js. ./server.js
COPY cards.json ./cards-data.json
COPY index.html ./
COPY web ./web

EXPOSE 8787

CMD ["npm", "start"]
