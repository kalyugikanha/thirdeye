import urllib.request as ur
import json
import logging
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger('alerts')

def dispatch_alert(db: Session, organization_id: int, title: str, message: str, alert_type: str = 'error'):
    # 1. Create in-app notification
    notif = models.Notification(
        organization_id=organization_id,
        title=title,
        message=message,
        type=alert_type
    )
    db.add(notif)
    db.commit()

    # 2. Query configured Alert Channels for this organization
    channels = db.query(models.AlertChannel).filter(
        models.AlertChannel.organization_id == organization_id,
        models.AlertChannel.is_active == True
    ).all()

    for ch in channels:
        try:
            cfg = ch.config or {}
            url = cfg.get('url')

            if ch.type == 'slack' and url:
                payload = {
                    'text': f'*:alert: {title}*
{message}',
                    'attachments': [{
                        'color': '#ff0000' if alert_type == 'error' else '#ff9900',
                        'text': message
                    }]
                }
                req = ur.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
                ur.urlopen(req, timeout=5)

            elif ch.type == 'discord' and url:
                payload = {
                    'content': f'**{title}**
{message}'
                }
                req = ur.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json', 'User-Agent': 'ThirdEye-Alert/1.0'})
                ur.urlopen(req, timeout=5)

            elif ch.type == 'webhook' and url:
                payload = {
                    'event': 'alert.triggered',
                    'title': title,
                    'message': message,
                    'type': alert_type,
                    'organization_id': organization_id
                }
                req = ur.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
                ur.urlopen(req, timeout=5)

        except Exception as e:
            logger.error(f'Failed to dispatch alert channel {ch.id} ({ch.type}): {e}')
