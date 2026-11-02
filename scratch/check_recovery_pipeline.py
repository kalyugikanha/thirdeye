import sqlite3
import json
from collections import defaultdict
from datetime import datetime

con = sqlite3.connect('/var/www/thirdeye/apps/api/thirdeye.db')
cur = con.cursor()

# Check checkout and cart sessions
cur.execute("""
    SELECT e.session_id, e.event_type, e.url, e.properties, e.created_at, r.id as replay_id
    FROM events e
    LEFT JOIN session_recordings r ON r.session_id = e.session_id
    WHERE e.project_id = 2 
      AND (e.url LIKE '%checkout%' OR e.url LIKE '%cart%' OR e.event_type = 'form_abandon')
    ORDER BY e.id DESC
    LIMIT 1000
""")
rows = cur.fetchall()

sessions_map = defaultdict(lambda: {
    'session_id': '',
    'url': '',
    'title': '',
    'events': [],
    'last_field': None,
    'has_replay': False,
    'device': 'desktop',
    'created_at': None,
    'min_time': None,
    'max_time': None,
    'friction_tags': set()
})

for sid, etype, url, props_str, cat, rid in rows:
    if not sid:
        continue
    entry = sessions_map[sid]
    entry['session_id'] = sid
    if rid:
        entry['has_replay'] = True
    if url and ('checkout' in url or not entry['url']):
        entry['url'] = url
        
    try:
        props = json.loads(props_str) if props_str else {}
        if not entry['title'] and props.get('title'):
            entry['title'] = props['title']
        if props.get('last_field'):
            entry['last_field'] = props['last_field']
        elif not entry['last_field'] and props.get('field'):
            entry['last_field'] = props['field']
            
        os_name = (props.get('os') or '').lower()
        if 'android' in os_name or 'ios' in os_name or 'iphone' in os_name:
            entry['device'] = 'mobile'
    except:
        pass
        
    if etype == 'rage_click':
        entry['friction_tags'].add('rage_click')
    if etype == 'form_abandon':
        entry['friction_tags'].add('form_abandon')
        
    entry['events'].append((etype, cat))

abandoned_list = []
for sid, data in sessions_map.items():
    if not data['url']:
        continue
    # Friction enrichment
    tags = list(data['friction_tags'])
    if data['last_field'] and any(k in data['last_field'].lower() for k in ['pay', 'card', 'billing', 'coupon', 'gst']):
        tags.append('payment_friction')
    if not tags:
        tags.append('hesitation')
        
    abandoned_list.append({
        'session_id': sid,
        'url': data['url'],
        'title': data['title'] or 'Checkout Page',
        'last_field': data['last_field'] or 'checkout_form',
        'has_replay': data['has_replay'],
        'device': data['device'],
        'friction_tags': tags[:3],
        'events_count': len(data['events'])
    })

print(f"Total Abandoned Checkout Sessions extracted: {len(abandoned_list)}")
for item in abandoned_list[:5]:
    print(item)

con.close()
