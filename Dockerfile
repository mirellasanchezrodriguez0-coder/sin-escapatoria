FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY Server.js ./server.js
COPY cards.json ./cards.json
COPY cards-data.json ./cards-data.json
COPY index.html ./

EXPOSE 8787

CMD ["npm", "start"]
