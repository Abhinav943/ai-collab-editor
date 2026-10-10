FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY shared/package.json ./shared/
RUN npm ci
COPY client/ ./client/
COPY shared/ ./shared/

WORKDIR /app/client
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/client/dist /usr/share/nginx/html
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
