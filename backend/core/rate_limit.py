"""Lightweight in-memory rate limiting for public routes — no Redis, no new
dependency. Fine for a single-process deployment; swap the bucket store for
a shared one (Redis) before running multiple backend replicas.
"""

from __future__ import annotations

import os
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

_WINDOW_SECONDS = 60
_MAX_REQUESTS = int(os.environ.get("RATE_LIMIT_PER_MINUTE", "120"))
_EXEMPT_PATHS = {"/health", "/docs", "/openapi.json"}

_hits: dict[str, deque] = defaultdict(deque)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path in _EXEMPT_PATHS:
            return await call_next(request)
        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{request.url.path}"
        now = time.monotonic()
        bucket = _hits[key]
        while bucket and now - bucket[0] > _WINDOW_SECONDS:
            bucket.popleft()
        if len(bucket) >= _MAX_REQUESTS:
            return JSONResponse(status_code=429, content={"detail": "Too many requests, slow down."})
        bucket.append(now)
        return await call_next(request)
