# Plan resumido — Dockerizar y testear Adkio

> Solo dockerización + testing local. Sin pasos de Railway/deploy.
> Pre-requisitos verificados: Docker 29.1.3, Docker Compose v2.40.3.
> Tiempo estimado: **35-40 min**.

---

## Fase 1 — Backend Dockerfile (10 min)

### 1.1 Crear `backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r /app/backend/requirements.txt

COPY backend /app/backend

ENV PYTHONPATH=/app
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port ${PORT}"]
```

### 1.2 Crear `.dockerignore` en la raíz

```
.git
.env
.env.*
.venv
venv
__pycache__
*.pyc
node_modules
dist
.DS_Store
.vscode
.idea
.cursor
.agents
*.log
```

### 1.3 Test

```bash
docker build -f backend/Dockerfile -t adkio-backend:dev .
docker run --rm -d --name back-test --env-file .env -p 8000:8000 adkio-backend:dev
sleep 3
curl -s http://localhost:8000/health && echo " ✓"
docker stop back-test
```

**Pasa si:** `/health` devuelve respuesta válida.

---

## Fase 2 — Frontend Dockerfile (10 min)

### 2.1 Crear `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
ARG VITE_BACKEND_URL
ENV VITE_BACKEND_URL=$VITE_BACKEND_URL
RUN npm run build

FROM node:20-alpine
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/dist ./dist
ENV PORT=3000
EXPOSE 3000
CMD ["sh", "-c", "serve -s dist -l ${PORT}"]
```

### 2.2 Test

```bash
docker build -f frontend/Dockerfile \
  --build-arg VITE_BACKEND_URL=http://localhost:8000 \
  -t adkio-frontend:dev .

docker run --rm -d --name front-test -p 3000:3000 adkio-frontend:dev
sleep 2
curl -s http://localhost:3000 | grep -q "Adkio" && echo "HTML ✓"
curl -s http://localhost:3000/ruta-falsa | grep -q "<!doctype html>" && echo "SPA ✓"
docker stop front-test
```

**Pasa si:** ambos checks (`HTML ✓` y `SPA ✓`) imprimen.

---

## Fase 3 — Docker Compose + test integración (10 min)

### 3.1 Crear `docker-compose.yml` en la raíz

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    image: adkio-backend:dev
    container_name: adkio-backend
    env_file:
      - .env
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app/backend
    command: ["sh", "-c", "uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload"]

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
      args:
        VITE_BACKEND_URL: http://localhost:8000
    image: adkio-frontend:dev
    container_name: adkio-frontend
    ports:
      - "3000:3000"
    depends_on:
      - backend
```

### 3.2 Test

```bash
docker compose up -d --build
sleep 5

curl -s http://localhost:8000/health && echo " ✓ backend"
curl -sI http://localhost:3000 | head -1
```

Abrir `http://localhost:3000` en el navegador → DevTools → Network → confirmar que las llamadas resuelven a `localhost:8000`.

```bash
docker compose down
```

**Pasa si:** ambos servicios responden y la landing carga sin errores en consola.

---

## Cheat-sheet

```bash
docker compose up -d            # levantar
docker compose logs -f backend  # logs en vivo
docker compose down             # apagar
docker compose up --build -d    # rebuild + up
```

---

## Checklist final

- [ ] `backend/Dockerfile` creado y build OK.
- [ ] `frontend/Dockerfile` creado y build OK.
- [ ] `.dockerignore` creado.
- [ ] `docker-compose.yml` creado.
- [ ] `docker compose up -d` levanta ambos servicios.
- [ ] `/health` del backend responde.
- [ ] Landing del frontend carga en `localhost:3000`.
- [ ] Frontend hace fetch correcto al backend (DevTools Network).