# Multi-stage build:
#   1. node:20-alpine build Docusaurus → static HTML/CSS/JS trong /app/build
#   2. nginx:alpine serve static
# Build args để override baseUrl khi serve ở root domain (EC2 self-host).
FROM node:20-alpine AS build
WORKDIR /app

# Khi self-host (không qua GitHub Pages), serve ở root → baseUrl="/"
ARG DOCS_URL=http://localhost:8081
ARG DOCS_BASE_URL=/
ENV DOCS_URL=$DOCS_URL
ENV DOCS_BASE_URL=$DOCS_BASE_URL

COPY package*.json ./
RUN npm install
COPY . .
RUN NODE_OPTIONS="--max-old-space-size=3072" npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
