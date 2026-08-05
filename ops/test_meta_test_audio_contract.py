"""Static safety contract for the isolated Meta audio laboratory.

The production process must never gain a Meta media send/download path merely by
loading this module.  Behavioural Cloud API tests are performed only against the
explicitly configured test number.
"""
from pathlib import Path


SOURCE = (Path(__file__).resolve().parents[1] / "app" / "server.py").read_text(encoding="utf-8")


def require(fragment: str) -> None:
    assert fragment in SOURCE, f"missing contract: {fragment}"


require('META_TEST_ACCESS_TOKEN = os.environ.get("META_TEST_ACCESS_TOKEN", "").strip()')
require('if not META_TEST_MODE:\n            raise RuntimeError("A API da Meta')
require('def download_meta_test_audio(')
require('def send_meta_test_audio(')
require('def send_meta_test_text(')
require('if row["instance_name"] == "meta-test-whatsapp":')
require('return self.send_crm_meta_test_audio_message(')
require('return self.send_crm_meta_test_text_message(')
require('f"/api/crm/media/{file_name}"')
require('"type": "audio", "audio": {"id": media_id}')
require('"type": "text", "text": {"body": body}')

print("meta-test-audio-contract-ok")
