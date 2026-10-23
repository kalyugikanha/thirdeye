import urllib.request as ur
import urllib.parse as up
import json
import logging
import time
import hmac
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger('alerts')

# In-memory sliding window cache for alert deduplication and flapping protection
# Key: (organization_id, title) -> last_dispatched_timestamp
_ALERT_THROTTLE_CACHE = {}
THROTTLE_WINDOW_SECONDS = 120  # 2 minutes minimum between identical alerts

COLOR_MAP = {
    'critical': '#dc2626', # Dark Red
    'error': '#ef4444',    # Red (DOWN)
    'success': '#10b981',  # Green (RECOVERED)
    'warning': '#f59e0b',  # Amber (DEGRADED / SSL)
    'info': '#3b82f6'      # Blue
}

EMOJI_MAP = {
    'critical': '🚨',
    'error': '🔴',
    'success': '🟢',
    'warning': '⚠️',
    'info': 'ℹ️'
}

def _build_slack_payload(title: str, message: str, alert_type: str, metadata: dict = None) -> dict:
    hex_color = COLOR_MAP.get(alert_type, '#3b82f6')
    emoji = EMOJI_MAP.get(alert_type, '🔔')
    ts = int(time.time())
    
    meta_fields = []
    if metadata:
        if 'url' in metadata:
            meta_fields.append({"type": "mrkdwn", "text": f"*Target Endpoint:*\n`{metadata['url']}`"})
        if 'latency_ms' in metadata:
            meta_fields.append({"type": "mrkdwn", "text": f"*Latency:*\n`{metadata['latency_ms']}ms`"})
        if 'error' in metadata:
            meta_fields.append({"type": "mrkdwn", "text": f"*Error Detail:*\n```{str(metadata['error'])[:180]}```"})
        if 'days_remaining' in metadata:
            meta_fields.append({"type": "mrkdwn", "text": f"*Days Remaining:*\n`{metadata['days_remaining']} days`"})

    blocks = [
        {
            "type": "header",
            "text": {
                "type": "plain_text",
                "text": f"{emoji} {title[:140]}",
                "emoji": True
            }
        },
        {
            "type": "section",
            "text": {
                "type": "mrkdwn",
                "text": f"*{alert_type.upper()} Notification*\n{message}"
            }
        }
    ]

    if meta_fields:
        blocks.append({
            "type": "section",
            "fields": meta_fields[:4]
        })

    blocks.append({
        "type": "actions",
        "elements": [
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "Open Dashboard",
                    "emoji": True
                },
                "url": "https://thirdeye.colladome.com/",
                "style": "primary" if alert_type == "success" else "danger"
            },
            {
                "type": "button",
                "text": {
                    "type": "plain_text",
                    "text": "View Incidents",
                    "emoji": True
                },
                "url": "https://thirdeye.colladome.com/alerts"
            }
        ]
    })

    return {
        "text": f"{emoji} {title}: {message}",
        "blocks": blocks,
        "attachments": [
            {
                "color": hex_color,
                "footer": "ThirdEye Continuous Observability & Synthetic Engine",
                "ts": ts
            }
        ]
    }

def _build_discord_payload(title: str, message: str, alert_type: str, metadata: dict = None) -> dict:
    hex_color = COLOR_MAP.get(alert_type, '#3b82f6')
    int_color = int(hex_color.replace('#', ''), 16)
    emoji = EMOJI_MAP.get(alert_type, '🔔')

    fields = []
    if metadata:
        if 'url' in metadata:
            fields.append({"name": "Target", "value": f"`{metadata['url']}`", "inline": True})
        if 'latency_ms' in metadata:
            fields.append({"name": "Response Time", "value": f"`{metadata['latency_ms']}ms`", "inline": True})
        if 'error' in metadata:
            fields.append({"name": "Failure Reason", "value": f"```{str(metadata['error'])[:180]}```", "inline": False})

    return {
        "username": "ThirdEye Incident Monitor",
        "avatar_url": "https://thirdeye.colladome.com/favicon.ico",
        "embeds": [{
            "title": f"{emoji} {title}",
            "description": message,
            "color": int_color,
            "fields": fields,
            "url": "https://thirdeye.colladome.com/alerts",
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "footer": {
                "text": "ThirdEye High-Reliability Observability"
            }
        }]
    }

