#!/bin/sh
set -e

echo "[entrypoint] Applying database migrations"
python3 manage.py migrate --noinput

echo "[entrypoint] Launching gunicorn"
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --log-level info
