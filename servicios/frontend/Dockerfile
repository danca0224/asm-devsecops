# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────
FROM nginx:1.27-alpine

# Copiar build de React
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuración nginx para SPA (react-router)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s \
  CMD wget -qO- http://localhost:80/health || exit 1
