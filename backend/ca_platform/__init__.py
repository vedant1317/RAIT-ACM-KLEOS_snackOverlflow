"""CA-firm B2B SaaS platform built on top of the Munshi compliance brain.

This package is multi-tenant (firm -> clients -> invoices/GSTR-2B) and reuses
the deterministic money math from ``backend.core`` (itc_engine, hsn_lookup,
recommendation_engine). It persists to a local JSON file so it runs with no
MongoDB, and exposes a REST API plus an ERP-integration ingestion endpoint.
"""
