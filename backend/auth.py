"""
Minimal email + password auth with JWT. Users stored in SQLite (data/users.db).

Endpoints (wired in main.py):
  POST /auth/register {email, password, name, role}
  POST /auth/login    {email, password}  -> {access_token}
  GET  /auth/me       (Bearer token)     -> {id, email, name, role}

Roles: user | facilitator | admin  (facilitator/admin can view escalations)
"""
import os
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr

import config

DB_PATH = (config.RAW_DIR.parent / "users.db")
JWT_SECRET = os.getenv("JWT_SECRET", "change-me-in-.env")
JWT_ALG = "HS256"
TOKEN_HOURS = 24 * 7

bearer = HTTPBearer(auto_error=False)


# ---------- db ----------

def _conn():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user',
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL
        )""")


# ---------- schemas ----------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "user"          # user | facilitator | admin


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: str


# ---------- helpers ----------

def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def _verify(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def _token(user_id: int, role: str) -> str:
    exp = datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS)
    return jwt.encode({"sub": str(user_id), "role": role, "exp": exp}, JWT_SECRET, algorithm=JWT_ALG)


def _row_to_user(r) -> UserOut:
    return UserOut(id=r["id"], email=r["email"], name=r["name"], role=r["role"])


# ---------- operations ----------

def register(data: RegisterIn) -> UserOut:
    if len(data.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    role = data.role if data.role in ("user", "facilitator") else "user"   # admin only via DB
    try:
        with _conn() as c:
            cur = c.execute(
                "INSERT INTO users (email, name, role, password_hash, created_at) VALUES (?,?,?,?,?)",
                (data.email.lower(), data.name.strip(), role, _hash(data.password),
                 datetime.now(timezone.utc).isoformat()),
            )
            return UserOut(id=cur.lastrowid, email=data.email.lower(), name=data.name.strip(), role=role)
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists")


def login(data: LoginIn) -> dict:
    with _conn() as c:
        r = c.execute("SELECT * FROM users WHERE email = ?", (data.email.lower(),)).fetchone()
    if not r or not _verify(data.password, r["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password")
    return {"access_token": _token(r["id"], r["role"]), "token_type": "bearer", "user": _row_to_user(r)}


def current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)) -> Optional[UserOut]:
    """Optional auth: returns None when no/invalid token (so /chat still works for guests)."""
    if not creds:
        return None
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.PyJWTError:
        return None
    with _conn() as c:
        r = c.execute("SELECT * FROM users WHERE id = ?", (int(payload["sub"]),)).fetchone()
    return _row_to_user(r) if r else None


def require_user(user: Optional[UserOut] = Depends(current_user)) -> UserOut:
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Login required")
    return user


def require_role(*roles):
    def dep(user: UserOut = Depends(require_user)) -> UserOut:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed for your role")
        return user
    return dep
