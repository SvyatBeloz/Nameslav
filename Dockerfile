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

EXPOSE 3000
CMD ["node", "dist/server.js"]
