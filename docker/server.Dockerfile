FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
COPY server/package.json ./server/
COPY shared/package.json ./shared/
RUN npm ci --omit=dev

COPY server/ ./server/
COPY shared/ ./shared/

WORKDIR /app/server

EXPOSE 5000

CMD ["node", "src/server.js"]
