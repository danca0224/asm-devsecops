# ── Build stage ──────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# ── Runtime stage ─────────────────────────────────────────────
FROM python:3.11-slim

# Usuario no-root
RUN useradd --create-home --shell /bin/bash appuser

WORKDIR /app

# Copiar dependencias instaladas
COPY --from=builder /root/.local /home/appuser/.local

# Copiar código fuente
COPY app/ ./app/

RUN chown -R appuser:appuser /app

USER appuser

ENV PATH=/home/appuser/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
