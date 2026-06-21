"""Shared domain exceptions used below the API layer."""
from __future__ import annotations


class HazardMapError(Exception):
    """Base class for service-layer errors."""


class NotFoundError(HazardMapError):
    """Raised when a requested domain object does not exist."""


class ValidationError(HazardMapError):
    """Raised when input is validly shaped but fails domain validation."""


class ServiceUnavailableError(HazardMapError):
    """Raised when a required backend service cannot accept work."""

