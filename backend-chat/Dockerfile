FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM dependencies AS build
COPY tsconfig*.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM dependencies AS migration
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src ./src
CMD ["npm", "run", "db:migrate"]

FROM node:22-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["npm", "run", "start:prod"]
