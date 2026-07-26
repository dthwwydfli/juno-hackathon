#!/usr/bin/env python3
"""Clear MedData circuit-breaker state after a 403/quota cooldown (local dev aid)."""

from app.services.api_cache import clear_provider_block

if __name__ == "__main__":
    clear_provider_block("meddata")
    print("Cleared meddata provider block. Retry POST /interactions/check after fixing MEDDATA_API_KEY.")
