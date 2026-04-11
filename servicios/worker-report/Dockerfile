# ── Build stage ──────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Runtime stage ─────────────────────────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs npm \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash reporter

WORKDIR /app

COPY --from=builder /root/.local /home/reporter/.local
COPY . .

# Instalar dependencias Node para generación DOCX via template
RUN npm install --omit=dev 2>/dev/null || true

RUN chown -R reporter:reporter /app

USER reporter

ENV PATH=/home/reporter/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

CMD ["celery", "-A", "tasks", "worker", "--loglevel=info", "-Q", "report", "--concurrency=1"]
