FROM node:22-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production

# default-mysql-client trae los binarios mysqldump/mysql que usa
# Configuración → Base de datos (exportar/importar dump completo) — ver
# src/services/sistema/backup.service.js. Antes esta imagen era
# node:22-alpine con `apk add mysql-client`, pero el cliente MariaDB de
# Alpine viene sin plugins de autenticación (carpeta /usr/lib/mariadb/plugin
# vacía) — no puede cargar caching_sha2_password, que es el método de auth
# por defecto de MySQL 8, y exportar/importar fallaba con
# "Plugin 'caching_sha2_password' could not be loaded". La build de Debian
# de mariadb-client SÍ trae ese plugin, por eso el cambio de base.
RUN apt-get update \
  && apt-get install -y --no-install-recommends default-mysql-client \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

EXPOSE 3000

CMD ["npm", "start"]