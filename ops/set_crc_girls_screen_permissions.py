import sqlite3

db = sqlite3.connect('/app/data/clinic.db')
db.row_factory = sqlite3.Row
features = ('inbox', 'queue', 'funnel', 'management', 'contacts', 'campaigns')
users = db.execute("""SELECT id,name,email FROM users WHERE access_role='crc' AND active=1
                      AND (lower(name) LIKE 'isabela%' OR lower(name) LIKE 'nathalya%' OR lower(name) LIKE 'natalia%')""").fetchall()
for user in users:
    db.execute('DELETE FROM crm_user_features WHERE user_id=?', (user['id'],))
    db.executemany('INSERT INTO crm_user_features(user_id,feature_key) VALUES(?,?)', [(user['id'], key) for key in features])
    db.execute('UPDATE users SET crm_feature_scope_enabled=1 WHERE id=?', (user['id'],))
db.commit()
print('crc-screen-policy-applied:' + ','.join(user['name'] for user in users))
