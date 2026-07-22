# --- build stage ---
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
# --include=dev is explicit on purpose: npm's default `omit` is "dev" whenever
# it sees NODE_ENV=production, and some builders (e.g. Docker Compose's Bake)
# leak the service's `environment:` into the build — silently dropping
# devDependencies like typescript and breaking `npm run build` below.
RUN npm ci --include=dev
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

# node:20-slim already ships a non-root "node" user at uid/gid 1000 — reuse
# it instead of creating a new one (a second group at gid 1000 would collide
# with it). docs/README tell operators to chown their bind-mounted ./cache
# to this same 1000:1000.
USER node

EXPOSE 3000
CMD ["node", "dist/server.js"]
