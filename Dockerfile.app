# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

# Copy root workspace manifest first.
COPY package.json package-lock.json ./
COPY app/package.json ./app/

# Install app workspace dependencies.
RUN npm ci --workspace=app --ignore-scripts

# Copy app source and build to dist/.
COPY app/ ./app/
RUN npm run build --workspace=app

# ── Runtime stage: nginx serves the SPA and proxies /api to the server ────────
FROM nginx:alpine AS runtime

# Remove default nginx config.
RUN rm /etc/nginx/conf.d/default.conf

# Inline nginx config: serve SPA with fallback to index.html (for React Router),
# proxy /api/* to the server container.
RUN printf 'server {\n\
    listen 80;\n\
    server_name _;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
\n\
    # Proxy all API calls to the Express server.\n\
    location /api/ {\n\
        proxy_pass         http://server:3001;\n\
        proxy_http_version 1.1;\n\
        proxy_set_header   Host             $host;\n\
        proxy_set_header   X-Real-IP        $remote_addr;\n\
        proxy_set_header   Connection       "";\n\
        # Keep SSE streams alive (AI endpoints use chunked transfer).\n\
        proxy_buffering    off;\n\
        proxy_read_timeout 300s;\n\
    }\n\
\n\
    # React Router — fall back to index.html for all client-side routes.\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
}\n' > /etc/nginx/conf.d/intelistock.conf

COPY --from=builder /build/app/dist /usr/share/nginx/html

EXPOSE 80
