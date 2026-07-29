FROM python:3.12-slim

WORKDIR /app

# Browser recordings arrive as WebM/Opus (Chrome) or MP4/AAC (Safari).
# Normalize them before handing the voice note to Evolution.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --shell /usr/sbin/nologin --uid 10001 appuser

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY app /app

RUN mkdir -p /app/data && chown -R appuser:appuser /app

USER appuser

ENV HOST=0.0.0.0
ENV PORT=8000

EXPOSE 8000

CMD ["python", "server.py"]
