FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production

# mysql-client trae los binarios mysqldump/mysql que usa Configuración →
# Base de datos (exportar/importar dump completo) — ver
# src/services/sistema/backup.service.js.
RUN apk add --no-cache mysql-client

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

EXPOSE 3000

CMD ["npm", "start"]