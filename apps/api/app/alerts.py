import urllib.request as ur
import json
import logging
from datetime import datetime
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger('alerts')

def dispatch_alert(db: Session, organization_id: int, title: str, message: str, alert_type: str = 'error', metadata: dict = None):
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

    color_map = {
        'error': '#ef4444',    # Red
        'success': '#10b981',  # Green (Recovery)
        'warning': '#f59e0b',  # Amber (Degraded)
        'info': '#3b82f6'      # Blue
    }
    hex_color = color_map.get(alert_type, '#3b82f6')
    int_color = int(hex_color.replace('#', ''), 16)

    for ch in channels:
        try:
            cfg = ch.config or {}
            url = cfg.get('url') or cfg.get('webhook_url')

            # Slack
            if ch.type == 'slack' and url:
                payload = {
                    'text': f"*{title}*\n{message}",
                    'attachments': [{
                        'color': hex_color,
                        'text': message,
                        'footer': 'ThirdEye Observability Suite',
                        'ts': int(datetime.utcnow().timestamp())
                    }]
                }
                req = ur.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json', 'User-Agent': 'ThirdEye-Alert/2.0'})
                ur.urlopen(req, timeout=5)

            # Discord with rich embeds
            elif ch.type == 'discord' and url:
                payload = {
                    'username': 'ThirdEye Monitor',
                    'embeds': [{
                        'title': title,
                        'description': message,
                        'color': int_color,
                        'timestamp': datetime.utcnow().isoformat() + 'Z',
                        'footer': {'text': 'ThirdEye Continuous Observability'}
                    }]
                }
                req = ur.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 ThirdEye-Alert/2.0'})
                ur.urlopen(req, timeout=5)

            # Telegram Bot
            elif ch.type == 'telegram':
                bot_token = cfg.get('bot_token')
                chat_id = cfg.get('chat_id')
                if bot_token and chat_id:
                    tg_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                    tg_payload = {
                        'chat_id': chat_id,
                        'text': f"*{title}*\n\n{message}",
                        'parse_mode': 'Markdown'
                    }
                    req = ur.Request(tg_url, data=json.dumps(tg_payload).encode('utf-8'), headers={'Content-Type': 'application/json'})
                    ur.urlopen(req, timeout=5)

            # Custom Webhook (JSON Payload)
            elif ch.type in ('webhook', 'custom') and url:
                payload = {
                    'event': f'alert.{alert_type}',
                    'title': title,
                    'message': message,
                    'type': alert_type,
                    'organization_id': organization_id,
                    'timestamp': datetime.utcnow().isoformat() + 'Z',
                    'metadata': metadata or {}
                }
                req = ur.Request(url, data=json.dumps(payload).encode('utf-8'), headers={'Content-Type': 'application/json', 'User-Agent': 'ThirdEye-Webhook/2.0'})
                ur.urlopen(req, timeout=5)

        except Exception as e:
            logger.error(f'Failed to dispatch alert channel {ch.id} ({ch.type}): {e}')
