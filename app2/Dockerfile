FROM node:26-slim

WORKDIR /app

# deps en imagen; el código fuente va montado por compose (dev)
COPY package.json package-lock.json ./
RUN npm ci --no-fund --no-audit

EXPOSE 4321
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
