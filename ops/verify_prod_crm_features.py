import sqlite3

db = sqlite3.connect('/app/data/clinic.db')
assert any(row[1] == 'crm_feature_scope_enabled' for row in db.execute('PRAGMA table_info(users)'))
assert db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='crm_user_features'").fetchone()
print('crm-screen-permissions-db-ok')
