FROM node:22-alpine AS builder
WORKDIR /app
ENV CI=true
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml* .npmrc* ./
# A fresh render ships no lockfile (variant renderings change the dependency set, so no single
# static lockfile can be valid for all of them). Once the rendered project commits its own
# pnpm-lock.yaml, the frozen path engages automatically and stays authoritative.
RUN npm install -g pnpm && if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else pnpm install; fi
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
USER appuser
EXPOSE {{ service_port }} {{ management_port }}
ENTRYPOINT ["node", "dist/index.js"]
