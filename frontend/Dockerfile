FROM node:24-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist/ /usr/share/nginx/html/
COPY --from=builder /app/public/* /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY entrypoint.sh /entrypoint.sh

# Set proper permissions for the nginx html directory and entrypoint script
RUN chmod -R 755 /usr/share/nginx/html && \
    chown -R nginx:nginx /usr/share/nginx/html && \
    chmod +x /entrypoint.sh

# Set default environment variables
ENV API_HOST=api
ENV API_PORT=3000

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1

# Start Nginx after creating the same-origin API proxy and runtime config.
ENTRYPOINT ["/entrypoint.sh"]
