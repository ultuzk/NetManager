import os
from cryptography.fernet import Fernet
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./data/netmanager.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# --- 密码加密工具 ---
_ENCRYPTION_KEY_FILE = os.path.join(os.path.dirname(__file__), "..", ".encryption_key")

def _get_or_create_key() -> bytes:
    if os.path.exists(_ENCRYPTION_KEY_FILE):
        with open(_ENCRYPTION_KEY_FILE, "rb") as f:
            return f.read()
    key = Fernet.generate_key()
    os.makedirs(os.path.dirname(_ENCRYPTION_KEY_FILE), exist_ok=True)
    with open(_ENCRYPTION_KEY_FILE, "wb") as f:
        f.write(key)
    os.chmod(_ENCRYPTION_KEY_FILE, 0o600)
    return key

_fernet = Fernet(_get_or_create_key())

def encrypt_password(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()

def decrypt_password(cipher: str) -> str:
    return _fernet.decrypt(cipher.encode()).decode()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
