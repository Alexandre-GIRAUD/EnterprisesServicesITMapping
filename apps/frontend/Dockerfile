# Build stage
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json ./
# npm ci requires package-lock.json (generate in apps/frontend with: npm install).
# Fallback to npm install so Docker build works when no lock file is present.
RUN npm install

COPY . .
RUN npm run build

# Run stage: nginx to serve SPA
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
