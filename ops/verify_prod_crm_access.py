import sys
from http import HTTPStatus

sys.path.insert(0, '/app')
import server

with server.connect() as db:
    allowed = db.execute("""SELECT u.id AS user_id,cuc.channel_id FROM users u
        JOIN crm_user_channels cuc ON cuc.user_id=u.id
        JOIN crm_channels ch ON ch.id=cuc.channel_id
        WHERE u.access_role='crc' AND u.active=1 AND u.crm_channel_scope_enabled=1
          AND cuc.can_reply=1 AND ch.active=1 AND ch.sync_enabled=1 LIMIT 1""").fetchone()
    denied = db.execute("""SELECT ch.id AS channel_id FROM crm_channels ch
        WHERE ch.active=1 AND ch.id NOT IN
          (SELECT channel_id FROM crm_user_channels WHERE user_id=?) LIMIT 1""",
        (allowed['user_id'],) if allowed else (0,)).fetchone()
if not allowed:
    print('crm-access-skip-no-scoped-user')
    raise SystemExit(0)

handler = server.ClinicHandler.__new__(server.ClinicHandler)
handler.authenticated_user = {'id': 1, 'access_role': 'admin'}
handler.responses = []
handler.send_json = lambda payload, status=HTTPStatus.OK: handler.responses.append((int(status), payload))
handler.test_admin_crm_channel_access({'user_id': allowed['user_id'], 'channel_id': allowed['channel_id']})
assert handler.responses[-1][1]['transfer_allowed'] is True
if denied:
    handler.test_admin_crm_channel_access({'user_id': allowed['user_id'], 'channel_id': denied['channel_id']})
    assert handler.responses[-1][1]['transfer_allowed'] is False
print('crm-transfer-permissions-ok')
