# =============================================================================
# Frontend Dockerfile — Multi-stage: development → production (nginx)
# =============================================================================
# Stage 1: Dependencies (shared across all stages)
FROM node:22-alpine AS deps

WORKDIR /app

RUN corepack enable && corepack prepare npm@latest --activate

COPY package.json package-lock.json ./
RUN npm ci

# =============================================================================
# Stage 2: Development — Vite dev server with hot-reload + Playwright E2E
FROM deps AS development

# Install Playwright system dependencies for Alpine Linux
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont \
    font-noto-cjk \
    dbus

# Install Playwright Chromium browser binary
RUN npx playwright install chromium

COPY tsconfig.json tsconfig.e2e.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY eslint.config.js ./
COPY public/ public/
COPY src/ src/
COPY e2e/ e2e/
COPY lighthouserc.js ./
COPY playwright.config.ts ./

EXPOSE 5173

ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=true

CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "5173"]

# =============================================================================
# Stage 3: Build — compile production bundle
FROM deps AS builder

COPY tsconfig.json tsconfig.e2e.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY eslint.config.js ./
COPY public/ public/
COPY src/ src/

RUN npm run build

# =============================================================================
# Stage 4: Production — nginx serving static files
FROM nginx:1.27-alpine AS production

# Security: non-root user
RUN adduser -D -u 1001 -g 'nginx' nginx

# Copy built assets from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing + API proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Switch to non-root user
USER nginx

EXPOSE 80

STOPSIGNAL SIGQUIT

CMD ["nginx", "-g", "daemon off;"]
