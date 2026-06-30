"""
Authentication module for Sentiment Analyzer API.
Provides JWT-based authentication with bcrypt-hashed passwords.
"""

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel


# ── Configuration ────────────────────────────────────────────────────────────
# Use a stable key so that server restarts (--reload) don't invalidate tokens.
# In production, set the SENTIMENT_APP_SECRET_KEY environment variable.
SECRET_KEY = os.environ.get(
    "SENTIMENT_APP_SECRET_KEY",
    "his-project-sentiment-analyzer-dev-secret-key-2026"
)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


# ── Password Hashing Helpers ────────────────────────────────────────────────
def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a bcrypt hash."""
    return bcrypt.checkpw(
        plain_password.encode("utf-8"), hashed_password.encode("utf-8")
    )


# ── User Store ───────────────────────────────────────────────────────────────
# Pre-hashed passwords for the two users (same credentials as before)
USERS_DB = {
    "admin1": {
        "username": "admin1",
        "hashed_password": hash_password("franca@15"),
        "role": "admin",
    },
    "user1": {
        "username": "user1",
        "hashed_password": hash_password("space@15"),
        "role": "user",
    },
}


# ── Pydantic Models ─────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str


class UserInfo(BaseModel):
    username: str
    role: str


# ── JWT Helpers ──────────────────────────────────────────────────────────────
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a new JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict:
    """Decode and verify a JWT token. Raises JWTError on failure."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])


# ── Authentication Helpers ───────────────────────────────────────────────────
def authenticate_user(username: str, password: str) -> Optional[dict]:
    """Validate username/password against the user store."""
    user = USERS_DB.get(username)
    if not user:
        return None
    if not verify_password(password, user["hashed_password"]):
        return None
    return user


# ── FastAPI Dependency ───────────────────────────────────────────────────────
security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> UserInfo:
    """
    FastAPI dependency that extracts and validates the JWT from the
    Authorization header. Use as: Depends(get_current_user)
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = verify_token(credentials.credentials)
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = USERS_DB.get(username)
    if user is None:
        raise credentials_exception

    return UserInfo(username=user["username"], role=user["role"])
