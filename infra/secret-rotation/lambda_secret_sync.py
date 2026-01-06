"""Lambda handler that keeps a custom Secrets Manager secret in sync with the
latest password from the AWS-managed RDS rotation secret.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.parse
from typing import Any, Dict

import boto3
from botocore.exceptions import ClientError

LOGGER = logging.getLogger(__name__)
LOGGER.setLevel(logging.INFO)

SECRETS_MANAGER = boto3.client("secretsmanager")

RDS_SECRET_ARN = os.environ["RDS_SECRET_ARN"]
CUSTOM_SECRET_ARN = os.environ["CUSTOM_SECRET_ARN"]
DEFAULT_DB_NAME = os.environ.get("DB_NAME")
DEFAULT_DB_HOST = os.environ.get("DB_HOST")
DEFAULT_DB_PORT = os.environ.get("DB_PORT", "5432")
DEFAULT_DB_USER = os.environ.get("DB_USERNAME")
PG_SSLMODE = os.environ.get("PG_SSLMODE", "require")


class SecretSyncError(RuntimeError):
    """Raised when the Lambda cannot complete the sync workflow."""


def handler(event: Dict[str, Any], _context: Any) -> Dict[str, Any]:
    """Lambda entrypoint used by EventBridge schedule and manual invocations."""

    LOGGER.info("Starting secret sync run", extra={"event": event})

    rds_secret = _load_secret(RDS_SECRET_ARN)
    custom_secret = _load_secret(CUSTOM_SECRET_ARN)

    updated_secret = _merge_secrets(rds_secret, custom_secret)

    if not updated_secret:
        LOGGER.info("Custom secret already matches rotated password. No update needed.")
        return {"statusCode": 200, "action": "noop"}

    _put_secret(CUSTOM_SECRET_ARN, updated_secret)
    LOGGER.info("Custom secret updated successfully.")

    return {"statusCode": 200, "action": "updated"}


def _load_secret(secret_arn: str) -> Dict[str, Any]:
    try:
        response = SECRETS_MANAGER.get_secret_value(SecretId=secret_arn)
    except ClientError as exc:  # pragma: no cover - boto3 raises at runtime
        raise SecretSyncError(f"Unable to read secret {secret_arn}: {exc}") from exc

    if "SecretString" not in response:
        raise SecretSyncError(f"Secret {secret_arn} did not contain a SecretString")

    return json.loads(response["SecretString"])


def _merge_secrets(rds_secret: Dict[str, Any], custom_secret: Dict[str, Any]) -> Dict[str, Any] | None:
    candidate = dict(custom_secret)

    for key in ("username", "password", "host", "port", "dbname"):
        source_value = rds_secret.get(key)
        if source_value:
            candidate[key] = str(source_value)
        elif key not in candidate:
            fallback = _fallback_value_for(key)
            if fallback:
                candidate[key] = fallback

    candidate["DATABASE_URL"] = _build_connection_string(candidate)

    if candidate == custom_secret:
        return None

    return candidate


def _fallback_value_for(key: str) -> str | None:
    mapping = {
        "username": DEFAULT_DB_USER,
        "host": DEFAULT_DB_HOST,
        "port": DEFAULT_DB_PORT,
        "dbname": DEFAULT_DB_NAME,
    }

    return mapping.get(key)


def _build_connection_string(secret: Dict[str, Any]) -> str:
    username = secret.get("username") or DEFAULT_DB_USER
    password = secret.get("password")
    host = secret.get("host") or DEFAULT_DB_HOST
    port = secret.get("port") or DEFAULT_DB_PORT
    dbname = secret.get("dbname") or DEFAULT_DB_NAME

    if not all([username, password, host, port, dbname]):
        raise SecretSyncError("Missing connection components to build DATABASE_URL")

    user_enc = urllib.parse.quote_plus(str(username))
    pwd_enc = urllib.parse.quote_plus(str(password))
    query = urllib.parse.urlencode({"sslmode": PG_SSLMODE})

    return f"postgres://{user_enc}:{pwd_enc}@{host}:{port}/{dbname}?{query}"


def _put_secret(secret_arn: str, payload: Dict[str, Any]) -> None:
    try:
        SECRETS_MANAGER.put_secret_value(
            SecretId=secret_arn,
            SecretString=json.dumps(payload),
        )
    except ClientError as exc:  # pragma: no cover - boto3 raises at runtime
        raise SecretSyncError(f"Unable to update secret {secret_arn}: {exc}") from exc
