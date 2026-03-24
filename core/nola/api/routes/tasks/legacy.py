"""Legacy task routes that reuse canonical task handlers."""

from fastapi import APIRouter

from nola.api.routes.tasks.actions import router as tasks_actions_router
from nola.api.routes.tasks.export import router as tasks_export_router
from nola.api.routes.tasks.read import router as tasks_read_router

router = APIRouter(prefix="/api/transcriptions", tags=["transcriptions"])
router.include_router(tasks_read_router, deprecated=True)
router.include_router(tasks_actions_router, deprecated=True)
router.include_router(tasks_export_router, deprecated=True)
