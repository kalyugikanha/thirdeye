import sqlite3
import json

con = sqlite3.connect('/var/www/thirdeye/apps/api/thirdeye.db')
cur = con.cursor()

cur.execute("""
    SELECT id, session_id, url, properties, created_at 
    FROM events 
    WHERE event_type = 'form_abandon' 
    LIMIT 10
""")
rows = cur.fetchall()
print(f"Sample form_abandon events ({len(rows)}):")
for r in rows[:5]:
    print("ID:", r[0], "Session:", r[1], "URL:", r[2], "Created:", r[4])
    print("Props:", r[3])

# Check cart or checkout events
cur.execute("""
    SELECT event_type, url, count(*) 
    FROM events 
    WHERE url LIKE '%checkout%' OR url LIKE '%cart%'
    GROUP BY event_type, url
    ORDER BY count(*) DESC
    LIMIT 10
""")
print("\nCart & Checkout events breakdown:")
for r in cur.fetchall():
    print(r)

con.close()
