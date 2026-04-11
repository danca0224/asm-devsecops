# ── Build stage ──────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Runtime stage ─────────────────────────────────────────────
FROM python:3.11-slim

# Instalar herramientas de red necesarias para el escaneo
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    dnsutils \
    nmap \
    ncat \
    openssl \
    whois \
    bash \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --create-home --shell /bin/bash scanner

WORKDIR /app

COPY --from=builder /root/.local /home/scanner/.local
COPY . .

RUN chown -R scanner:scanner /app

USER scanner

ENV PATH=/home/scanner/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

CMD ["celery", "-A", "tasks", "worker", "--loglevel=info", "-Q", "scanner", "--concurrency=2"]
