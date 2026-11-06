# Multi-Tenant SaaS Project Management Platform (SprintSync)
# Production Frontend Dockerfile (Multi-stage build)

# Stage 1: Build static assets with Node.js
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies using clean install
COPY package*.json ./
RUN npm ci

# Pass build-time environment variable for backend API target
ARG VITE_API_URL=""
ENV VITE_API_URL=${VITE_API_URL}

# Copy frontend source files
COPY . .

# Execute Vite production build
RUN npm run build

# Stage 2: Serve static production assets via Nginx
FROM nginx:alpine

# Remove default nginx template
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# Container healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

