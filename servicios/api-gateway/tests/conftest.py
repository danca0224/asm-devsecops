import pytest
import os

# Variables de entorno mínimas para tests
os.environ.setdefault("POSTGRES_PASSWORD", "test_password")
os.environ.setdefault("JWT_SECRET_KEY", "test_secret_key_for_testing_only_32chars")
os.environ.setdefault("RABBITMQ_PASSWORD", "test_rabbitmq")
os.environ.setdefault("CELERY_BROKER_URL", "memory://")
