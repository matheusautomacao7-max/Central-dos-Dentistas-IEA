import sys
from http import HTTPStatus

sys.path.insert(0, '/app')
import server

with server.connect() as db:
    user = db.execute("SELECT id,name FROM users WHERE access_role='crc' AND active=1 ORDER BY id LIMIT 1").fetchone()
    message = db.execute("""SELECT id FROM crm_messages
        WHERE message_type='audio' AND external_message_id IS NOT NULL
          AND (media_url IS NULL OR media_url NOT LIKE '/api/crm/media/%')
        ORDER BY id DESC LIMIT 1""").fetchone()
if not user or not message:
    print('audio-recovery-skip')
    raise SystemExit(0)

handler = server.ClinicHandler.__new__(server.ClinicHandler)
handler.authenticated_user = {'id': user['id'], 'name': user['name'], 'access_role': 'crc'}
handler.require_crc_access = lambda: True
handler.responses = []
handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))
handler.get_crm_media = lambda file_name: handler.responses.append((200, {'cached_file': file_name}))
handler.get_crm_message_media(message['id'])
status, payload = handler.responses[-1]
if status != 200 or not payload.get('cached_file'):
    raise SystemExit(f'audio-recovery-failed:{status}:{payload.get("error", "unknown")}')
print('audio-recovery-ok')
