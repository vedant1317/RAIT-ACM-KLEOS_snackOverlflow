"""Supplier-client risk graph API — Neo4j-backed, synced from MongoDB on
demand. Powers the 3D vendor-risk visualization on the CA dashboard.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from . import graph_sync
from .auth import require_ca_auth

router = APIRouter()


@router.post("/graph/sync")
async def sync_graph(_user: dict = Depends(require_ca_auth)) -> dict:
    try:
        return graph_sync.sync_to_neo4j()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Neo4j sync failed: {exc}") from exc


@router.get("/graph/3d")
async def get_graph_3d(client_id: str | None = None, _user: dict = Depends(require_ca_auth)) -> dict:
    try:
        return graph_sync.fetch_graph_3d(client_id=client_id)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Neo4j query failed: {exc}") from exc
