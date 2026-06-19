from __future__ import annotations

import os
from functools import lru_cache

from pymongo import MongoClient
from pymongo.database import Database


@lru_cache(maxsize=1)
def get_client() -> MongoClient:
    uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
    return MongoClient(uri)


def get_db() -> Database:
    db_name = os.environ.get("MONGODB_DB_NAME", "munshi")
    return get_client()[db_name]
