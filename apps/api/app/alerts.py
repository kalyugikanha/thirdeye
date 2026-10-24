import os
import urllib.request as ur
import urllib.parse as up
import urllib.error as ue
import json
import logging
import time
import hmac
import hashlib
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app import models

logger = logging.getLogger('alerts')

# Fast in-memory cache + DB-backed deduplication across multi-worker processes
_ALERT_THROTTLE_CACHE = {}

CATEGORY_COOLDOWN_SECONDS = {
    'uptime_down': 120,
    'uptime_recovered': 60,
    'uptime_degraded': 600,
    'error_spike': 900,
    'cwv_regression': 900,
    'security_finding': 900,
    'ssl_expiry': 86400,     # Once per 24h
    'quota_limit': 86400,    # Once per 24h
    'manual_test': 0
}

COLOR_MAP = {
    'critical': '#dc2626',
    'error': '#ef4444',
    'success': '#10b981',
    'warning': '#f59e0b',
    'info': '#3b82f6'
}

EMOJI_MAP = {
    'critical': '🚨',
    'error': '🔴',
    'success': '🟢',
    'warning': '⚠️',
    'info': 'ℹ️'
}

SECRET_KEYS = {
    'bot_token', 'smtp_pass', 'callmebot_api_key', 'secret_token',
    'auth_token', 'routing_key', 'green_api_token', 'meta_access_token'
}


def mask_channel_config(config: dict) -> dict:
    """Masks sensitive credentials before returning channel config to the frontend."""
    if not config or not isinstance(config, dict):
        return {}
    masked = {}
    for k, v in config.items():
        if k in SECRET_KEYS and isinstance(v, str) and len(v) > 0:
            masked[k] = ('••••' + v[-4:]) if len(v) > 4 else '••••'
        else:
            masked[k] = v
    return masked


def merge_channel_config(existing_config: dict, new_config: dict) -> dict:
    """Preserves existing secrets when the frontend submits a masked value ('••••...')."""
    base = dict(existing_config or {})
    for k, v in (new_config or {}).items():
        if k in SECRET_KEYS and isinstance(v, str) and v.startswith('••••'):
            continue
        base[k] = v
    return base


def _build_slack_payload(title: str, message: str, alert_type: str, metadata: dict = None) -> dict:
    hex_color = COLOR_MAP.get(alert_type, '#ef4444' if alert_type in ('error', 'critical') else '#3b82f6')
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
        if 'usage_pct' in metadata:
            meta_fields.append({"type": "mrkdwn", "text": f"*Quota Usage:*\n`{metadata['usage_pct']}%`"})

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
                "text": {"type": "plain_text", "text": "Open Dashboard", "emoji": True},
                "url": "https://thirdeye.colladome.com/",
                "style": "primary" if alert_type == "success" else "danger"
            },
            {
                "type": "button",
                "text": {"type": "plain_text", "text": "View Incidents", "emoji": True},
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
                "blocks": blocks,
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
            "footer": {"text": "ThirdEye High-Reliability Observability"}
        }]
    }


def _build_teams_payload(title: str, message: str, alert_type: str, metadata: dict = None) -> dict:
    hex_color = COLOR_MAP.get(alert_type, '#3b82f6').replace('#', '')
    emoji = EMOJI_MAP.get(alert_type, '🔔')
    facts = [{"name": "Severity", "value": alert_type.upper()}]
    if metadata:
        for k, v in list(metadata.items())[:5]:
            facts.append({"name": str(k), "value": str(v)[:120]})
    return {
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": hex_color,
        "summary": f"{emoji} {title}",
        "sections": [{
            "activityTitle": f"{emoji} **{title}**",
            "activitySubtitle": "ThirdEye Observability Suite",
            "text": message,
            "facts": facts,
            "markdown": True
        }],
        "potentialAction": [{
            "@type": "OpenUri",
            "name": "Open ThirdEye Dashboard",
            "targets": [{"os": "default", "uri": "https://thirdeye.colladome.com/alerts"}]
        }]
    }


