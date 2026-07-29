import sqlite3

db=sqlite3.connect("/app/data/clinic.db")
count=db.execute("""SELECT COUNT(1) FROM crm_conversations cv
                    JOIN crm_contacts ct ON ct.id=cv.contact_id
                    WHERE ct.is_internal=1
                      AND (cv.assigned_user_id IS NOT NULL OR cv.queue_entered_at IS NOT NULL)""").fetchone()[0]
assert count == 0, count
print("internal-crm-rule-ok", count)
