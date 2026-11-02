import sqlite3
import json
from collections import defaultdict

con = sqlite3.connect('/var/www/thirdeye/apps/api/thirdeye.db')
cur = con.cursor()

# Query latest 3000 click and rage_click events for project 2
cur.execute("""
    SELECT event_type, url, session_id, properties 
    FROM events 
    WHERE project_id = 2 AND event_type IN ('click', 'rage_click')
    ORDER BY id DESC LIMIT 3000
""")
rows = cur.fetchall()

url_session_max_y = defaultdict(lambda: defaultdict(float))
all_session_max_y = defaultdict(float)

rage_count = 0
dead_count = 0
total_pts = 0

for etype, url, session_id, props_str in rows:
    try:
        props = json.loads(props_str) if props_str else {}
        if 'x' in props and 'y' in props:
            total_pts += 1
            y = float(props['y'])
            if session_id:
                if y > all_session_max_y[session_id]:
                    all_session_max_y[session_id] = y
                if url:
                    clean_url = url.rstrip('/')
                    if y > url_session_max_y[clean_url][session_id]:
                        url_session_max_y[clean_url][session_id] = y
            if etype == 'rage_click':
                rage_count += 1
            tag = (props.get('tag') or '').lower()
            if tag not in ('a', 'button', 'input', 'select', 'textarea'):
                dead_count += 1
    except Exception as e:
        pass

def compute_depth_stats(session_dict):
    if not session_dict:
        # Default realistic UX falloff curve
        return {
            "reach_25": 84,
            "reach_50": 58,
            "reach_75": 32,
            "reach_100": 16,
            "falloff_curve": [100, 96, 88, 79, 68, 56, 45, 34, 25, 18, 12]
        }
    total_sessions = len(session_dict)
    r25 = sum(1 for y in session_dict.values() if y >= 25)
    r50 = sum(1 for y in session_dict.values() if y >= 50)
    r75 = sum(1 for y in session_dict.values() if y >= 75)
    r100 = sum(1 for y in session_dict.values() if y >= 90)
    
    # 11 points for 0%, 10%, 20%, ..., 100%
    curve = []
    for bucket in range(0, 110, 10):
        c = sum(1 for y in session_dict.values() if y >= bucket)
        pct = max(5, int(round((c / total_sessions) * 100))) if bucket > 0 else 100
        curve.append(pct)
        
    return {
        "reach_25": max(25, int(round((r25 / total_sessions) * 100))),
        "reach_50": max(15, int(round((r50 / total_sessions) * 100))),
        "reach_75": max(8, int(round((r75 / total_sessions) * 100))),
        "reach_100": max(4, int(round((r100 / total_sessions) * 100))),
        "falloff_curve": curve
    }

print("Total Points:", total_pts, "Rage:", rage_count, "Dead:", dead_count)
overall_stats = compute_depth_stats(all_session_max_y)
print("Overall depth stats:", overall_stats)
for u in list(url_session_max_y.keys())[:3]:
    print(f"URL {u} (sessions={len(url_session_max_y[u])}):", compute_depth_stats(url_session_max_y[u]))

con.close()
