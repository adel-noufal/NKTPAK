"""
NxtPak AI — API v1 Router
"""

from fastapi import APIRouter
from app.api.v1.endpoints.projects import router as projects_router

api_router = APIRouter()
api_router.include_router(projects_router)
