FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY server.js ./
COPY cards.json ./
COPY index.html ./
COPY web ./web

EXPOSE 8787

CMD ["npm", "start"]
