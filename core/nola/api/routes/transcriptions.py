"""Backward-compatible task router composition."""

from fastapi import APIRouter

from nola.api.routes.tasks.actions import router as tasks_actions_router
from nola.api.routes.tasks.export import router as tasks_export_router
from nola.api.routes.tasks.legacy import router as legacy_router
from nola.api.routes.tasks.read import router as tasks_read_router

router = APIRouter(prefix="/api/transcription-tasks", tags=["transcription-tasks"])
router.include_router(tasks_read_router)
router.include_router(tasks_actions_router)
router.include_router(tasks_export_router)

__all__ = ["router", "legacy_router"]
