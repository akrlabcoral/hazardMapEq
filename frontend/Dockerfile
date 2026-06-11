FROM node:22-alpine

WORKDIR /app

# Copy package management files
COPY package.json package-lock.json* ./

# Install dependencies cleanly
RUN npm ci

# Copy source code and config files
COPY src/ ./src/
COPY public/ ./public/
COPY index.html admin.html vite.config.js tailwind.config.js postcss.config.js ./

# Use the built-in non-root node user
RUN chown -R node:node /app
USER node

# Expose Vite dev server port
EXPOSE 5173

# Start Vite dev server with host and port specified
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
