from __future__ import annotations

import os
from pathlib import Path

__version__ = "0.1.0"


def load_dotenv():
    """Load environment variables from local .env or .env.local if present."""
    here = Path(__file__).resolve().parent
    candidates = [
        here.parent / ".env",
        here.parent.parent / ".env.local",
        here.parent.parent / ".env",
    ]
    for env_path in candidates:
        if env_path.is_file():
            try:
                for line in env_path.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, v = line.split("=", 1)
                        k, v = k.strip(), v.strip().strip("\"'")
                        if k and k not in os.environ:
                            os.environ[k] = v
            except Exception:
                pass


load_dotenv()