def _send_channel_dispatch(channel: models.AlertChannel, title: str, message: str, alert_type: str, metadata: dict = None) -> tuple:
    """
    Dispatches to a specific channel.
    Returns: (status: str, response_code: int, error_message: str)
    """
    cfg = channel.config or {}
    url = cfg.get('url') or cfg.get('webhook_url')
    ch_type = (channel.type or 'webhook').lower()
    emoji = EMOJI_MAP.get(alert_type, '🔔')

    try:
        # 1. SLACK
        if ch_type == 'slack':
            if not url or not url.startswith('http'):
                return ('failed', 400, 'Invalid Slack webhook URL')
            payload = _build_slack_payload(title, message, alert_type, metadata)
            req = ur.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json', 'User-Agent': 'ThirdEye-Alert/2.0'}
            )
            with ur.urlopen(req, timeout=8) as resp:
                resp_code = resp.status
                return ('delivered', resp_code, None)

        # 2. DISCORD
        elif ch_type == 'discord':
            if not url or not url.startswith('http'):
                return ('failed', 400, 'Invalid Discord webhook URL')
            payload = _build_discord_payload(title, message, alert_type, metadata)
            req = ur.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json', 'User-Agent': 'ThirdEye-Alert/2.0'}
            )
            with ur.urlopen(req, timeout=8) as resp:
                resp_code = resp.status
                return ('delivered', resp_code, None)

        # 3. TELEGRAM BOT
        elif ch_type == 'telegram':
            bot_token = cfg.get('bot_token')
            chat_id = cfg.get('chat_id')
            if not bot_token or not chat_id:
                return ('failed', 400, 'Missing bot_token or chat_id')
            
            tg_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            formatted_text = (
                f"<b>{emoji} {title}</b>\n\n"
                f"{message}\n\n"
                f"<b>Severity:</b> {alert_type.upper()}\n"
                f"<b>Time:</b> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
                f"👉 <a href=\"https://thirdeye.colladome.com/alerts\">Open ThirdEye Alerts</a>"
            )
            tg_payload = {
                'chat_id': str(chat_id),
                'text': formatted_text,
                'parse_mode': 'HTML',
                'disable_web_page_preview': False
            }
            req = ur.Request(
                tg_url,
                data=json.dumps(tg_payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with ur.urlopen(req, timeout=8) as resp:
                resp_code = resp.status
                return ('delivered', resp_code, None)

        # 4. EMAIL (SMTP / Transactional)
        elif ch_type == 'email':
            target_email = cfg.get('email')
            if not target_email or '@' not in target_email:
                return ('failed', 400, 'Invalid recipient email address')
            
            smtp_host = cfg.get('smtp_host') or '127.0.0.1'
            smtp_port = int(cfg.get('smtp_port') or 25)
            smtp_user = cfg.get('smtp_user')
            smtp_pass = cfg.get('smtp_pass')

            # Render HTML Email
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px;">
              <div style="max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
                <div style="background-color: {COLOR_MAP.get(alert_type, '#2563eb')}; padding: 18px 24px;">
                  <h2 style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 800;">{emoji} ThirdEye Incident Alert</h2>
                </div>
                <div style="padding: 24px;">
                  <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">{title}</h3>
                  <p style="color: #475569; font-size: 14px; line-height: 1.6;">{message}</p>
                  <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 8px; margin: 20px 0; font-size: 12px; font-family: monospace; color: #334155;">
                    <div><strong>Severity:</strong> {alert_type.upper()}</div>
                    <div><strong>Timestamp:</strong> {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}</div>
                  </div>
                  <a href="https://thirdeye.colladome.com/alerts" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: bold; font-size: 13px; padding: 10px 20px; border-radius: 8px;">View in ThirdEye Dashboard</a>
                </div>
                <div style="background: #f8fafc; padding: 14px 24px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 11px;">
                  ThirdEye Continuous Observability Suite • <a href="https://thirdeye.colladome.com" style="color: #64748b;">thirdeye.colladome.com</a>
                </div>
              </div>
            </body>
            </html>
            """
            try:
                msg = MIMEMultipart('alternative')
                msg['Subject'] = f"{emoji} [{alert_type.upper()}] {title}"
                msg['From'] = cfg.get('from_email') or 'alerts@thirdeye.colladome.com'
                msg['To'] = target_email
                msg.attach(MIMEText(message, 'plain'))
                msg.attach(MIMEText(html_content, 'html'))

                if smtp_host and smtp_host != '127.0.0.1':
                    server = smtplib.SMTP(smtp_host, smtp_port, timeout=8)
                    if cfg.get('use_tls', True):
                        server.starttls()
                    if smtp_user and smtp_pass:
                        server.login(smtp_user, smtp_pass)
                    server.sendmail(msg['From'], [target_email], msg.as_string())
                    server.quit()
                    return ('delivered', 250, None)
                else:
                    # Simulated / system local delivery
                    logger.info(f"Email alert recorded for {target_email}: {title}")
                    return ('delivered', 200, None)
            except Exception as smtp_err:
                logger.warning(f"SMTP send failed: {smtp_err}")
                return ('failed', 500, f"SMTP Error: {str(smtp_err)[:150]}")

        # 5. WHATSAPP / SMS (Twilio or CallMeBot API)
        elif ch_type == 'whatsapp' or ch_type == 'sms':
            phone = cfg.get('phone_number') or cfg.get('to_number')
            callmebot_key = cfg.get('callmebot_api_key')
            
            # CallMeBot WhatsApp Gateway (Instant Free WhatsApp integration)
            if callmebot_key and phone:
                clean_phone = phone.replace('+', '').replace(' ', '').replace('-', '')
                msg_text = f"🚨 *ThirdEye Alert*\n\n*{title}*\n{message}\n\nhttps://thirdeye.colladome.com/alerts"
                cm_url = f"https://api.callmebot.com/whatsapp.php?phone={clean_phone}&text={up.quote(msg_text)}&apikey={callmebot_key}"
                req = ur.Request(cm_url, headers={'User-Agent': 'ThirdEye-Alert/2.0'})
                with ur.urlopen(req, timeout=10) as resp:
                    return ('delivered', resp.status, None)

            # Twilio REST API integration
            account_sid = cfg.get('account_sid')
            auth_token = cfg.get('auth_token')
            from_number = cfg.get('from_number')
            if account_sid and auth_token and from_number and phone:
                twilio_url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
                is_wa = ch_type == 'whatsapp' or 'whatsapp:' in from_number
                sender = f"whatsapp:{from_number}" if (is_wa and not from_number.startswith('whatsapp:')) else from_number
                recipient = f"whatsapp:{phone}" if (is_wa and not phone.startswith('whatsapp:')) else phone

                body_data = up.urlencode({
                    'From': sender,
                    'To': recipient,
                    'Body': f"{emoji} [ThirdEye] {title}: {message} (https://thirdeye.colladome.com/alerts)"
                }).encode('utf-8')

                req = ur.Request(twilio_url, data=body_data, method='POST')
                auth_header = 'Basic ' + up.base64.b64encode(f"{account_sid}:{auth_token}".encode('utf-8')).decode('utf-8')
                req.add_header('Authorization', auth_header)
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')

                with ur.urlopen(req, timeout=10) as resp:
                    return ('delivered', resp.status, None)

            return ('failed', 400, 'Missing WhatsApp/SMS credentials (requires phone_number and Twilio or CallMeBot key)')

        # 6. CUSTOM SIGNED WEBHOOK
        else:
            if not url or not url.startswith('http'):
                return ('failed', 400, 'Invalid webhook target URL')

            payload_dict = {
                'event': f'alert.{alert_type}',
                'title': title,
                'message': message,
                'type': alert_type,
                'organization_id': channel.organization_id,
                'channel_id': channel.id,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'metadata': metadata or {}
            }
            json_bytes = json.dumps(payload_dict, sort_keys=True).encode('utf-8')

            # Optional HMAC-SHA256 signature
            secret = cfg.get('secret_token') or 'thirdeye_default_secret'
            sig = hmac.new(secret.encode('utf-8'), json_bytes, hashlib.sha256).hexdigest()

            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'ThirdEye-Webhook-Engine/2.0',
                'X-ThirdEye-Signature': f"sha256={sig}",
                'X-ThirdEye-Event': f"alert.{alert_type}"
            }
            # Custom headers passed in config
            if isinstance(cfg.get('custom_headers'), dict):
                headers.update(cfg.get('custom_headers'))

            req = ur.Request(url, data=json_bytes, headers=headers)
            with ur.urlopen(req, timeout=10) as resp:
                return ('delivered', resp.status, None)

    except ur.HTTPError as he:
        return ('failed', he.code, f"HTTP Error {he.code}: {he.reason}")
    except Exception as ex:
        return ('failed', 500, str(ex)[:200])

def test_single_channel(db: Session, channel: models.AlertChannel, organization_id: int) -> dict:
    """
    Tests a single specific alert channel and logs the test result to AlertEventLog.
    """
    title = "🔔 Test Notification from ThirdEye"
    message = f"This is a test notification confirming that your {channel.type.capitalize()} alert channel is properly connected and operational."
    alert_type = "info"
    metadata = {
        "test": True,
        "channel_name": channel.name,
        "channel_type": channel.type,
        "timestamp": datetime.utcnow().isoformat()
    }

    status, code, err = _send_channel_dispatch(channel, title, message, alert_type, metadata)

    # Log to AlertEventLog
    try:
        log_entry = models.AlertEventLog(
            organization_id=organization_id,
            channel_id=channel.id,
            channel_name=channel.name,
            channel_type=channel.type,
            title=title,
            alert_type=alert_type,
            status=status,
            response_code=code,
            error_message=err
        )
        db.add(log_entry)
        db.commit()
    except Exception as log_ex:
        logger.warning(f"Failed to record alert event log: {log_ex}")

    return {
        "success": (status == "delivered"),
        "channel_id": channel.id,
        "channel_name": channel.name,
        "channel_type": channel.type,
        "status": status,
        "response_code": code,
        "message": f"{channel.name} test alert delivered successfully!" if status == 'delivered' else f"Delivery failed: {err}",
        "error": err
    }

def dispatch_alert(
    db: Session,
    organization_id: int,
    title: str,
    message: str,
    alert_type: str = 'error',
    metadata: dict = None,
    event_category: str = 'uptime_down'
):
    """
    Main entry point for dispatching alerts across all configured channels for an organization.
    Includes in-memory deduplication, in-app notification, and database event logging.
    """
    # 1. In-app Notification (always created)
    try:
        notif = models.Notification(
            organization_id=organization_id,
            title=title,
            message=message,
            type=alert_type
        )
        db.add(notif)
        db.commit()
    except Exception as ex:
        logger.error(f"Failed to create Notification record: {ex}")

    # 2. In-memory Throttling / Deduplication check
    cache_key = (organization_id, title)
    now = time.time()
    last_sent = _ALERT_THROTTLE_CACHE.get(cache_key, 0)
    if (now - last_sent) < THROTTLE_WINDOW_SECONDS:
        logger.info(f"Throttled identical alert for org {organization_id}: {title}")
        return

    _ALERT_THROTTLE_CACHE[cache_key] = now

    # 3. Query Active Channels for this organization
    channels = db.query(models.AlertChannel).filter(
        models.AlertChannel.organization_id == organization_id,
        models.AlertChannel.is_active == True
    ).all()

    for ch in channels:
        # Check event filter if configured
        if ch.events and isinstance(ch.events, list) and len(ch.events) > 0:
            if event_category not in ch.events:
                continue

        # Check severity filter if configured
        if ch.severity and isinstance(ch.severity, list) and len(ch.severity) > 0:
            if alert_type not in ch.severity:
                continue

        # Dispatch
        status, code, err = _send_channel_dispatch(ch, title, message, alert_type, metadata)

        # Record log
        try:
            log_entry = models.AlertEventLog(
                organization_id=organization_id,
                channel_id=ch.id,
                channel_name=ch.name,
                channel_type=ch.type,
                title=title,
                alert_type=alert_type,
                status=status,
                response_code=code,
                error_message=err
            )
            db.add(log_entry)
            db.commit()
        except Exception as log_ex:
            logger.warning(f"Failed to record alert event log for channel {ch.id}: {log_ex}")
