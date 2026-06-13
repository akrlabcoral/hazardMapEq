FROM python:3.10-slim AS builder

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gdal-bin \
    libgdal-dev \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv "$VIRTUAL_ENV"

COPY requirements.txt requirements-dev.txt ./
ARG INSTALL_DEV=false
RUN pip install --upgrade pip && \
    if [ "$INSTALL_DEV" = "true" ]; then \
      pip install --no-cache-dir -r requirements-dev.txt; \
    else \
      pip install --no-cache-dir -r requirements.txt; \
    fi

FROM python:3.10-slim AS runtime

ENV VIRTUAL_ENV=/opt/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libexpat1 \
    libgdal36 \
    proj-data \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /opt/venv /opt/venv
COPY app/ ./app/
COPY data/ ./data/

RUN useradd -m -u 1000 appuser && \
    mkdir -p data && \
    chown -R appuser:appuser /app /opt/venv

USER appuser

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
