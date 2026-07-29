import json
import sqlite3

db = sqlite3.connect('/app/data/clinic.db')
db.row_factory = sqlite3.Row
rows = db.execute('''SELECT m.id,m.external_message_id,m.direction,m.mime_type,m.media_url,m.message_at,
                            ch.instance_name,ct.phone
                     FROM crm_messages m
                     JOIN crm_conversations cv ON cv.id=m.conversation_id
                     JOIN crm_channels ch ON ch.id=cv.channel_id
                     JOIN crm_contacts ct ON ct.id=cv.contact_id
                     WHERE m.message_type='audio'
                     ORDER BY m.id DESC LIMIT 12''').fetchall()
print(json.dumps({
    'audio_total': db.execute("SELECT COUNT(*) FROM crm_messages WHERE message_type='audio'").fetchone()[0],
    'audio_cached': db.execute("SELECT COUNT(*) FROM crm_messages WHERE message_type='audio' AND media_url LIKE '/api/crm/media/%'").fetchone()[0],
    'recent': [dict(row) for row in rows],
}, ensure_ascii=False))
