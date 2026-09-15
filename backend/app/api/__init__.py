from fastapi import APIRouter
from app.api.routes import memories, sandbox, chat, auth, import_chat, auditor

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(memories.router, prefix="/memories", tags=["memories"])
api_router.include_router(sandbox.router, prefix="/sandbox", tags=["sandbox"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(import_chat.router, prefix="/import", tags=["import"])
api_router.include_router(auditor.router, prefix="/auditor", tags=["auditor"])

