"""ThirdEye AI Copilot & Engineering Intelligence Suite.

1. AI RAG Workspace Copilot (/api/v1/copilot/ask & /context)
2. Release & Deployment Impact Tracker (/api/v1/releases)
3. Browser Network XHR / Fetch Failure Inspector (/api/v1/network/requests)
4. User Retention Cohort Matrix (/api/v1/analytics/cohorts)

All endpoints strictly multi-tenant isolated by organization projects.
Public ingestion endpoints require valid project api_key.
"""
import os
import re
import uuid
import json
import logging
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, models
from app.database import get_db

logger = logging.getLogger("intelligence")
router = APIRouter()
EVENT_SCAN_LIMIT = 100000


def _project_ids(db: Session, user: models.User, project_id: Optional[int] = None) -> List[int]:
    q = db.query(models.Project.id).filter(models.Project.organization_id == user.organization_id)
    ids = [r[0] for r in q.all()]
    if project_id is not None:
        return [project_id] if project_id in ids else []
    return ids


def _project_from_key(db: Session, key: Optional[str]) -> models.Project:
    if not key or not key.strip():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or missing API key')
    project = db.query(models.Project).filter(models.Project.api_key == key.strip()).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid or missing API key')
    return project


def _request_key(request: Request, body_key: Optional[str] = None) -> Optional[str]:
    return body_key or request.headers.get('data-key') or request.headers.get('x-api-key')


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


# =====================================================================
# 1. AI RAG WORKSPACE COPILOT
# =====================================================================
class CopilotAskRequest(BaseModel):
    query: str
    persona: Optional[str] = 'engineering'  # engineering, product, growth, executive
    project_id: Optional[int] = None


