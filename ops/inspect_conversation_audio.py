import sqlite3

db = sqlite3.connect("/app/data/clinic.db")
db.row_factory = sqlite3.Row
rows = db.execute(
    """SELECT id, external_message_id, direction, message_type, body,
              media_url, mime_type, author_label, message_at
         FROM crm_messages
        WHERE conversation_id = ?
        ORDER BY id DESC LIMIT 8""",
    (82322,),
).fetchall()
for row in rows:
    item = dict(row)
    item["external_message_id"] = bool(item["external_message_id"])
    print(item)