def _http_send_with_retry(req: ur.Request, timeout: int = 8, max_attempts: int = 2) -> tuple:
    """Executes HTTP request with retry on transient 5xx/network errors."""
    last_err = None
    last_code = 500
    for attempt in range(max_attempts):
        try:
            with ur.urlopen(req, timeout=timeout) as resp:
                body = resp.read().decode('utf-8', errors='ignore')
                return ('delivered', resp.status, body)
        except ue.HTTPError as he:
            last_code = he.code
            last_err = f"HTTP Error {he.code}: {he.reason}"
            if he.code < 500:
                break
        except Exception as ex:
            last_err = str(ex)[:200]
        if attempt < max_attempts - 1:
            time.sleep(0.4)
    return ('failed', last_code, last_err)


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
            status, code, err_or_body = _http_send_with_retry(req)
            return (status, code, None if status == 'delivered' else err_or_body)

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
            status, code, err_or_body = _http_send_with_retry(req)
            return (status, code, None if status == 'delivered' else err_or_body)

        # 3. MICROSOFT TEAMS
        elif ch_type == 'teams':
            if not url or not url.startswith('http'):
                return ('failed', 400, 'Invalid Microsoft Teams webhook URL')
            payload = _build_teams_payload(title, message, alert_type, metadata)
            req = ur.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json', 'User-Agent': 'ThirdEye-Alert/2.0'}
            )
            status, code, err_or_body = _http_send_with_retry(req)
            return (status, code, None if status == 'delivered' else err_or_body)

        # 4. PAGERDUTY (Events API v2)
        elif ch_type == 'pagerduty':
            routing_key = cfg.get('routing_key')
            if not routing_key:
                return ('failed', 400, 'Missing PagerDuty Events v2 Integration/Routing Key')
            pd_sev = 'critical' if alert_type in ('critical', 'error') else ('warning' if alert_type == 'warning' else 'info')
            pd_payload = {
                "routing_key": routing_key,
                "event_action": "resolve" if alert_type == "success" else "trigger",
                "payload": {
                    "summary": f"{title}: {message[:250]}",
                    "source": (metadata or {}).get('url') or "thirdeye.colladome.com",
                    "severity": pd_sev,
                    "custom_details": metadata or {}
                }
            }
            req = ur.Request(
                "https://events.pagerduty.com/v2/enqueue",
                data=json.dumps(pd_payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            status, code, err_or_body = _http_send_with_retry(req)
            return (status, code, None if status == 'delivered' else err_or_body)

        # 5. TELEGRAM BOT
        elif ch_type == 'telegram':
            bot_token = cfg.get('bot_token')
            chat_id = cfg.get('chat_id')
            if not bot_token or not chat_id:
                return ('failed', 400, 'Missing Telegram bot_token or chat_id')

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
            status, code, err_or_body = _http_send_with_retry(req)
            return (status, code, None if status == 'delivered' else err_or_body)

        # 6. EMAIL (Hostinger Webmail SMTP / Custom SMTP)
        elif ch_type == 'email':
            target_email = cfg.get('email') or cfg.get('to')
            if not target_email or '@' not in target_email:
                return ('failed', 400, 'Invalid recipient email address')

            smtp_host = (cfg.get('smtp_host') or os.getenv('SMTP_HOST') or 'smtp.hostinger.com').strip()
            smtp_port = int(cfg.get('smtp_port') or os.getenv('SMTP_PORT') or 465)
            smtp_user = (cfg.get('smtp_user') or os.getenv('SMTP_USER') or '').strip()
            smtp_pass = (cfg.get('smtp_pass') or os.getenv('SMTP_PASS') or '').strip()
            from_email = (cfg.get('from_email') or smtp_user or os.getenv('SMTP_FROM') or '').strip()

            if not smtp_user or not smtp_pass:
                return (
                    'failed',
                    400,
                    'Hostinger SMTP credentials required: Enter Sender Email (smtp_user) and Password (smtp_pass) in channel config.'
                )

            recipients = [e.strip() for e in target_email.split(',') if '@' in e]
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
                msg['From'] = from_email
                msg['To'] = ', '.join(recipients)
                msg.attach(MIMEText(message, 'plain'))
                msg.attach(MIMEText(html_content, 'html'))

                if smtp_port == 465:
                    server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10)
                else:
                    server = smtplib.SMTP(smtp_host, smtp_port, timeout=10)
                    server.ehlo()
                    if cfg.get('use_tls', True):
                        server.starttls()
                        server.ehlo()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, recipients, msg.as_string())
                server.quit()
                return ('delivered', 250, None)
            except Exception as smtp_err:
                logger.warning(f"Hostinger/SMTP send failed: {smtp_err}")
                return ('failed', 500, f"SMTP Error ({smtp_host}:{smtp_port}): {str(smtp_err)[:160]}")

        # 7. WHATSAPP / SMS (Green-API Free QR / Meta Cloud API / CallMeBot / Twilio)
        elif ch_type in ('whatsapp', 'sms'):
            import re
            phone = (cfg.get('phone_number') or cfg.get('to_number') or '').strip()
            msg_text = f"{emoji} *ThirdEye Alert*\n\n*{title}*\n{message}\n\n🔗 https://thirdeye.colladome.com/alerts"

            # 7a. Green-API (100% Free Developer Plan — Scan QR code from WhatsApp)
            green_id = (cfg.get('green_instance_id') or '').strip()
            green_token = (cfg.get('green_api_token') or '').strip()
            if green_id and green_token and phone:
                try:
                    state_url = f"https://api.green-api.com/waInstance{green_id}/getStateInstance/{green_token}"
                    state_req = ur.Request(state_url, headers={'User-Agent': 'ThirdEye-Alert/2.0'})
                    with ur.urlopen(state_req, timeout=8) as s_resp:
                        state_data = json.loads(s_resp.read().decode('utf-8', errors='replace'))
                        inst_state = state_data.get('stateInstance', 'unknown')
                        if inst_state != 'authorized':
                            return (
                                'failed',
                                401,
                                f"WhatsApp not linked yet (state: {inst_state}). Click 'Link WhatsApp QR' on this channel card or scan the QR code inside console.green-api.com!"
                            )
                except Exception as state_err:
                    return ('failed', 400, f"Green-API Instance check failed: {str(state_err)[:140]}")

                phones = [re.sub(r'[^0-9]', '', p) for p in phone.split(',') if re.sub(r'[^0-9]', '', p)]
                last_status, last_code, last_err = ('failed', 400, 'Invalid recipient phone number')
                for clean_p in phones:
                    green_url = f"https://api.green-api.com/waInstance{green_id}/sendMessage/{green_token}"
                    payload_bytes = json.dumps({
                        "chatId": f"{clean_p}@c.us",
                        "message": msg_text
                    }).encode('utf-8')
                    req = ur.Request(green_url, data=payload_bytes, method='POST', headers={
                        'Content-Type': 'application/json',
                        'User-Agent': 'ThirdEye-Alert/2.0'
                    })
                    last_status, last_code, last_err = _http_send_with_retry(req, timeout=12)
                return (last_status, last_code, None if last_status == 'delivered' else last_err)

            # 7b. Meta Official WhatsApp Cloud API (Free 1,000 service conversations/mo)
            meta_phone_id = (cfg.get('meta_phone_number_id') or '').strip()
            meta_token = (cfg.get('meta_access_token') or '').strip()
            if meta_phone_id and meta_token and phone:
                clean_p = re.sub(r'[^0-9]', '', phone.split(',')[0])
                meta_url = f"https://graph.facebook.com/v19.0/{meta_phone_id}/messages"
                payload_bytes = json.dumps({
                    "messaging_product": "whatsapp",
                    "to": clean_p,
                    "type": "text",
                    "text": {"preview_url": False, "body": msg_text}
                }).encode('utf-8')
                req = ur.Request(meta_url, data=payload_bytes, method='POST', headers={
                    'Authorization': f'Bearer {meta_token}',
                    'Content-Type': 'application/json',
                    'User-Agent': 'ThirdEye-Alert/2.0'
                })
                status, code, body_or_err = _http_send_with_retry(req, timeout=12)
                return (status, code, None if status == 'delivered' else body_or_err)

            # 7c. CallMeBot API
            callmebot_key = (cfg.get('callmebot_api_key') or '').strip()
            if callmebot_key and phone:
                clean_phone = re.sub(r'[^0-9]', '', phone.split(',')[0])
                cm_url = f"https://api.callmebot.com/whatsapp.php?phone={clean_phone}&text={up.quote(msg_text)}&apikey={callmebot_key}"
                req = ur.Request(cm_url, headers={'User-Agent': 'ThirdEye-Alert/2.0'})
                status, code, body_or_err = _http_send_with_retry(req, timeout=12)
                if status == 'delivered' and body_or_err and ('invalid' in body_or_err.lower() or 'error' in body_or_err.lower()):
                    clean_err = re.sub(r'<[^>]+>', ' ', body_or_err)
                    clean_err = re.sub(r'\s+', ' ', clean_err).strip()
                    if 'APIKey is invalid' in clean_err:
                        clean_err = 'CallMeBot APIKey is invalid (Note: CallMeBot public WhatsApp bot slots are currently full — switch to Green-API Free QR or Telegram).'
                    return ('failed', 400, f"CallMeBot Error: {clean_err[-180:]}")
                return (status, code, None if status == 'delivered' else body_or_err)

            # 7d. Twilio WhatsApp / SMS
            account_sid = cfg.get('account_sid')
            auth_token = cfg.get('auth_token')
            from_number = cfg.get('from_number')
            if account_sid and auth_token and from_number and phone:
                import base64
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
                auth_header = 'Basic ' + base64.b64encode(f"{account_sid}:{auth_token}".encode('utf-8')).decode('utf-8')
                req.add_header('Authorization', auth_header)
                req.add_header('Content-Type', 'application/x-www-form-urlencoded')

                status, code, err_or_body = _http_send_with_retry(req, timeout=10)
                return (status, code, None if status == 'delivered' else err_or_body)

            return ('failed', 400, 'Missing WhatsApp credentials: Provide Green-API (Instance ID + Token), Meta Cloud API, or CallMeBot Key')

        # 8. CUSTOM SIGNED WEBHOOK
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

            secret = cfg.get('secret_token') or 'thirdeye_default_secret'
            sig = hmac.new(secret.encode('utf-8'), json_bytes, hashlib.sha256).hexdigest()

            headers = {
                'Content-Type': 'application/json',
                'User-Agent': 'ThirdEye-Webhook-Engine/2.0',
                'X-ThirdEye-Signature': f"sha256={sig}",
                'X-ThirdEye-Event': f"alert.{alert_type}"
            }
            if isinstance(cfg.get('custom_headers'), dict):
                headers.update(cfg.get('custom_headers'))

            req = ur.Request(url, data=json_bytes, headers=headers)
            status, code, err_or_body = _http_send_with_retry(req, timeout=10)
            return (status, code, None if status == 'delivered' else err_or_body)

    except ue.HTTPError as he:
        return ('failed', he.code, f"HTTP Error {he.code}: {he.reason}")
    except Exception as ex:
        return ('failed', 500, str(ex)[:200])


