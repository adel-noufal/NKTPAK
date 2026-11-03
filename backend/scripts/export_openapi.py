"""Export FastAPI's Pydantic contract for frontend type generation."""

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app

output = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"
output.write_text(json.dumps(app.openapi(), indent=2), encoding="utf-8")
print(f"Wrote OpenAPI contract: {output}")
