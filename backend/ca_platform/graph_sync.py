"""Syncs CA-platform data from MongoDB into Neo4j as a supplier-client risk
graph. MongoDB stays the single source of truth for every number — Neo4j is
a derived, queryable view purpose-built for graph traversal and the 3D
vendor-risk visualization; nothing else in the app reads from it.

Graph shape:
  (:Client {id, name, gstin, industry, health_score, itc_at_risk, total_issues})
  (:Supplier {gstin, name, rating, risk_score, risk_level, clients_affected,
              total_itc_at_risk, unresolved_amount})
  (:Client)-[:DEALS_WITH {invoice_count, total_value, issue_count,
                           missing_from_2b_count, rupee_at_risk}]->(:Supplier)

A full sync clears and rebuilds both node labels each time — at hackathon
scale (tens of clients/suppliers) a full rebuild is simpler and cheaper than
incremental diffing, and guarantees no stale nodes survive a removed client.
"""

from __future__ import annotations

from ..db.neo4j_client import get_driver
from . import risk_forecast, service, store, vendor_scorecard


def _aggregate_edges(invoices: list[dict], issues: list[dict]) -> dict[tuple[str, str], dict]:
    edges: dict[tuple[str, str], dict] = {}

    def _bucket(client_id: str, gstin: str) -> dict:
        return edges.setdefault(
            (client_id, gstin),
            {"invoice_count": 0, "total_value": 0.0, "issue_count": 0, "missing_from_2b_count": 0, "rupee_at_risk": 0.0},
        )

    for invoice in invoices:
        gstin = str(invoice.get("vendor_gstin", "")).strip().upper()
        if not gstin:
            continue
        agg = _bucket(invoice["client_id"], gstin)
        agg["invoice_count"] += 1
        agg["total_value"] += float(invoice.get("gst_amount") or 0)

    for issue in issues:
        agg = _bucket(issue["client_id"], issue["vendor_gstin"])
        agg["issue_count"] += 1
        if issue["status"] in ("open", "chasing"):
            agg["rupee_at_risk"] += issue["rupee_impact"]
        if issue["type"] == "missing_from_2b":
            agg["missing_from_2b_count"] += 1

    return edges


def _clear_graph(tx) -> None:
    tx.run("MATCH (n) WHERE n:Client OR n:Supplier DETACH DELETE n")


def _upsert_client(tx, client: dict) -> None:
    tx.run(
        """
        MERGE (c:Client {id: $id})
        SET c.name = $name, c.gstin = $gstin, c.industry = $industry,
            c.health_score = $health_score, c.itc_at_risk = $itc_at_risk,
            c.total_issues = $total_issues
        """,
        id=client["id"],
        name=client["name"],
        gstin=client.get("gstin", ""),
        industry=client.get("industry", ""),
        health_score=client["summary"]["health_score"],
        itc_at_risk=client["summary"]["itc_at_risk"],
        total_issues=client["summary"]["total_issues"],
    )


def _upsert_supplier(tx, card: dict, forecast: dict) -> None:
    tx.run(
        """
        MERGE (s:Supplier {gstin: $gstin})
        SET s.name = $name, s.rating = $rating, s.risk_score = $risk_score,
            s.risk_level = $risk_level, s.clients_affected = $clients_affected,
            s.total_itc_at_risk = $total_itc_at_risk, s.unresolved_amount = $unresolved_amount
        """,
        gstin=card["vendor_gstin"],
        name=card["vendor_name"],
        rating=card["rating"],
        risk_score=forecast.get("risk_score", 0),
        risk_level=forecast.get("risk_level", "low"),
        clients_affected=card["clients_affected"],
        total_itc_at_risk=card["total_itc_at_risk"],
        unresolved_amount=card["unresolved_amount"],
    )


def _upsert_edge(tx, client_id: str, gstin: str, agg: dict) -> None:
    tx.run(
        """
        MATCH (c:Client {id: $client_id})
        MATCH (s:Supplier {gstin: $gstin})
        MERGE (c)-[r:DEALS_WITH]->(s)
        SET r.invoice_count = $invoice_count, r.total_value = $total_value,
            r.issue_count = $issue_count, r.missing_from_2b_count = $missing_from_2b_count,
            r.rupee_at_risk = $rupee_at_risk
        """,
        client_id=client_id,
        gstin=gstin,
        **agg,
    )


