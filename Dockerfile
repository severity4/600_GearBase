FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --production

# Copy source
COPY . .

# Build frontend (assemble HTML from src/ templates)
RUN node build.js

EXPOSE 3000

CMD ["node", "server/index.js"]
