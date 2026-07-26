from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_BACKEND_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    dmd_db_path: Path = _BACKEND_ROOT / "data" / "dmd.sqlite"
    app_db_path: Path = _BACKEND_ROOT / "data" / "app.sqlite"
    # Supabase Postgres (transaction pooler). Empty = local app.sqlite
    app_database_url: str = ""
    trud_api_key: str = ""
    trud_dmd_item_id: str = ""
    openfda_api_key: str = ""
    meddata_api_key: str = ""
    meddata_base_url: str = "https://meddata.anthesia.io"
    meddata_cache_ttl_hours: int = 24
    meddata_quota_cooldown_hours: int = 6
    suppai_cache_ttl_hours: int = 168
    gp_token_ttl_hours: int = 48
    public_base_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:3000,http://localhost:5173,http://localhost:8000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def uses_postgres_app_db(self) -> bool:
        return bool(self.app_database_url.strip())


settings = Settings()

DISCLAIMER = (
    "This information is for awareness only and is not medical advice. "
    "Discuss with a pharmacist or GP before changing your medicines."
)
