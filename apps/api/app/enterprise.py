"""ThirdEye Enterprise Suite.

Incident webhook dispatcher (Slack Block Kit / Discord Embeds), user journey flow
explorer, conversion goals & revenue attribution, and in-app CSAT feedback.

Every authenticated endpoint is scoped to the caller's organization projects.
Public endpoints (feedback ingestion/config) are authorised strictly by project api_key.
"""
import json
import logging
import urllib.request as ur
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, models
from app.database import get_db

logger = logging.getLogger('enterprise')
router = APIRouter()

ROSE_HEX = '#F43F5E'
ROSE_INT = 0xF43F5E
INCIDENT_COOLDOWN_MINUTES = 15
ERROR_SPIKE_THRESHOLD = 10          # code_error events ...
ERROR_SPIKE_WINDOW_MINUTES = 5      # ... within this window trigger an incident
EVENT_SCAN_LIMIT = 100000


# ---------------------------------------------------------------- helpers
def _project_ids(db: Session, user: models.User, project_id: Optional[int] = None) -> List[int]:
    q = db.query(models.Project.id).filter(models.Project.organization_id == user.organization_id)
    ids = [r[0] for r in q.all()]
    if project_id is not None:
        return [project_id] if project_id in ids else []
    return ids


def _path_of(url: Optional[str]) -> str:
    if not url:
        return '/'
    try:
        p = urlparse(url).path or '/'
    except Exception:
        return '/'
    if len(p) > 1 and p.endswith('/'):
        p = p.rstrip('/')
    return p or '/'


def _project_from_key(db: Session, key: Optional[str]) -> models.Project:
    if not key or not key.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or missing API key')
    project = db.query(models.Project).filter(models.Project.api_key == key.strip()).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or missing API key')
    return project


def _request_key(request: Request, body_key: Optional[str] = None) -> Optional[str]:
    return body_key or request.headers.get('data-key') or request.headers.get('x-api-key')


