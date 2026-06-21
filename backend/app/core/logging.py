"""Logging helpers for backend modules.

Importing this module is intentionally side-effect light: it only configures
the root logger when no handlers exist, which prevents duplicate log lines in
tests and reloads.
"""
from __future__ import annotations

import logging

_FORMAT = "%(asctime)s %(name)s %(levelname)s %(message)s"


def configure_logging(level: int = logging.INFO) -> None:
    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    if root_logger.handlers:
        return

    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(_FORMAT))
    root_logger.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    configure_logging()
    return logging.getLogger(name)