def test_single_channel(db: Session, channel: models.AlertChannel, organization_id: int) -> dict:
    """Tests a single specific alert channel and logs the test result to AlertEventLog."""
    title = "🔔 Test Notification from ThirdEye"
    message = f"This is a live verification test confirming your {channel.type.upper()} alert channel ({channel.name}) is properly connected."
    alert_type = "info"
    metadata = {
        "test": True,
        "channel_name": channel.name,
        "channel_type": channel.type,
        "timestamp": datetime.utcnow().isoformat()
    }

    status, code, err = _send_channel_dispatch(channel, title, message, alert_type, metadata)

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
        "message": f"{channel.name} test alert delivered successfully (HTTP {code})!" if status == 'delivered' else f"Delivery failed: {err}",
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
    Unified Omnichannel Alert Dispatcher across all event categories.
    - DB + In-memory deduplication (works across multiple Uvicorn workers).
    - Creates in-app Notification.
    - Dispatches to all matching active AlertChannels.
    - Records audit trail in AlertEventLog.
    """
    cooldown_sec = CATEGORY_COOLDOWN_SECONDS.get(event_category, 120)
    cache_key = (organization_id, event_category, title)
    now = time.time()

    if cooldown_sec > 0:
        # 1. Fast in-memory check
        last_sent = _ALERT_THROTTLE_CACHE.get(cache_key, 0)
        if (now - last_sent) < cooldown_sec:
            return

        # 2. Cross-worker DB check in AlertEventLog
        try:
            cutoff = datetime.utcnow() - timedelta(seconds=cooldown_sec)
            recent_db_log = db.query(models.AlertEventLog).filter(
                models.AlertEventLog.organization_id == organization_id,
                models.AlertEventLog.title == title,
                models.AlertEventLog.created_at >= cutoff
            ).first()
            if recent_db_log:
                _ALERT_THROTTLE_CACHE[cache_key] = now
                return
        except Exception:
            pass

    _ALERT_THROTTLE_CACHE[cache_key] = now

    # 3. Create in-app Notification
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
        db.rollback()
        logger.error(f"Failed to create Notification record: {ex}")

    # 4. Query Active Channels for this organization
    channels = db.query(models.AlertChannel).filter(
        models.AlertChannel.organization_id == organization_id,
        models.AlertChannel.is_active == True
    ).all()

    for ch in channels:
        if ch.events and isinstance(ch.events, list) and len(ch.events) > 0:
            if event_category != 'manual_test' and event_category not in ch.events:
                continue

        if ch.severity and isinstance(ch.severity, list) and len(ch.severity) > 0:
            # Map 'success' (recovery) to always pass if 'uptime_recovered' is enabled
            if alert_type != 'success' and alert_type not in ch.severity:
                continue

        status, code, err = _send_channel_dispatch(ch, title, message, alert_type, metadata)

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
            db.rollback()
            logger.warning(f"Failed to record alert event log for channel {ch.id}: {log_ex}")
