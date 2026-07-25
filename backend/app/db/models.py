import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship, sessionmaker

from app.config import settings


class Base(DeclarativeBase):
    pass


class MedCategory(str, enum.Enum):
    nhs_prescription = "nhs_prescription"
    otc = "otc"
    online = "online"


class Medication(Base):
    __tablename__ = "medications"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    display_name: Mapped[str] = mapped_column(String(512))
    dmd_code: Mapped[str | None] = mapped_column(String(64), nullable=True)
    dmd_code_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    gtin: Mapped[str | None] = mapped_column(String(32), nullable=True)
    category: Mapped[MedCategory] = mapped_column(Enum(MedCategory))
    dosage: Mapped[str] = mapped_column(String(256))
    schedule: Mapped[str] = mapped_column(Text, default="{}")
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class InteractionRecord(Base):
    __tablename__ = "interaction_records"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    med_a_id: Mapped[int] = mapped_column(ForeignKey("medications.id"))
    med_b_id: Mapped[int] = mapped_column(ForeignKey("medications.id"))
    severity: Mapped[str] = mapped_column(String(32))
    summary: Mapped[str] = mapped_column(Text)
    full_text: Mapped[str] = mapped_column(Text)
    sources: Mapped[str] = mapped_column(Text, default="[]")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    med_a: Mapped["Medication"] = relationship(
        foreign_keys=[med_a_id], lazy="joined"
    )
    med_b: Mapped["Medication"] = relationship(
        foreign_keys=[med_b_id], lazy="joined"
    )


class ApiCacheEntry(Base):
    """Cached third-party API responses, keyed by request fingerprint.

    Exists so a repeated interaction check costs zero MedData quota.
    """

    __tablename__ = "api_cache_entries"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    cache_key: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    payload: Mapped[str] = mapped_column(Text)
    fetched_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class ProviderState(Base):
    """Per-provider circuit breaker, e.g. a MedData quota cooldown after a 429."""

    __tablename__ = "provider_state"

    provider: Mapped[str] = mapped_column(String(32), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), default="ok")
    blocked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class GpShareToken(Base):
    __tablename__ = "gp_share_tokens"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    token: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    patient_label: Mapped[str | None] = mapped_column(String(256), nullable=True)
    snapshot_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


engine = create_engine(
    f"sqlite:///{settings.app_db_path}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_app_db() -> None:
    settings.app_db_path.parent.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    _ensure_gp_share_snapshot_column()


def _ensure_gp_share_snapshot_column() -> None:
    from sqlalchemy import inspect, text

    insp = inspect(engine)
    if "gp_share_tokens" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("gp_share_tokens")}
    if "snapshot_json" not in cols:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE gp_share_tokens ADD COLUMN snapshot_json TEXT"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
