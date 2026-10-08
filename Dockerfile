FROM node:26-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:26-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY src/database/migrations ./src/database/migrations
COPY headtohead.json ./headtohead.json
COPY docs/api/openapi.yaml ./docs/api/openapi.yaml
EXPOSE 3000
CMD ["npm", "start"]
