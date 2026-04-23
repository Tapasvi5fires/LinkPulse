# Stage 1: Build
FROM node:18-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

# Pass NEXT_PUBLIC_API_URL as a build argument if needed, 
# but we will rely on env vars in docker-compose for flexibility if possible.
# Note: Next.js bakes in NEXT_PUBLIC_ variables at build time.
ARG NEXT_PUBLIC_API_URL=http://backend:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Stage 2: Run
FROM node:18-alpine

WORKDIR /app

# Copy only the necessary files from the builder
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Start in production mode by default
CMD ["npm", "start"]
