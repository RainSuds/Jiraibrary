"""Django settings for the Jiraibrary backend."""

from __future__ import annotations
import urllib.parse
secret_arn = os.getenv("DATABASE_SECRET_ARN")
region = os.getenv("AWS_REGION", "us-east-2")

if secret_arn:
    sm = boto3.client("secretsmanager", region_name=region)
    secret_value = json.loads(sm.get_secret_value(SecretId=secret_arn)["SecretString"])
    user = secret_value["username"]
    password = urllib.parse.quote_plus(secret_value["password"])
    host = secret_value["host"]
    port = secret_value["port"]
    db = secret_value["dbname"]
    os.environ["DATABASE_URL"] = f"postgresql://{user}:{password}@{host}:{port}/{db}"

import os
from pathlib import Path
from typing import Any, cast

import environ
from django.core.exceptions import ImproperlyConfigured
from django.core.management.utils import get_random_secret_key


import json
import boto3

BASE_DIR = Path(__file__).resolve().parent.parent


env = environ.Env(
    DEBUG=(bool, False),
    SECRET_KEY=(str, ""),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    CORS_ALLOW_ALL_ORIGINS=(bool, False),
    CORS_ALLOWED_ORIGINS=(list, []),
    CSRF_TRUSTED_ORIGINS=(list, []),
    GOOGLE_OAUTH_CLIENT_IDS=(list, []),
    STATIC_URL=(str, "static/"),
    MEDIA_URL=(str, "media/"),
    AWS_STORAGE_BUCKET_NAME=(str, ""),
    AWS_S3_REGION_NAME=(str, ""),
    AWS_S3_CUSTOM_DOMAIN=(str, ""),
    AWS_S3_ENDPOINT_URL=(str, ""),
    AWS_S3_SIGNATURE_VERSION=(str, "s3v4"),
    AWS_S3_STATIC_LOCATION=(str, "static"),
    AWS_S3_MEDIA_LOCATION=(str, "media"),
    AWS_QUERYSTRING_AUTH=(bool, False),
    AWS_DEFAULT_ACL=(str, ""),
    AWS_S3_FILE_OVERWRITE=(bool, True),
    DATABASE_REQUIRE_SSL=(bool, False),
    DB_CONN_MAX_AGE=(int, 60),
)

# Read environment files with override support
_env_override = os.getenv("DJANGO_ENV_FILE")
if _env_override:
    environ.Env.read_env(_env_override)
else:
    for _candidate in (BASE_DIR / ".env", BASE_DIR / ".env.local"):
        if _candidate.exists():
            environ.Env.read_env(_candidate)


DEBUG = env.bool("DEBUG")
SECRET_KEY = env("SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = get_random_secret_key()
    else:
        raise ImproperlyConfigured("SECRET_KEY must be set. Provide it via environment variables or .env.")
ALLOWED_HOSTS: list[str] = cast(list[str], env.list("ALLOWED_HOSTS"))


INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "django_filters",
    "drf_spectacular",
    "storages",
    "catalog.apps.CatalogConfig",
    "users.apps.UsersConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"




# Build DATABASES from DATABASE_URL, which is set at the top of this file using boto3 and your custom secret
DATABASES: dict[str, dict[str, Any]] = {
    "default": env.db_url(
        "DATABASE_URL",
        default="postgres://jiraibrary:jiraibrary@localhost:5432/jiraibrary",  # type: ignore[arg-type]
    )
}
DATABASES["default"]["ATOMIC_REQUESTS"] = True
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DB_CONN_MAX_AGE")
DATABASES["default"]["CONN_HEALTH_CHECKS"] = True
DATABASES["default"].setdefault("OPTIONS", {})
DATABASES["default"]["OPTIONS"]["sslmode"] = "require"


AUTH_USER_MODEL = "users.User"


REST_FRAMEWORK: dict[str, Any] = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.DjangoModelPermissionsOrAnonReadOnly",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Jiraibrary API",
    "DESCRIPTION": "REST API for the Jirai Kei fashion archive.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
}


LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = env("STATIC_URL")
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = env("MEDIA_URL")
MEDIA_ROOT = BASE_DIR / "media"

STORAGES: dict[str, dict[str, Any]] = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}


if env.bool("CORS_ALLOW_ALL_ORIGINS"):
    CORS_ALLOW_ALL_ORIGINS = True
    CORS_ALLOWED_ORIGINS: list[str] = []
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = cast(list[str], env.list("CORS_ALLOWED_ORIGINS"))

CSRF_TRUSTED_ORIGINS = cast(list[str], env.list("CSRF_TRUSTED_ORIGINS"))

GOOGLE_OAUTH_CLIENT_IDS: list[str] = cast(
    list[str],
    env.list("GOOGLE_OAUTH_CLIENT_IDS"),
)


AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME") or None
if AWS_STORAGE_BUCKET_NAME:
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME") or None
    aws_custom_domain = env("AWS_S3_CUSTOM_DOMAIN")
    if not aws_custom_domain:
        if AWS_S3_REGION_NAME:
            aws_custom_domain = f"{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com"
        else:
            aws_custom_domain = f"{AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com"
    AWS_S3_CUSTOM_DOMAIN = aws_custom_domain
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL") or None
    AWS_S3_SIGNATURE_VERSION = env("AWS_S3_SIGNATURE_VERSION")
    AWS_QUERYSTRING_AUTH = env.bool("AWS_QUERYSTRING_AUTH")
    AWS_DEFAULT_ACL = env("AWS_DEFAULT_ACL") or None
    AWS_S3_FILE_OVERWRITE = env.bool("AWS_S3_FILE_OVERWRITE")
    AWS_S3_STATIC_LOCATION = env("AWS_S3_STATIC_LOCATION")
    AWS_S3_MEDIA_LOCATION = env("AWS_S3_MEDIA_LOCATION")

    STORAGES["staticfiles"] = {
        "BACKEND": "storages.backends.s3boto3.S3ManifestStaticStorage",
        "OPTIONS": {"location": AWS_S3_STATIC_LOCATION},
    }
    STORAGES["default"] = {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
        "OPTIONS": {
            "location": AWS_S3_MEDIA_LOCATION,
            "file_overwrite": AWS_S3_FILE_OVERWRITE,
        },
    }

    STATIC_URL = env("STATIC_URL", default=f"https://{AWS_S3_CUSTOM_DOMAIN}/{AWS_S3_STATIC_LOCATION}/")  # type: ignore[arg-type]
    media_base_default = f"https://{AWS_S3_CUSTOM_DOMAIN}/" if AWS_S3_CUSTOM_DOMAIN else ""
    MEDIA_URL = env("MEDIA_URL", default=media_base_default)  # type: ignore[arg-type]


DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
