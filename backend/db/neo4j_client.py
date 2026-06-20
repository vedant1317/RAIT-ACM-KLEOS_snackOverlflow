from __future__ import annotations

import os
from functools import lru_cache

from neo4j import Driver, GraphDatabase


@lru_cache(maxsize=1)
def get_driver() -> Driver:
    uri = os.environ["NEO4J_URI"]
    user = os.environ.get("NEO4J_USER", "neo4j")
    password = os.environ["NEO4J_PASSWORD"]
    return GraphDatabase.driver(uri, auth=(user, password))


def close_driver() -> None:
    if get_driver.cache_info().currsize:
        get_driver().close()
        get_driver.cache_clear()
