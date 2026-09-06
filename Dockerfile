FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.js ./
COPY cards.json ./
COPY index.html ./
COPY app_logo.png ./
COPY manifest.json ./
COPY sw.js ./
EXPOSE 8787
CMD ["npm","start"]