def sync_to_neo4j() -> dict:
    """Rebuild the Neo4j graph from current MongoDB state."""
    clients = service.list_clients()
    invoices = store.list_invoices_for_firm()
    issues = store.list_issues()

    scorecards = {c["vendor_gstin"]: c for c in vendor_scorecard.build_scorecard(issues)}
    forecasts = {f["vendor_gstin"]: f for f in risk_forecast.forecast_for_firm()}
    edges = _aggregate_edges(invoices, issues)

    # A supplier may have only clean invoices (no issues at all) and so
    # never show up in the issue-derived scorecard — still give it a node,
    # with a default green/low-risk card, so clean relationships are
    # visible in the graph too, not just risky ones.
    invoices_by_gstin: dict[str, dict] = {}
    for invoice in invoices:
        gstin = str(invoice.get("vendor_gstin", "")).strip().upper()
        if gstin and gstin not in invoices_by_gstin:
            invoices_by_gstin[gstin] = invoice

    for (_, gstin) in edges:
        if gstin not in scorecards:
            sample = invoices_by_gstin.get(gstin, {})
            scorecards[gstin] = {
                "vendor_gstin": gstin,
                "vendor_name": sample.get("vendor_name", gstin),
                "rating": "green",
                "clients_affected": 0,
                "total_itc_at_risk": 0.0,
                "unresolved_amount": 0.0,
            }

    driver = get_driver()
    with driver.session() as session:
        session.execute_write(_clear_graph)
        for client in clients:
            session.execute_write(_upsert_client, client)
        for gstin, card in scorecards.items():
            session.execute_write(_upsert_supplier, card, forecasts.get(gstin, {}))
        for (client_id, gstin), agg in edges.items():
            session.execute_write(_upsert_edge, client_id, gstin, agg)

    return {"clients_synced": len(clients), "suppliers_synced": len(scorecards), "edges_synced": len(edges)}


def fetch_graph_3d(client_id: str | None = None) -> dict:
    """Query Neo4j and shape the result as ``{nodes, links}`` for a
    force-directed 3D graph component."""
    driver = get_driver()
    query = (
        "MATCH (c:Client {id: $client_id})-[r:DEALS_WITH]->(s:Supplier) RETURN c, r, s"
        if client_id
        else "MATCH (c:Client)-[r:DEALS_WITH]->(s:Supplier) RETURN c, r, s"
    )

    nodes: dict[str, dict] = {}
    links: list[dict] = []
    with driver.session() as session:
        result = session.run(query, client_id=client_id)
        for record in result:
            c, r, s = record["c"], record["r"], record["s"]
            client_node_id = f"client:{c['id']}"
            supplier_node_id = f"supplier:{s['gstin']}"
            nodes[client_node_id] = {
                "id": client_node_id,
                "type": "client",
                "label": c["name"],
                "health_score": c.get("health_score", 100),
                "itc_at_risk": c.get("itc_at_risk", 0.0),
                "total_issues": c.get("total_issues", 0),
            }
            nodes[supplier_node_id] = {
                "id": supplier_node_id,
                "type": "supplier",
                "label": s["name"],
                "rating": s.get("rating", "green"),
                "risk_score": s.get("risk_score", 0),
                "risk_level": s.get("risk_level", "low"),
                "clients_affected": s.get("clients_affected", 0),
                "total_itc_at_risk": s.get("total_itc_at_risk", 0.0),
                "unresolved_amount": s.get("unresolved_amount", 0.0),
            }
            links.append(
                {
                    "source": client_node_id,
                    "target": supplier_node_id,
                    "invoice_count": r.get("invoice_count", 0),
                    "total_value": r.get("total_value", 0.0),
                    "issue_count": r.get("issue_count", 0),
                    "missing_from_2b_count": r.get("missing_from_2b_count", 0),
                    "rupee_at_risk": r.get("rupee_at_risk", 0.0),
                }
            )

    return {"nodes": list(nodes.values()), "links": links}
