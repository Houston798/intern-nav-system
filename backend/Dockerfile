FROM node:20-alpine

# better-sqlite3 需要编译工具
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 编译 TypeScript
RUN npx tsc -p tsconfig.json

EXPOSE 3001

CMD ["node", "dist/start.js"]
