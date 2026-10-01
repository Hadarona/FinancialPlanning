FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
RUN npm ci

FROM dependencies AS test
COPY . .
ENV NODE_ENV=test
CMD ["npm", "run", "coverage"]

FROM test AS build
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-bookworm-slim AS production
WORKDIR /app
ENV NODE_ENV=production SERVE_CLIENT=true PORT=4000
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/client/dist ./client/dist
RUN mkdir -p /app/logs && chown node:node /app/logs
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npm run migrate && npm run start -w server"]
