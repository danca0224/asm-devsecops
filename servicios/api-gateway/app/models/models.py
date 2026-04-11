from sqlalchemy import Column, Integer, String, Boolean, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.database import Base


class User(Base):
    __tablename__ = "app_users"

    id            = Column(Integer, primary_key=True, index=True)
    username      = Column(String(64), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    is_active     = Column(Boolean, default=True)
    role          = Column(String(16), default="user")
    created_at    = Column(DateTime(timezone=True), server_default=func.now())


class Scan(Base):
    __tablename__ = "scans"

    id            = Column(Integer, primary_key=True, index=True)
    domain        = Column(String(255), nullable=False)
    status        = Column(String(32), default="pending")
    user_id       = Column(Integer, ForeignKey("app_users.id"))
    created_at    = Column(DateTime(timezone=True), server_default=func.now())
    completed_at  = Column(DateTime(timezone=True))
    csv_path      = Column(Text)
    error_message = Column(Text)


class Report(Base):
    __tablename__ = "reports"

    id         = Column(Integer, primary_key=True, index=True)
    scan_id    = Column(Integer, ForeignKey("scans.id"))
    format     = Column(String(16))
    path       = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
