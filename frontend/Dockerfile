FROM node:18-alpine

WORKDIR /app

# Copy package files first to leverage cache
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy the rest of the code
COPY . .

# Expose the specific port (default 3000)
EXPOSE 3000

# Start in development mode
CMD ["npm", "run", "dev"]
