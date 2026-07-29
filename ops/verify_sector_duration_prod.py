import sqlite3
from pathlib import Path
import sys

sys.path.insert(0, "/app")
from server import crm_audio_duration_seconds

db = sqlite3.connect("/app/data/clinic.db")
db.row_factory = sqlite3.Row
user_columns = {row[1] for row in db.execute("PRAGMA table_info(users)")}
message_columns = {row[1] for row in db.execute("PRAGMA table_info(crm_messages)")}
assert "service_sector" in user_columns
assert "duration_seconds" in message_columns
sectors = db.execute(
    "SELECT service_sector, COUNT(*) AS total FROM users WHERE access_role='crc' GROUP BY service_sector"
).fetchall()
assert sectors and all(row["service_sector"] for row in sectors)
print("sector-duration-schema-ok", [(row["service_sector"], row["total"]) for row in sectors])

audio = db.execute(
    "SELECT media_url FROM crm_messages WHERE message_type='audio' AND media_url LIKE '/api/crm/media/%' ORDER BY id DESC LIMIT 1"
).fetchone()
if audio:
    media_file = Path("/app/data/crm-media") / str(audio["media_url"]).rsplit("/", 1)[-1]
    duration = crm_audio_duration_seconds(media_file.read_bytes())
    assert duration and duration > 0
    print("latest-audio-duration-ok", duration)