# ------------------------------------------------- 1. incident webhooks
def build_slack_payload(title: str, message: str, incident_type: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    fields = [{'type': 'mrkdwn', 'text': f'*{k}:*\n{v}'} for k, v in (details or {}).items()]
    blocks: List[Dict[str, Any]] = [
        {'type': 'header', 'text': {'type': 'plain_text', 'text': f'\U0001F6A8 {title}'[:150]}},
        {'type': 'section', 'text': {'type': 'mrkdwn', 'text': message[:2900]}},
    ]
    if fields:
        blocks.append({'type': 'section', 'fields': fields[:10]})
    blocks.append({'type': 'context', 'elements': [
        {'type': 'mrkdwn', 'text': f'ThirdEye \u2022 `{incident_type}` \u2022 {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}'}
    ]})
    return {'text': title, 'attachments': [{'color': ROSE_HEX, 'blocks': blocks}]}


def build_discord_payload(title: str, message: str, incident_type: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {'embeds': [{
        'title': f'\U0001F6A8 {title}'[:256],
        'description': message[:4000],
        'color': ROSE_INT,
        'fields': [{'name': str(k)[:256], 'value': str(v)[:1024] or '-', 'inline': True} for k, v in (details or {}).items()][:25],
        'footer': {'text': f'ThirdEye \u2022 {incident_type}'},
        'timestamp': datetime.utcnow().isoformat() + 'Z',
    }]}


def build_generic_payload(title: str, message: str, incident_type: str, details: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {'event': 'incident.triggered', 'type': incident_type, 'title': title, 'message': message,
            'details': details or {}, 'timestamp': datetime.utcnow().isoformat() + 'Z'}


def _post_json(url: str, payload: Dict[str, Any]) -> int:
    """Send a JSON webhook; returns the HTTP status code. Isolated so tests can patch it."""
    req = ur.Request(url, data=json.dumps(payload).encode('utf-8'),
                     headers={'Content-Type': 'application/json', 'User-Agent': 'ThirdEye-Incident/1.0'})
    with ur.urlopen(req, timeout=5) as resp:
        return resp.getcode()


def dispatch_incident_webhook(db: Session, project_id: int, title: str, message: str, incident_type: str,
                              details: Optional[Dict[str, Any]] = None, incident_key: Optional[str] = None) -> Dict[str, Any]:
    """Fan an incident out to the organization's Slack/Discord/webhook channels.

    A cooldown (per project + incident_key) suppresses repeats for 15 minutes so a
    flapping monitor or error storm cannot flood a channel. Never raises.
    """
    result = {'dispatched': 0, 'failed': 0, 'suppressed': False}
    try:
        project = db.query(models.Project).filter(models.Project.id == project_id).first()
        if not project or project.organization_id is None:
            return result
        key = incident_key or f'{incident_type}:{project_id}'
        cutoff = datetime.utcnow() - timedelta(minutes=INCIDENT_COOLDOWN_MINUTES)
        recent = db.query(models.IncidentLog).filter(
            models.IncidentLog.project_id == project_id,
            models.IncidentLog.incident_key == key,
            models.IncidentLog.created_at >= cutoff,
        ).first()
        if recent:
            result['suppressed'] = True
            return result

        channels = db.query(models.AlertChannel).filter(
            models.AlertChannel.organization_id == project.organization_id,
            models.AlertChannel.is_active == True,  # noqa: E712
        ).all()

        # Create in-app notification for the incident
        try:
            db.add(models.Notification(
                organization_id=project.organization_id,
                title=title,
                message=message,
                type='error' if incident_type in ('uptime_downtime', 'error_spike') else 'warning'
            ))
        except Exception:
            pass

        from app import alerts as _alerts_mod
        for ch in channels:
            url = (ch.config or {}).get('url')
            if ch.type in ('slack', 'discord', 'webhook') and url:
                builder = {'slack': build_slack_payload, 'discord': build_discord_payload}.get(ch.type, build_generic_payload)
                code, state, err_msg = None, 'delivered', None
                try:
                    code = _post_json(url, builder(title, message, incident_type, details))
                    if code is None or code >= 400:
                        state = 'failed'
                except Exception as exc:  # network error / non-2xx raises HTTPError
                    state = 'failed'
                    code = getattr(exc, 'code', None)
                    err_msg = str(exc)[:200]
                    logger.warning('Incident dispatch to channel %s failed: %s', ch.id, exc)
            else:
                # Telegram, Hostinger Email, CallMeBot WhatsApp, Teams, PagerDuty
                state, code, err_msg = _alerts_mod._send_channel_dispatch(
                    ch, title, message, 'error', details
                )
            db.add(models.IncidentLog(channel_id=ch.id, project_id=project_id, incident_key=key,
                                      incident_type=incident_type, title=title, message=message[:1000],
                                      status=state, response_code=code))
            db.add(models.AlertEventLog(
                organization_id=project.organization_id,
                channel_id=ch.id,
                channel_name=ch.name,
                channel_type=ch.type,
                title=title,
                alert_type='error',
                status=state,
                response_code=code,
                error_message=err_msg
            ))
            result['dispatched' if state == 'delivered' else 'failed'] += 1
        db.commit()
    except Exception as exc:
        db.rollback()
        logger.error('dispatch_incident_webhook error: %s', exc)
    return result


def check_error_spike(db: Session, project_id: int) -> None:
    """Called after a code_error event is stored; fires an incident when errors spike."""
    try:
        since = datetime.utcnow() - timedelta(minutes=ERROR_SPIKE_WINDOW_MINUTES)
        count = db.query(models.Event).filter(
            models.Event.project_id == project_id,
            models.Event.event_type == 'code_error',
            models.Event.created_at >= since,
        ).count()
        if count >= ERROR_SPIKE_THRESHOLD:
            dispatch_incident_webhook(
                db, project_id, 'Critical error spike detected',
                f'{count} JavaScript errors were captured in the last {ERROR_SPIKE_WINDOW_MINUTES} minutes.',
                'error_spike', {'Errors': count, 'Window': f'{ERROR_SPIKE_WINDOW_MINUTES} min'},
                incident_key=f'error_spike:{project_id}')
    except Exception as exc:
        logger.error('check_error_spike error: %s', exc)


@router.get('/api/v1/incidents/history')
def incident_history(limit: int = 50, db: Session = Depends(get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user)
    if not ids:
        return []
    rows = db.query(models.IncidentLog).filter(models.IncidentLog.project_id.in_(ids)) \
        .order_by(models.IncidentLog.created_at.desc()).limit(max(1, min(limit, 200))).all()
    return [{'id': r.id, 'channel_id': r.channel_id, 'project_id': r.project_id, 'incident_type': r.incident_type,
             'title': r.title, 'message': r.message, 'status': r.status, 'response_code': r.response_code,
             'created_at': r.created_at.isoformat()} for r in rows]


# --------------------------------------------------------- 2. journeys
@router.get('/api/v1/analytics/journeys')
def user_journeys(depth: int = 4, days: int = 30, project_id: Optional[int] = None,
                  db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    depth = max(2, min(depth, 6))
    days = max(1, min(days, 365))
    empty = {'total_sessions': 0, 'depth': depth, 'top_paths': [], 'tree': []}
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        return empty
    since = datetime.utcnow() - timedelta(days=days)
    rows = db.query(models.Event.session_id, models.Event.url).filter(
        models.Event.project_id.in_(ids), models.Event.event_type == 'pageview',
        models.Event.created_at >= since,
    ).order_by(models.Event.created_at.asc(), models.Event.id.asc()).limit(EVENT_SCAN_LIMIT).all()

    sessions: Dict[str, List[str]] = defaultdict(list)
    for sid, url in rows:
        if not sid:
            continue
        path = _path_of(url)
        if not sessions[sid] or sessions[sid][-1] != path:   # collapse refreshes
            sessions[sid].append(path)
    if not sessions:
        return empty

    # Trie of path prefixes
    root: Dict[str, Any] = {'children': {}, 'count': 0, 'sids': []}
    full_paths: Dict[tuple, Dict[str, Any]] = {}
    for sid, steps in sessions.items():
        trimmed = tuple(steps[:depth])
        entry = full_paths.setdefault(trimmed, {'count': 0, 'sids': []})
        entry['count'] += 1
        if len(entry['sids']) < 5:
            entry['sids'].append(sid)
        node = root
        for step in trimmed:
            node = node['children'].setdefault(step, {'children': {}, 'count': 0, 'sids': []})
            node['count'] += 1
            if len(node['sids']) < 5:
                node['sids'].append(sid)

    total = len(sessions)

    def serialize(name: str, node: Dict[str, Any], level: int) -> Dict[str, Any]:
        kids = sorted(node['children'].items(), key=lambda kv: -kv[1]['count'])[:5]
        continued = sum(c['count'] for c in node['children'].values())
        dropped = node['count'] - continued
        return {
            'name': name, 'step': level, 'count': node['count'],
            'percentage': round(node['count'] * 100 / total, 1),
            'drop_off': dropped,
            'drop_off_pct': round(dropped * 100 / node['count'], 1) if node['count'] else 0,
            'sample_session_ids': node['sids'],
            'children': [serialize(k, v, level + 1) for k, v in kids],
        }

    tree = [serialize(k, v, 1) for k, v in sorted(root['children'].items(), key=lambda kv: -kv[1]['count'])[:8]]
    top_paths = [{'steps': list(p), 'sessions': d['count'], 'percentage': round(d['count'] * 100 / total, 1),
                  'sample_session_ids': d['sids']}
                 for p, d in sorted(full_paths.items(), key=lambda kv: -kv[1]['count'])[:10]]
    return {'total_sessions': total, 'depth': depth, 'top_paths': top_paths, 'tree': tree}


# ------------------------------------------------------------- 3. goals
class GoalCreate(BaseModel):
    name: str
    type: str = 'url'      # url | click | custom
    target: str
    revenue_usd: int = 0
    project_id: Optional[int] = None


def _goal_matches(goal: models.Goal, event_type: str, url: Optional[str], props: Dict[str, Any]) -> bool:
    target = (goal.target or '').strip()
    if not target:
        return False
    if goal.type == 'url':
        if event_type != 'pageview':
            return False
        want = _path_of(target) if '://' in target else (target if target.startswith('/') else '/' + target)
        got = _path_of(url)
        if want.endswith('*'):
            return got.startswith(want[:-1])
        return got == (want.rstrip('/') or '/')
    if goal.type == 'click':
        if event_type != 'click':
            return False
        selectors = props.get('selectors') or []
        if props.get('selector'):
            selectors = list(selectors) + [props['selector']]
        return target in selectors
    return event_type == target   # custom event


@router.get('/api/v1/goals')
def list_goals(days: int = 30, db: Session = Depends(get_db),
               current_user: models.User = Depends(auth.get_current_user)):
    days = max(1, min(days, 365))
    ids = _project_ids(db, current_user)
    kpis = {'total_sessions': 0, 'total_completions': 0, 'conversion_rate': 0.0, 'total_revenue': 0}
    if not ids:
        return {'kpis': kpis, 'goals': []}
    goals = db.query(models.Goal).filter(models.Goal.project_id.in_(ids), models.Goal.is_active == True) \
        .order_by(models.Goal.created_at.desc()).all()  # noqa: E712
    since = datetime.utcnow() - timedelta(days=days)
    events = db.query(models.Event.project_id, models.Event.event_type, models.Event.url,
                      models.Event.session_id, models.Event.properties).filter(
        models.Event.project_id.in_(ids), models.Event.created_at >= since).limit(EVENT_SCAN_LIMIT).all()

    sessions_by_project: Dict[int, set] = defaultdict(set)
    for pid, _t, _u, sid, _p in events:
        if sid:
            sessions_by_project[pid].add(sid)

    out, all_converted, total_rev = [], set(), 0
    for g in goals:
        converted = set()
        for pid, etype, url, sid, props in events:
            if pid == g.project_id and sid and _goal_matches(g, etype, url, props or {}):
                converted.add(sid)
        n_sessions = len(sessions_by_project[g.project_id])
        revenue = len(converted) * (g.revenue_usd or 0)
        total_rev += revenue
        all_converted.update((g.project_id, s) for s in converted)
        out.append({
            'id': g.id, 'project_id': g.project_id, 'name': g.name, 'type': g.type, 'target': g.target,
            'revenue_usd': g.revenue_usd or 0, 'completions': len(converted),
            'conversion_rate': round(len(converted) * 100 / n_sessions, 2) if n_sessions else 0.0,
            'revenue': revenue, 'replay_session_ids': sorted(converted)[:5],
            'created_at': g.created_at.isoformat(),
        })
    total_sessions = sum(len(s) for s in sessions_by_project.values())
    kpis = {'total_sessions': total_sessions, 'total_completions': sum(o['completions'] for o in out),
            'conversion_rate': round(len(all_converted) * 100 / total_sessions, 2) if total_sessions else 0.0,
            'total_revenue': total_rev}
    return {'kpis': kpis, 'goals': out}


@router.post('/api/v1/goals')
def create_goal(data: GoalCreate, db: Session = Depends(get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    if data.type not in ('url', 'click', 'custom'):
        raise HTTPException(status_code=422, detail="type must be one of: url, click, custom")
    if not data.name.strip() or not data.target.strip():
        raise HTTPException(status_code=422, detail='name and target are required')
    if data.revenue_usd < 0:
        raise HTTPException(status_code=422, detail='revenue_usd must be >= 0')
    ids = _project_ids(db, current_user, data.project_id)
    if not ids:
        raise HTTPException(status_code=404 if data.project_id else 400,
                            detail='Project not found' if data.project_id else 'No project registered')
    goal = models.Goal(project_id=ids[0], name=data.name.strip()[:100], type=data.type,
                       target=data.target.strip()[:300], revenue_usd=data.revenue_usd)
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return {'id': goal.id, 'project_id': goal.project_id, 'name': goal.name, 'type': goal.type,
            'target': goal.target, 'revenue_usd': goal.revenue_usd}


@router.delete('/api/v1/goals/{goal_id}')
def delete_goal(goal_id: int, db: Session = Depends(get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user)
    goal = db.query(models.Goal).filter(models.Goal.id == goal_id, models.Goal.project_id.in_(ids)).first() if ids else None
    if not goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    db.delete(goal)
    db.commit()
    return {'ok': True}


# ----------------------------------------------------------- 4. feedback
class FeedbackCreate(BaseModel):
    api_key: Optional[str] = None
    rating: int
    comment: Optional[str] = None
    url: Optional[str] = ''
    session_id: Optional[str] = None
    trigger: Optional[str] = 'widget'
    browser: Optional[str] = None


class FeedbackSettings(BaseModel):
    enabled: bool
    prompt: Optional[str] = None
    project_id: Optional[int] = None


def _sentiment(rating: int) -> str:
    return 'positive' if rating >= 4 else ('neutral' if rating == 3 else 'negative')


@router.post('/api/v1/feedback')
def submit_feedback(data: FeedbackCreate, request: Request, db: Session = Depends(get_db)):
    project = _project_from_key(db, _request_key(request, data.api_key))
    if not 1 <= data.rating <= 5:
        raise HTTPException(status_code=422, detail='rating must be between 1 and 5')
    if data.session_id:
        recent = db.query(models.Feedback).filter(
            models.Feedback.project_id == project.id, models.Feedback.session_id == data.session_id,
            models.Feedback.created_at >= datetime.utcnow() - timedelta(hours=1)).count()
        if recent >= 5:
            raise HTTPException(status_code=429, detail='Too many feedback submissions for this session')
    trigger = data.trigger if data.trigger in ('widget', 'rage_click') else 'widget'
    fb = models.Feedback(project_id=project.id, session_id=data.session_id, rating=data.rating,
                         sentiment=_sentiment(data.rating), comment=(data.comment or '').strip()[:1000] or None,
                         url=(data.url or '')[:500], browser=(data.browser or 'Chrome')[:50], trigger=trigger)
    db.add(fb)
    db.commit()
    return {'status': 'received', 'id': fb.id}


@router.get('/api/v1/feedback/config')
def public_feedback_config(request: Request, api_key: Optional[str] = None, db: Session = Depends(get_db)):
    """Public (api_key authorised): lets te.js decide whether to render the widget."""
    project = _project_from_key(db, _request_key(request, api_key))
    cfg = db.query(models.FeedbackConfig).filter(models.FeedbackConfig.project_id == project.id).first()
    return {'enabled': bool(cfg and cfg.enabled), 'prompt': (cfg.prompt if cfg else None) or 'How is your experience?'}


@router.get('/api/v1/feedback/settings')
def get_feedback_settings(project_id: Optional[int] = None, db: Session = Depends(get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        return {'enabled': False, 'prompt': 'How is your experience?', 'project_id': None}
    cfg = db.query(models.FeedbackConfig).filter(models.FeedbackConfig.project_id == ids[0]).first()
    return {'enabled': bool(cfg and cfg.enabled), 'prompt': (cfg.prompt if cfg else None) or 'How is your experience?',
            'project_id': ids[0]}


@router.put('/api/v1/feedback/settings')
def update_feedback_settings(data: FeedbackSettings, db: Session = Depends(get_db),
                             current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, data.project_id)
    if not ids:
        raise HTTPException(status_code=404, detail='Project not found')
    cfg = db.query(models.FeedbackConfig).filter(models.FeedbackConfig.project_id == ids[0]).first()
    if not cfg:
        cfg = models.FeedbackConfig(project_id=ids[0])
        db.add(cfg)
    cfg.enabled = data.enabled
    if data.prompt is not None and data.prompt.strip():
        cfg.prompt = data.prompt.strip()[:140]
    db.commit()
    return {'enabled': cfg.enabled, 'prompt': cfg.prompt, 'project_id': ids[0]}


@router.get('/api/v1/analytics/feedback')
def feedback_analytics(limit: int = 100, db: Session = Depends(get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user)
    summary = {'total': 0, 'average_rating': 0.0, 'positive': 0, 'neutral': 0, 'negative': 0,
               'positive_pct': 0, 'neutral_pct': 0, 'negative_pct': 0}
    if not ids:
        return {'summary': summary, 'items': []}
    rows = db.query(models.Feedback).filter(models.Feedback.project_id.in_(ids)) \
        .order_by(models.Feedback.created_at.desc()).all()
    total = len(rows)
    if total:
        counts = {s: sum(1 for r in rows if r.sentiment == s) for s in ('positive', 'neutral', 'negative')}
        summary = {'total': total, 'average_rating': round(sum(r.rating for r in rows) / total, 2), **counts,
                   **{f'{s}_pct': round(c * 100 / total) for s, c in counts.items()}}
    sids = [r.session_id for r in rows[:limit] if r.session_id]
    with_replay = {s for (s,) in db.query(models.SessionRecording.session_id).filter(
        models.SessionRecording.project_id.in_(ids), models.SessionRecording.session_id.in_(sids)).all()} if sids else set()
    items = [{'id': r.id, 'rating': r.rating, 'sentiment': r.sentiment, 'comment': r.comment, 'url': r.url,
              'browser': r.browser, 'trigger': r.trigger, 'session_id': r.session_id,
              'has_replay': r.session_id in with_replay, 'created_at': r.created_at.isoformat()}
             for r in rows[:max(1, min(limit, 500))]]
    return {'summary': summary, 'items': items}


@router.post('/api/v1/feedback/simulate')
def simulate_feedback(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user)
    if not ids:
        raise HTTPException(status_code=400, detail='No project registered')
    project = db.query(models.Project).filter(models.Project.id == ids[0]).first()
    domain = (project.domain or 'example.com').replace('https://', '').replace('http://', '').strip('/')
    samples = [
        (5, 'Loved how fast the pricing page loaded!', '/pricing', 'widget'),
        (4, 'Easy to find what I needed.', '/', 'widget'),
        (3, 'Checkout felt a bit long.', '/checkout', 'widget'),
        (2, 'The submit button did not respond, I had to click it several times.', '/contact', 'rage_click'),
    ]
    for rating, comment, path, trig in samples:
        db.add(models.Feedback(project_id=project.id, session_id=None, rating=rating, sentiment=_sentiment(rating),
                               comment=comment, url=f'https://{domain}{path}', browser='Chrome', trigger=trig))
    db.commit()
    return {'created': len(samples)}
