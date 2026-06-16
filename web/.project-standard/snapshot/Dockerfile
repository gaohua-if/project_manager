FROM node:20-alpine AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10.18.3 --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:1.29-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
COPY public/config.js /usr/share/nginx/html/config.js

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