@router.get('/api/v1/copilot/context')
def get_copilot_context(project_id: Optional[int] = None, db: Session = Depends(get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        return {'error': 'No project found'}
    pid = ids[0]
    project = db.query(models.Project).filter(models.Project.id == pid).first()
    now = datetime.utcnow()
    since_7d = now - timedelta(days=7)

    # Telemetry snapshot
    events = db.query(models.Event).filter(models.Event.project_id == pid, models.Event.created_at >= since_7d).all()
    sessions = {e.session_id for e in events if e.session_id}
    code_errors = [e for e in events if e.event_type == 'code_error']
    rage_clicks = [e for e in events if e.event_type == 'rage_click']

    vitals = db.query(models.WebVital).filter(models.WebVital.project_id == pid, models.WebVital.created_at >= since_7d).all()
    avg_lcp = int(sum(v.lcp_ms for v in vitals if v.lcp_ms) / len([v for v in vitals if v.lcp_ms])) if vitals else 0

    monitors = db.query(models.UptimeMonitor).filter(models.UptimeMonitor.project_id == pid).all()
    down_monitors = [m for m in monitors if m.status == 'down']

    feedbacks = db.query(models.Feedback).filter(models.Feedback.project_id == pid, models.Feedback.created_at >= since_7d).all()
    avg_csat = round(sum(f.rating for f in feedbacks) / len(feedbacks), 2) if feedbacks else 5.0

    network_fails = db.query(models.NetworkRequest).filter(
        models.NetworkRequest.project_id == pid,
        models.NetworkRequest.status_code >= 400,
        models.NetworkRequest.created_at >= since_7d
    ).count()

    releases = db.query(models.Release).filter(models.Release.project_id == pid).order_by(models.Release.created_at.desc()).limit(3).all()
    goals = db.query(models.Goal).filter(models.Goal.project_id == pid, models.Goal.is_active == True).all()

    return {
        'project_name': project.name if project else 'Workspace',
        'domain': project.domain if project else '',
        'total_sessions_7d': len(sessions),
        'total_events_7d': len(events),
        'code_errors_7d': len(code_errors),
        'rage_clicks_7d': len(rage_clicks),
        'network_api_failures_7d': network_fails,
        'avg_lcp_ms': avg_lcp,
        'uptime_monitors_total': len(monitors),
        'uptime_monitors_down': len(down_monitors),
        'avg_csat_score': avg_csat,
        'active_goals': len(goals),
        'recent_releases': [{'version': r.version, 'deployed_by': r.deployed_by, 'created_at': r.created_at.isoformat()} for r in releases]
    }


@router.post('/api/v1/copilot/ask')
def ask_copilot(req: CopilotAskRequest, db: Session = Depends(get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    q = (req.query or '').strip()
    if not q:
        raise HTTPException(status_code=422, detail='Query cannot be empty')
    
    ctx = get_copilot_context(req.project_id, db, current_user)
    persona = req.persona or 'engineering'

    # Deterministic ground-truth synthesized response
    q_lower = q.lower()
    citations = []
    actions = []

    if re.search(r'\b(error|errors|bug|bugs|crash|crashes|fail|fails|failing|failure|failures)\b', q_lower):
        title = "Error & Reliability Diagnosis"
        summary = f"Detected {ctx.get('code_errors_7d', 0)} JavaScript code errors and {ctx.get('network_api_failures_7d', 0)} browser API network failures over the last 7 days."
        if ctx.get('code_errors_7d', 0) > 0:
            actions.append("Inspect `/analytics/errors` to group errors by stack trace and frequency.")
        if ctx.get('network_api_failures_7d', 0) > 0:
            actions.append("Review `/devops/network` to isolate failing backend microservices (4xx/5xx).")
        if not actions:
            actions.append("System is clean with 0 recorded runtime crashes. Continue monitoring `/devops/network` and `/analytics/errors`.")
        citations.append(f"Code Errors (7d): {ctx.get('code_errors_7d', 0)}")
        citations.append(f"Network Failures: {ctx.get('network_api_failures_7d', 0)}")
    elif re.search(r'\b(conversion|conversions|goal|goals|sale|sales|revenue|funnel|funnels)\b', q_lower):
        title = "Conversion & Growth Intelligence"
        summary = f"Currently tracking {ctx.get('active_goals', 0)} active business conversion goals across {ctx.get('total_sessions_7d', 0)} recent visitor sessions."
        actions.append("Examine `/analytics/goals` to track goal completions and revenue attribution.")
        actions.append("Visit `/analytics/journeys` to review conversion path funnels and drop-off rates.")
        citations.append(f"Active Goals: {ctx.get('active_goals', 0)}")
        citations.append(f"Sessions: {ctx.get('total_sessions_7d', 0)}")
    elif re.search(r'\b(speed|slow|performance|vitals?|lcp|latency)\b', q_lower):
        title = "Core Web Vitals & Speed Assessment"
        lcp = ctx.get('avg_lcp_ms', 0)
        status_lcp = "Good (<= 2.5s)" if lcp <= 2500 else ("Needs Improvement" if lcp <= 4000 else "Poor (> 4.0s)")
        summary = f"Average Largest Contentful Paint (LCP) is {lcp}ms ({status_lcp})."
        actions.append("Check `/performance` for route-by-route Core Web Vitals breakdown.")
        if lcp > 2500:
            actions.append("Optimize hero image loading and preload critical web fonts.")
        citations.append(f"Avg LCP: {lcp}ms")
    elif re.search(r'\b(release|releases|deploy|deploys|deployment|version|versions)\b', q_lower):
        title = "Release Impact Analysis"
        rels = ctx.get('recent_releases', [])
        latest = rels[0]['version'] if rels else 'No releases recorded'
        summary = f"Most recent deployment tracked is {latest}. Monitoring post-release error and performance deltas."
        actions.append("Visit `/devops/releases` to compare pre- vs post-deployment metrics.")
        citations.append(f"Latest Release: {latest}")
    else:
        # General workspace executive briefing
        title = f"Workspace Intelligence Overview ({persona.capitalize()})"
        summary = f"Workspace `{ctx.get('domain', 'Connected')}` has tracked {ctx.get('total_events_7d', 0)} events across {ctx.get('total_sessions_7d', 0)} visitor sessions in the past 7 days. Average CSAT feedback score is {ctx.get('avg_csat_score', 5.0)}/5.0."
        actions.append("Review `/live` for real-time visitor presence.")
        actions.append("Review `/analytics/feedback` for voice-of-customer ratings and rage-click responses.")
        citations.append(f"Sessions: {ctx.get('total_sessions_7d', 0)}")
        citations.append(f"CSAT: {ctx.get('avg_csat_score', 5.0)}/5.0")

    # Optional Google Gemini enrichment if API key is present
    gemini_key = os.getenv("GEMINI_API_KEY")
    ai_answer = None
    if gemini_key:
        try:
            import urllib.request as ur
            prompt = f"You are ThirdEye AI Copilot for {ctx.get('domain')}. User Persona: {persona}.\nWorkspace Stats: {json.dumps(ctx)}\nUser Question: {q}\nProvide a concise 2-3 paragraph professional diagnostic answer with specific recommendations."
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
            payload = {"contents": [{"parts": [{"text": prompt}]}]}
            req_gem = ur.Request(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"})
            with ur.urlopen(req_gem, timeout=6) as resp:
                data_gem = json.loads(resp.read().decode("utf-8"))
                ai_answer = data_gem["candidates"][0]["content"]["parts"][0]["text"]
        except Exception as ex:
            logger.warning(f"Gemini LLM call failed: {ex}")

    return {
        'title': title,
        'summary': summary,
        'persona': persona,
        'ai_analysis': ai_answer or summary,
        'recommended_actions': actions,
        'metrics_cited': citations,
        'context_snapshot': ctx
    }


# =====================================================================
# 2. RELEASE & DEPLOYMENT IMPACT TRACKER
# =====================================================================
class ReleaseCreate(BaseModel):
    version: str
    commit_sha: Optional[str] = None
    environment: Optional[str] = 'production'
    notes: Optional[str] = None
    deployed_by: Optional[str] = 'Manual'
    project_id: Optional[int] = None


class ReleaseWebhookPayload(BaseModel):
    api_key: Optional[str] = None
    version: str
    commit_sha: Optional[str] = None
    environment: Optional[str] = 'production'
    notes: Optional[str] = None
    deployed_by: Optional[str] = 'CI/CD'


@router.get('/api/v1/releases')
def list_releases(project_id: Optional[int] = None, db: Session = Depends(get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        return []
    releases = db.query(models.Release).filter(models.Release.project_id.in_(ids)).order_by(models.Release.created_at.desc()).all()
    out = []
    for r in releases:
        # Pre vs Post Impact Window (24 hours before vs 24 hours after release)
        window = timedelta(hours=24)
        pre_start = r.created_at - window
        post_end = r.created_at + window

        pre_errors = db.query(models.Event).filter(
            models.Event.project_id == r.project_id,
            models.Event.event_type == 'code_error',
            models.Event.created_at >= pre_start,
            models.Event.created_at < r.created_at
        ).count()

        post_errors = db.query(models.Event).filter(
            models.Event.project_id == r.project_id,
            models.Event.event_type == 'code_error',
            models.Event.created_at >= r.created_at,
            models.Event.created_at <= post_end
        ).count()

        err_delta = post_errors - pre_errors
        status_verdict = 'healthy'
        if err_delta >= 5:
            status_verdict = 'regression'
        elif err_delta <= -3 and pre_errors > 0:
            status_verdict = 'improved'

        out.append({
            'id': r.id,
            'project_id': r.project_id,
            'version': r.version,
            'commit_sha': r.commit_sha,
            'environment': r.environment,
            'notes': r.notes,
            'deployed_by': r.deployed_by,
            'created_at': r.created_at.isoformat(),
            'pre_errors': pre_errors,
            'post_errors': post_errors,
            'error_delta': err_delta,
            'status_verdict': status_verdict
        })
    return out


@router.post('/api/v1/releases')
def create_release(data: ReleaseCreate, db: Session = Depends(get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    if not data.version or not data.version.strip():
        raise HTTPException(status_code=422, detail='version is required')
    ids = _project_ids(db, current_user, data.project_id)
    if not ids:
        raise HTTPException(status_code=404 if data.project_id else 400, detail='Project not found')
    rel = models.Release(
        project_id=ids[0],
        version=data.version.strip()[:60],
        commit_sha=(data.commit_sha or '')[:40] or None,
        environment=(data.environment or 'production')[:40],
        notes=data.notes,
        deployed_by=(data.deployed_by or current_user.name or 'User')[:60]
    )
    db.add(rel)
    db.commit()
    db.refresh(rel)
    return {'id': rel.id, 'version': rel.version, 'environment': rel.environment, 'created_at': rel.created_at.isoformat()}


@router.post('/api/v1/releases/webhook')
def create_release_webhook(payload: ReleaseWebhookPayload, request: Request, db: Session = Depends(get_db)):
    key = _request_key(request, payload.api_key)
    project = _project_from_key(db, key)
    if not payload.version or not payload.version.strip():
        raise HTTPException(status_code=422, detail='version is required')
    rel = models.Release(
        project_id=project.id,
        version=payload.version.strip()[:60],
        commit_sha=(payload.commit_sha or '')[:40] or None,
        environment=(payload.environment or 'production')[:40],
        notes=payload.notes,
        deployed_by=(payload.deployed_by or 'CI/CD')[:60]
    )
    db.add(rel)
    db.commit()
    return {'status': 'recorded', 'id': rel.id, 'version': rel.version}


@router.delete('/api/v1/releases/{rel_id}')
def delete_release(rel_id: int, db: Session = Depends(get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user)
    rel = db.query(models.Release).filter(models.Release.id == rel_id, models.Release.project_id.in_(ids)).first() if ids else None
    if not rel:
        raise HTTPException(status_code=404, detail='Release not found')
    db.delete(rel)
    db.commit()
    return {'ok': True}


@router.post('/api/v1/releases/simulate')
def simulate_releases(project_id: Optional[int] = None, db: Session = Depends(get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        raise HTTPException(status_code=400, detail='No project found')
    pid = ids[0]
    now = datetime.utcnow()

    # Release 1 (Healthy): 3 days ago
    r1_time = now - timedelta(days=3)
    r1 = models.Release(
        project_id=pid,
        version="v2.3.0",
        commit_sha="a1b2c3d",
        environment="production",
        notes="Optimized bundle size and updated UI theme.",
        deployed_by="GitHub Actions",
        created_at=r1_time
    )
    db.add(r1)

    # Release 2 (Regression Spike): 12 hours ago
    r2_time = now - timedelta(hours=12)
    r2 = models.Release(
        project_id=pid,
        version="v2.4.0",
        commit_sha="e5f6g7h",
        environment="production",
        notes="Refactored checkout payment modal.",
        deployed_by="Render Deploy",
        created_at=r2_time
    )
    db.add(r2)

    # Add 6 post-release errors for r2 to trigger regression verdict
    for i in range(6):
        db.add(models.Event(
            project_id=pid,
            event_type='code_error',
            url='https://app.example.com/checkout',
            session_id=f'sim_rel_err_{i}',
            properties={'message': 'TypeError: Cannot read properties of undefined (reading StripeCheckout)'},
            created_at=r2_time + timedelta(hours=1, minutes=i * 10)
        ))

    db.commit()
    return {'status': 'simulated', 'releases_created': 2}


# =====================================================================
# 3. BROWSER NETWORK XHR / FETCH FAILURE INSPECTOR
# =====================================================================
class NetworkCollectPayload(BaseModel):
    api_key: Optional[str] = None
    session_id: str
    page_url: str
    endpoint_url: str
    method: Optional[str] = 'GET'
    status_code: int
    duration_ms: Optional[int] = 0


@router.post('/api/v1/network/collect')
def collect_network_request(data: NetworkCollectPayload, request: Request, db: Session = Depends(get_db)):
    key = _request_key(request, data.api_key)
    project = _project_from_key(db, key)
    req_obj = models.NetworkRequest(
        project_id=project.id,
        session_id=(data.session_id or 'anon')[:80],
        page_url=(data.page_url or '/')[:500],
        endpoint_url=(data.endpoint_url or '')[:500],
        method=(data.method or 'GET')[:10],
        status_code=data.status_code,
        duration_ms=data.duration_ms or 0
    )
    db.add(req_obj)
    db.commit()
    return {'status': 'logged', 'id': req_obj.id}


@router.get('/api/v1/network/requests')
def list_network_requests(limit: int = 100, project_id: Optional[int] = None,
                          db: Session = Depends(get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    empty = {
        'kpis': {'total': 0, 'errors_5xx': 0, 'errors_4xx': 0, 'slow_requests': 0, 'p95_latency_ms': 0},
        'endpoints': [],
        'recent_requests': []
    }
    if not ids:
        return empty
    
    rows = db.query(models.NetworkRequest).filter(
        models.NetworkRequest.project_id.in_(ids)
    ).order_by(models.NetworkRequest.created_at.desc()).limit(max(1, min(limit, 500))).all()

    if not rows:
        return empty

    total = len(rows)
    err_5xx = sum(1 for r in rows if r.status_code >= 500)
    err_4xx = sum(1 for r in rows if 400 <= r.status_code < 500)
    slow_req = sum(1 for r in rows if r.duration_ms >= 1000)
    latencies = sorted([r.duration_ms for r in rows])
    p95_lat = latencies[int(len(latencies) * 0.95)] if latencies else 0

    # Aggregate by endpoint
    endpoint_map: Dict[str, Dict[str, Any]] = defaultdict(lambda: {'count': 0, 'fails': 0, 'durations': []})
    for r in rows:
        clean_ep = _path_of(r.endpoint_url)
        endpoint_map[clean_ep]['count'] += 1
        if r.status_code >= 400 or r.status_code == 0:
            endpoint_map[clean_ep]['fails'] += 1
        endpoint_map[clean_ep]['durations'].append(r.duration_ms)

    endpoints_list = []
    for ep, stats in sorted(endpoint_map.items(), key=lambda kv: -kv[1]['fails'])[:15]:
        avg_d = int(sum(stats['durations']) / len(stats['durations'])) if stats['durations'] else 0
        endpoints_list.append({
            'endpoint': ep,
            'total_calls': stats['count'],
            'failure_count': stats['fails'],
            'failure_rate': round(stats['fails'] * 100 / stats['count'], 1) if stats['count'] else 0.0,
            'avg_latency_ms': avg_d
        })

    recent = [{
        'id': r.id,
        'session_id': r.session_id,
        'page_url': r.page_url,
        'endpoint_url': r.endpoint_url,
        'method': r.method,
        'status_code': r.status_code,
        'duration_ms': r.duration_ms,
        'created_at': r.created_at.isoformat()
    } for r in rows[:50]]

    return {
        'kpis': {
            'total': total,
            'errors_5xx': err_5xx,
            'errors_4xx': err_4xx,
            'slow_requests': slow_req,
            'p95_latency_ms': p95_lat
        },
        'endpoints': endpoints_list,
        'recent_requests': recent
    }


@router.post('/api/v1/network/simulate')
def simulate_network_requests(project_id: Optional[int] = None, db: Session = Depends(get_db),
                              current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        raise HTTPException(status_code=400, detail='No project found')
    pid = ids[0]
    project = db.query(models.Project).filter(models.Project.id == pid).first()
    domain = (project.domain or 'example.com').replace('https://', '').replace('http://', '').strip('/')

    sim_samples = [
        ('/checkout', f'https://{domain}/api/checkout/pay', 'POST', 502, 1250),
        ('/checkout', f'https://{domain}/api/checkout/pay', 'POST', 504, 3400),
        ('/login', f'https://{domain}/api/auth/session', 'GET', 401, 180),
        ('/products', f'https://{domain}/api/search?q=premium', 'GET', 200, 1940),
        ('/settings', f'https://{domain}/api/billing/cards', 'GET', 500, 890),
        ('/cart', f'https://{domain}/api/cart/items', 'POST', 429, 320)
    ]
    for page, ep, method, status_code, dur in sim_samples:
        db.add(models.NetworkRequest(
            project_id=pid,
            session_id=f'net_sim_{uuid.uuid4().hex[:6]}',
            page_url=f'https://{domain}{page}',
            endpoint_url=ep,
            method=method,
            status_code=status_code,
            duration_ms=dur
        ))
    db.commit()
    return {'created': len(sim_samples)}


# =====================================================================
# 4. USER RETENTION COHORT MATRIX
# =====================================================================
@router.get('/api/v1/analytics/cohorts')
def get_retention_cohorts(weeks: int = 5, project_id: Optional[int] = None,
                          db: Session = Depends(get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        return {'cohorts': [], 'avg_retention': []}

    now = datetime.utcnow()
    since = now - timedelta(weeks=weeks + 1)
    events = db.query(models.Event).filter(
        models.Event.project_id.in_(ids),
        models.Event.created_at >= since
    ).order_by(models.Event.created_at.asc()).all()

    if not events:
        return {'cohorts': [], 'avg_retention': []}

    # First seen per session
    first_seen: Dict[str, datetime] = {}
    activity_weeks: Dict[str, set] = defaultdict(set)

    for e in events:
        if not e.session_id:
            continue
        sid = e.session_id
        if sid not in first_seen or e.created_at < first_seen[sid]:
            first_seen[sid] = e.created_at

    for e in events:
        if not e.session_id:
            continue
        sid = e.session_id
        start_date = first_seen[sid]
        diff_weeks = int((e.created_at - start_date).days / 7)
        if 0 <= diff_weeks < weeks:
            activity_weeks[sid].add(diff_weeks)

    # Group cohorts by start week label
    cohorts_dict: Dict[str, set] = defaultdict(set)
    for sid, dt in first_seen.items():
        week_label = dt.strftime("Week %U (%b %d)")
        cohorts_dict[week_label].add(sid)

    cohorts_out = []
    period_sums = defaultdict(float)
    period_counts = defaultdict(int)

    for label, sids in sorted(cohorts_dict.items())[-weeks:]:
        size = len(sids)
        row = {'cohort': label, 'size': size, 'retention': []}
        for w in range(weeks):
            retained = sum(1 for sid in sids if w in activity_weeks[sid])
            pct = round(retained * 100 / size, 1) if size else 0.0
            row['retention'].append(pct)
            period_sums[w] += pct
            period_counts[w] += 1
        cohorts_out.append(row)

    avg_ret = [
        round(period_sums[w] / period_counts[w], 1) if period_counts[w] else 0.0
        for w in range(weeks)
    ]

    return {'cohorts': cohorts_out, 'avg_retention': avg_ret}


@router.post('/api/v1/analytics/cohorts/simulate')
def simulate_retention_cohorts(project_id: Optional[int] = None, db: Session = Depends(get_db),
                               current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        raise HTTPException(status_code=400, detail='No project found')
    pid = ids[0]
    now = datetime.utcnow()

    # Simulate 4 weekly cohorts with natural drop-off (100% -> 45% -> 30% -> 22%)
    created = 0
    for w in range(4):
        cohort_time = now - timedelta(weeks=4 - w)
        for i in range(10):
            sid = f'cohort_w{w}_user_{i}_{uuid.uuid4().hex[:4]}'
            # Week 0 event
            db.add(models.Event(
                project_id=pid,
                event_type='pageview',
                url='https://app.example.com/',
                session_id=sid,
                created_at=cohort_time
            ))
            created += 1
            # Week 1 event (40% retain)
            if i < 4:
                db.add(models.Event(
                    project_id=pid,
                    event_type='pageview',
                    url='https://app.example.com/dashboard',
                    session_id=sid,
                    created_at=cohort_time + timedelta(weeks=1, hours=3)
                ))
                created += 1
            # Week 2 event (20% retain)
            if i < 2:
                db.add(models.Event(
                    project_id=pid,
                    event_type='pageview',
                    url='https://app.example.com/reports',
                    session_id=sid,
                    created_at=cohort_time + timedelta(weeks=2, hours=5)
                ))
                created += 1
    db.commit()
    return {'created_events': created}
