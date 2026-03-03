FROM node:18-alpine

WORKDIR /app/frontend

# Install build essentials
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json .npmrc* ./

# Install dependencies
RUN npm install

# Copy source files
COPY src src
COPY index.html vite.config.ts tsconfig.json tsconfig.node.json .eslintrc.json ./

EXPOSE 3000

# Use direct path to ensure local node_modules/vite is used
CMD ["./node_modules/.bin/vite", "--host", "0.0.0.0", "--port", "3000"]
