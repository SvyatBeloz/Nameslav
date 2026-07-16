# --- build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- production stage ---
FROM node:20-slim AS production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/src/names/bank ./dist/names/bank
COPY --from=build /app/src/i18n/locale.yaml ./dist/i18n/locale.yaml

# Fixed UID/GID (not the base image's built-in user) so it's documented and
# stable across base image changes — docs/README tell operators to chown
# their bind-mounted ./cache to this same 1000:1000.
RUN groupadd --gid 1000 app \
  && useradd --uid 1000 --gid app --shell /usr/sbin/nologin --no-create-home app
USER app

EXPOSE 3000
CMD ["node", "dist/server.js"]
