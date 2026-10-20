FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
# Optional BuildKit certificate secret for environments with a trusted TLS proxy.
RUN --mount=type=secret,id=build_ca \
    if [ -f /run/secrets/build_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/build_ca npm ci --include=dev --fetch-retries=0; \
    else npm ci --include=dev --fetch-retries=0; fi
COPY . .
RUN npm run build && npm prune --omit=dev --ignore-scripts --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/app/data
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/scripts/check-ai.mjs ./scripts/check-ai.mjs
RUN mkdir -p /app/data && chown node:node /app/data
# Railway mounts fresh volumes as root-owned directories. Initialize only this
# volume, then replace the initializer with an unprivileged server process.
RUN <<'EOF'
set -eu
test -x /usr/bin/setpriv
cat > /usr/local/bin/orbit-entrypoint <<'SCRIPT'
#!/bin/sh
set -eu
if [ "${DATA_DIR:-/app/data}" != /app/data ]; then
  echo 'Container DATA_DIR must be /app/data; mount persistent storage there.' >&2
  exit 1
fi
if [ "$(id -u)" = 0 ]; then
  mkdir -p /app/data
  chown -R node:node /app/data
  exec setpriv --reuid=node --regid=node --init-groups --no-new-privs "$@"
fi
exec "$@"
SCRIPT
chmod 755 /usr/local/bin/orbit-entrypoint
EOF
EXPOSE 3000
VOLUME ["/app/data"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/orbit-entrypoint"]
CMD ["npm", "start"]
