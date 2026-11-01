"""
NxtPak AI — FastAPI Application Entry Point
Intelligent packaging optimization tool for industrial engineers.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.database import init_db
from app.geometry.engine_interface import get_active_engine
from app.standards.registry import get_registry

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("nxtpak")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Startup and shutdown lifecycle handler."""
    logger.info("Initializing NxtPak database...")
    init_db()

    # Run v6 schema migration: add new columns, purge legacy fake demo projects
    from app.core.migration import run_database_migrations
    run_database_migrations()

    active_geom = get_active_engine()
    logger.info("Active Geometry Engine: %s", active_geom)

    # Pre-load standards registry
    reg = get_registry()
    try:
        reg.load()
        logger.info(
            "Standards registry loaded (%d standards)", len(reg.get_all_standards())
        )
    except Exception as exc:
        logger.error("Failed to preload standards registry: %s", exc)

    logger.info("%s v%s ready", settings.app_name, settings.app_version)
    yield
    logger.info("NxtPak shutting down...")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "NxtPak AI recommends right-sized packaging, displays 3D views (Exterior/Interior), "
        "calculates material & cost savings, and evaluates against the ISO packaging standards registry."
    ),
    lifespan=lifespan,
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API v1 router
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/api/health", tags=["System"])
@app.get("/health", tags=["System"])
def health_check() -> dict[str, Any]:
    """Basic health check and system information including real LLM status."""
    from app.services.assistant_service import get_llm_config
    llm_cfg = get_llm_config()
    llm_online = bool(llm_cfg.get("api_key"))

    return {
        "status": "healthy",
        "app_name": settings.app_name,
        "version": settings.app_version,
        "geometry_engine": get_active_engine(),
        "standards_version": "v1",
        "llm_status": "online" if llm_online else "offline",
        "llm_provider": llm_cfg.get("provider", "anthropic"),
        "llm_model": llm_cfg.get("model", "claude-3-5-sonnet-20241022"),
    }


@app.get("/", tags=["System"])
def root_endpoint() -> dict[str, str]:
    """Root welcome endpoint with docs link."""
    return {
        "message": f"Welcome to {settings.app_name} API",
        "docs": "/docs",
        "version": settings.app_version,
    }
