"""
NxtPak AI — Application Configuration
All settings loaded from environment variables with documented defaults.
Never commit secrets. Use .env file for local development.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent.parent  # repo root


class Settings(BaseSettings):
    # Application
    app_name: str = "NxtPak AI"
    app_version: str = "1.0.0-milestone1"
    debug: bool = Field(default=False, env="DEBUG")
    environment: str = Field(default="development", env="ENVIRONMENT")

    # API
    api_prefix: str = "/api/v1"
    allowed_origins: list[str] = Field(
        default=["http://localhost:5173", "http://127.0.0.1:5173"],
        env="ALLOWED_ORIGINS",
    )

    # Database
    database_url: str = Field(
        default="sqlite+aiosqlite:///./nxtpak.db", env="DATABASE_URL"
    )

    # Standards registry
    standards_registry_path: str = Field(
        default=str(BASE_DIR / "data" / "standards" / "iso_registry.json"),
        env="STANDARDS_REGISTRY_PATH",
    )
    product_examples_dir: str = Field(
        default=str(BASE_DIR / "data" / "product_examples"),
        env="PRODUCT_EXAMPLES_DIR",
    )

    # Geometry engine
    # Options: "trimesh" (preferred), "numpy_only" (fallback)
    geometry_engine: str = Field(default="trimesh", env="GEOMETRY_ENGINE")

    # Packaging optimization defaults (all configurable)
    default_clearance_mm: float = Field(
        default=20.0, env="DEFAULT_CLEARANCE_MM",
        description="Default clearance between product and inner carton wall (mm)"
    )
    default_board_thickness_mm: float = Field(
        default=4.0, env="DEFAULT_BOARD_THICKNESS_MM",
        description="Default corrugated board thickness (mm)"
    )
    default_insert_thickness_mm: float = Field(
        default=25.0, env="DEFAULT_INSERT_THICKNESS_MM",
        description="Default cushioning/insert thickness (mm)"
    )

    # LLM (OPTIONAL — disabled by default, no key needed for core features)
    llm_provider: Optional[str] = Field(default=None, env="LLM_PROVIDER")
    llm_api_key: Optional[str] = Field(default=None, env="LLM_API_KEY")
    llm_model: Optional[str] = Field(default=None, env="LLM_MODEL")

    # Exports
    export_dir: str = Field(default="./exports", env="EXPORT_DIR")
    max_export_age_hours: int = Field(default=24, env="MAX_EXPORT_AGE_HOURS")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8", "extra": "ignore"}


settings = Settings()
