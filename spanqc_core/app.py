"""Uvicorn entrypoint for the SPANQC core verification service."""
from spanqc_core.api import app, create_app

__all__ = ["app", "create_app"]
