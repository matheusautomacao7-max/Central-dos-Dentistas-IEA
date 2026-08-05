"""Static checks that the Meta laboratory is isolated from production services."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
COMPOSE = (ROOT / "ops" / "meta-test-compose.yaml").read_text(encoding="utf-8")
ENV_EXAMPLE = (ROOT / "ops" / "meta-test.env.example").read_text(encoding="utf-8")

assert "instituto-ayub-meta-test-postgres" in COMPOSE
assert "instituto_ayub_meta_test" in COMPOSE
assert "127.0.0.1:8001:8000" in COMPOSE
assert "meta_test_postgres_data" in COMPOSE
assert "evolution" not in COMPOSE.lower()
assert "n8n" not in COMPOSE.lower()
assert "OPENAI_API_KEY" not in COMPOSE
assert "META_TEST_HOST" in COMPOSE
assert "AUTH_SETUP_TOKEN" in ENV_EXAMPLE
assert "Nunca reutilize o .env da produção" in ENV_EXAMPLE

assert "../" not in COMPOSE

print("meta-test-environment-ok")
