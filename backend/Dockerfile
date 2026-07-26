FROM python:3.13-slim

WORKDIR /app

COPY pyproject.toml README.md ./
COPY app ./app
COPY scripts ./scripts
COPY data/dmd.sample.sqlite ./data/dmd.sample.sqlite

RUN pip install --no-cache-dir -e .

ENV DMD_DB_PATH=/app/data/dmd.sqlite
ENV APP_DB_PATH=/app/data/app.sqlite
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

COPY scripts/docker_entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --app-dir ."]
