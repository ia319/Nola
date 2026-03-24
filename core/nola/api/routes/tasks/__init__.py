"""Task route modules grouped by responsibility."""

from nola.api.routes.tasks.actions import router as actions_router
from nola.api.routes.tasks.export import router as export_router
from nola.api.routes.tasks.legacy import router as legacy_router
from nola.api.routes.tasks.read import router as read_router

__all__ = ["actions_router", "export_router", "legacy_router", "read_router"]
