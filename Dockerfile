# ---- 依赖 ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- 构建 ----
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 运行（standalone） ----
FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV JUDOU_DATA_DIR=/app/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
