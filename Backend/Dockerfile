FROM node:22-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json tsconfig.json ./
RUN npm ci

COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
    PORT=5000 \
    FACE_PYTHON_PATH=/opt/face-venv/bin/python

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv libglib2.0-0 libgomp1 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY face-service/requirements.txt face-service/download_models.py ./face-service/
RUN python3 -m venv /opt/face-venv \
  && /opt/face-venv/bin/pip install --no-cache-dir -r face-service/requirements.txt \
  && /opt/face-venv/bin/python face-service/download_models.py \
  && mkdir -p uploads \
  && chown -R node:node /app/uploads /app/face-service /opt/face-venv
COPY face-service/worker.py ./face-service/worker.py

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

USER node

CMD ["node", "dist/main.js"]
