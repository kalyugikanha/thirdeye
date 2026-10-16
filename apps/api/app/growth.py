"""ThirdEye Growth & Optimization Suite.

Multi-Domain Project Switcher, Core Web Vitals & Real User Monitoring (RUM),
Privacy-Safe Form & Checkout Abandonment Analytics, and A/B Testing & Feature Flags.

All authenticated endpoints are strictly scoped to the caller's organization projects.
Public SDK endpoints are authenticated via project api_key.
"""
import uuid
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, models
from app.database import get_db

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


# ------------------------------------------- 1. Multi-Domain Project Switcher
class ProjectCreateRequest(BaseModel):
    name: Optional[str] = None
    domain: str


@router.get('/api/v1/projects')
def list_organization_projects(db: Session = Depends(get_db),
                               current_user: models.User = Depends(auth.get_current_user)):
    projects = db.query(models.Project).filter(
        models.Project.organization_id == current_user.organization_id
    ).order_by(models.Project.id.asc()).all()
    out = []
    for p in projects:
        ev = db.query(models.Event).filter(models.Event.project_id == p.id).count()
        rec = db.query(models.SessionRecording).filter(models.SessionRecording.project_id == p.id).count()
        out.append({
            'id': p.id,
            'name': p.name,
            'domain': p.domain,
            'api_key': p.api_key,
            'dns_verified': bool(p.dns_verified),
            'is_connected': ev > 0 or rec > 0 or bool(p.dns_verified),
            'total_events': ev,
            'total_recordings': rec,
        })
    return out


@router.post('/api/v1/projects')
def create_organization_project(data: ProjectCreateRequest, db: Session = Depends(get_db),
                                current_user: models.User = Depends(auth.get_current_user)):
    clean_domain = (data.domain or '').replace('https://', '').replace('http://', '').strip().strip('/')
    if not clean_domain or '.' not in clean_domain:
        raise HTTPException(status_code=422, detail='A valid domain (e.g. app.example.com) is required')
    org = db.query(models.Organization).filter(models.Organization.id == current_user.organization_id).first()
    existing_count = db.query(models.Project).filter(
        models.Project.organization_id == current_user.organization_id
    ).count()
    plan_name = (org.plan if org and org.plan else 'Pro').lower()
    if plan_name in ('free', 'starter') and existing_count >= 3:
        raise HTTPException(status_code=403, detail='Starter plan supports up to 3 domains. Upgrade to Pro for unlimited domains.')

    proj_name = (data.name or clean_domain).strip()[:100]
    api_key = f'te_live_{uuid.uuid4().hex[:24]}'
    dns_token = f'thirdeye-verify={uuid.uuid4().hex[:16]}'
    proj = models.Project(
        name=proj_name,
        domain=clean_domain,
        api_key=api_key,
        dns_verified=False,
        dns_token=dns_token,
        organization_id=current_user.organization_id,
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return {
        'id': proj.id,
        'name': proj.name,
        'domain': proj.domain,
        'api_key': proj.api_key,
        'dns_token': proj.dns_token,
        'dns_verified': False,
        'is_connected': False,
    }


# ------------------------------------------- 2. Core Web Vitals & RUM
class WebVitalPayload(BaseModel):
    api_key: Optional[str] = None
    session_id: str
    url: str
    device: Optional[str] = 'Desktop'
    lcp_ms: Optional[int] = None
    fid_ms: Optional[int] = None
    inp_ms: Optional[int] = None
    cls_score: Optional[float] = None
    ttfb_ms: Optional[int] = None


def _percentile_75(values: List[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = min(len(s) - 1, max(0, int(round(0.75 * (len(s) - 1)))))
    return s[idx]


def _rate_lcp(ms: float) -> str:
    return 'good' if ms <= 2500 else ('needs_improvement' if ms <= 4000 else 'poor')


def _rate_inp(ms: float) -> str:
    return 'good' if ms <= 200 else ('needs_improvement' if ms <= 500 else 'poor')


def _rate_cls(score: float) -> str:
    return 'good' if score <= 0.1 else ('needs_improvement' if score <= 0.25 else 'poor')


def _rate_ttfb(ms: float) -> str:
    return 'good' if ms <= 800 else ('needs_improvement' if ms <= 1800 else 'poor')


@router.post('/api/v1/rum/vitals')
def ingest_web_vitals(data: WebVitalPayload, request: Request, db: Session = Depends(get_db)):
    project = _project_from_key(db, _request_key(request, data.api_key))
    cls_str = f'{float(data.cls_score):.3f}' if data.cls_score is not None else None
    vital = models.WebVital(
        project_id=project.id,
        session_id=(data.session_id or 'anon')[:80],
        url=(data.url or '/')[:500],
        device=(data.device or 'Desktop')[:30],
        lcp_ms=data.lcp_ms,
        fid_ms=data.fid_ms,
        inp_ms=data.inp_ms if data.inp_ms is not None else data.fid_ms,
        cls_score=cls_str,
        ttfb_ms=data.ttfb_ms,
    )
    db.add(vital)
    db.commit()
    return {'status': 'recorded', 'id': vital.id}


@router.get('/api/v1/rum/vitals')
def get_web_vitals_summary(days: int = 30, project_id: Optional[int] = None,
                           db: Session = Depends(get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    empty = {
        'total_samples': 0,
        'res_score': 0,
        'status': 'no_data',
        'metrics': {
            'lcp': {'p75': 0, 'unit': 'ms', 'rating': 'good'},
            'inp': {'p75': 0, 'unit': 'ms', 'rating': 'good'},
            'cls': {'p75': 0.0, 'unit': '', 'rating': 'good'},
            'ttfb': {'p75': 0, 'unit': 'ms', 'rating': 'good'},
        },
        'routes': [],
        'devices': [],
    }
    if not ids:
        return empty
    since = datetime.utcnow() - timedelta(days=max(1, min(days, 365)))
    rows = db.query(models.WebVital).filter(
        models.WebVital.project_id.in_(ids),
        models.WebVital.created_at >= since,
    ).order_by(models.WebVital.created_at.desc()).limit(10000).all()
    if not rows:
        return empty

    lcps = [float(r.lcp_ms) for r in rows if r.lcp_ms is not None]
    inps = [float(r.inp_ms) for r in rows if r.inp_ms is not None]
    clss = [float(r.cls_score) for r in rows if r.cls_score is not None]
    ttfbs = [float(r.ttfb_ms) for r in rows if r.ttfb_ms is not None]

    p75_lcp = int(round(_percentile_75(lcps))) if lcps else 0
    p75_inp = int(round(_percentile_75(inps))) if inps else 0
    p75_cls = round(_percentile_75(clss), 3) if clss else 0.0
    p75_ttfb = int(round(_percentile_75(ttfbs))) if ttfbs else 0

    r_lcp = _rate_lcp(p75_lcp)
    r_inp = _rate_inp(p75_inp)
    r_cls = _rate_cls(p75_cls)
    r_ttfb = _rate_ttfb(p75_ttfb)

    pts = {'good': 25, 'needs_improvement': 15, 'poor': 5}
    res_score = pts[r_lcp] + pts[r_inp] + pts[r_cls] + pts[r_ttfb]

    by_route: Dict[str, List[models.WebVital]] = defaultdict(list)
    by_device: Dict[str, List[models.WebVital]] = defaultdict(list)
    for r in rows:
        by_route[_path_of(r.url)].append(r)
        by_device[r.device or 'Desktop'].append(r)

    routes = []
    for path, items in sorted(by_route.items(), key=lambda kv: -len(kv[1]))[:15]:
        rl = int(round(_percentile_75([float(x.lcp_ms) for x in items if x.lcp_ms is not None])))
        ri = int(round(_percentile_75([float(x.inp_ms) for x in items if x.inp_ms is not None])))
        rc = round(_percentile_75([float(x.cls_score) for x in items if x.cls_score is not None]), 3)
        rt = int(round(_percentile_75([float(x.ttfb_ms) for x in items if x.ttfb_ms is not None])))
        routes.append({
            'path': path,
            'samples': len(items),
            'lcp_p75': rl,
            'inp_p75': ri,
            'cls_p75': rc,
            'ttfb_p75': rt,
            'rating': _rate_lcp(rl),
        })

    devices = []
    for dev, items in sorted(by_device.items(), key=lambda kv: -len(kv[1])):
        dl = int(round(_percentile_75([float(x.lcp_ms) for x in items if x.lcp_ms is not None])))
        devices.append({
            'device': dev,
            'samples': len(items),
            'percentage': round(len(items) * 100 / len(rows), 1),
            'lcp_p75': dl,
            'rating': _rate_lcp(dl),
        })

    return {
        'total_samples': len(rows),
        'res_score': res_score,
        'status': 'good' if res_score >= 85 else ('needs_improvement' if res_score >= 60 else 'poor'),
        'metrics': {
            'lcp': {'p75': p75_lcp, 'unit': 'ms', 'rating': r_lcp},
            'inp': {'p75': p75_inp, 'unit': 'ms', 'rating': r_inp},
            'cls': {'p75': p75_cls, 'unit': '', 'rating': r_cls},
            'ttfb': {'p75': p75_ttfb, 'unit': 'ms', 'rating': r_ttfb},
        },
        'routes': routes,
        'devices': devices,
    }


@router.post('/api/v1/rum/simulate')
def simulate_web_vitals(project_id: Optional[int] = None, db: Session = Depends(get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        raise HTTPException(status_code=400, detail='No project registered')
    project = db.query(models.Project).filter(models.Project.id == ids[0]).first()
    domain = (project.domain or 'example.com').replace('https://', '').replace('http://', '').strip('/')
    samples = [
        ('/', 'Desktop', 1420, 85, '0.020', 210),
        ('/', 'Mobile', 2180, 140, '0.045', 340),
        ('/pricing', 'Desktop', 1650, 95, '0.030', 240),
        ('/pricing', 'Mobile', 2680, 210, '0.090', 410),
        ('/checkout', 'Desktop', 1890, 120, '0.040', 280),
        ('/blog', 'Desktop', 1290, 70, '0.015', 190),
    ]
    for path, dev, lcp, inp, cls_s, ttfb in samples:
        db.add(models.WebVital(
            project_id=project.id,
            session_id=f'sim_cwv_{uuid.uuid4().hex[:6]}',
            url=f'https://{domain}{path}',
            device=dev,
            lcp_ms=lcp,
            fid_ms=inp,
            inp_ms=inp,
            cls_score=cls_s,
            ttfb_ms=ttfb,
        ))
    db.commit()
    return {'created': len(samples)}


# ------------------------------------------- 3. Form & Checkout Abandonment
@router.get('/api/v1/analytics/forms')
def get_form_analytics(days: int = 30, project_id: Optional[int] = None,
                       db: Session = Depends(get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    empty = {
        'kpis': {'total_starts': 0, 'total_submissions': 0, 'completion_rate': 0.0, 'abandonment_rate': 0.0},
        'forms': [],
    }
    if not ids:
        return empty
    since = datetime.utcnow() - timedelta(days=max(1, min(days, 365)))
    rows = db.query(models.Event).filter(
        models.Event.project_id.in_(ids),
        models.Event.event_type.in_(['form_focus', 'form_submit', 'form_abandon']),
        models.Event.created_at >= since,
    ).order_by(models.Event.created_at.asc()).limit(EVENT_SCAN_LIMIT).all()
    if not rows:
        return empty

    forms_map: Dict[str, Dict[str, Any]] = {}
    for ev in rows:
        props = ev.properties or {}
        form_id = props.get('form_id') or f"{_path_of(ev.url)}#form"
        entry = forms_map.setdefault(form_id, {
            'form_id': form_id,
            'url': _path_of(ev.url),
            'starters': set(),
            'submitters': set(),
            'abandoners': set(),
            'fields': defaultdict(lambda: {'touches': set(), 'durations': [], 'dropoffs': set()}),
        })
        sid = ev.session_id or f'anon_{ev.id}'
        field_name = props.get('field') or 'input'
        dur = props.get('duration_ms')

        if ev.event_type == 'form_focus':
            entry['starters'].add(sid)
            fobj = entry['fields'][field_name]
            fobj['touches'].add(sid)
            if isinstance(dur, (int, float)) and dur >= 0:
                fobj['durations'].append(float(dur))
        elif ev.event_type == 'form_submit':
            entry['starters'].add(sid)
            entry['submitters'].add(sid)
        elif ev.event_type == 'form_abandon':
            entry['starters'].add(sid)
            entry['abandoners'].add(sid)
            last_field = props.get('last_field') or field_name
            entry['fields'][last_field]['touches'].add(sid)
            entry['fields'][last_field]['dropoffs'].add(sid)

    forms_out = []
    total_starts = 0
    total_subs = 0

    for fid, fdata in forms_map.items():
        starts = len(fdata['starters'])
        subs = len(fdata['submitters'])
        abandoned_sids = sorted(fdata['starters'] - fdata['submitters'])
        total_starts += starts
        total_subs += subs
        comp_rate = round(subs * 100 / starts, 1) if starts else 0.0
        aban_rate = round(100.0 - comp_rate, 1) if starts else 0.0

        fields_list = []
        for fname, fstats in fdata['fields'].items():
            touches = len(fstats['touches'])
            drops = len(fstats['dropoffs'] - fdata['submitters'])
            avg_ms = int(round(sum(fstats['durations']) / len(fstats['durations']))) if fstats['durations'] else 850
            fields_list.append({
                'field': fname,
                'interactions': touches,
                'avg_duration_ms': avg_ms,
                'drop_off_count': drops,
                'drop_off_pct': round(drops * 100 / max(touches, 1), 1),
            })
        fields_list.sort(key=lambda x: -x['interactions'])

        forms_out.append({
            'form_id': fid,
            'url': fdata['url'],
            'starts': starts,
            'submissions': subs,
            'completion_rate': comp_rate,
            'abandonment_rate': aban_rate,
            'abandoned_session_ids': abandoned_sids[:5],
            'fields': fields_list,
        })

    forms_out.sort(key=lambda x: -x['starts'])
    overall_comp = round(total_subs * 100 / total_starts, 1) if total_starts else 0.0
    return {
        'kpis': {
            'total_starts': total_starts,
            'total_submissions': total_subs,
            'completion_rate': overall_comp,
            'abandonment_rate': round(100.0 - overall_comp, 1) if total_starts else 0.0,
        },
        'forms': forms_out,
    }


@router.post('/api/v1/analytics/forms/simulate')
def simulate_form_analytics(project_id: Optional[int] = None, db: Session = Depends(get_db),
                            current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        raise HTTPException(status_code=400, detail='No project registered')
    project = db.query(models.Project).filter(models.Project.id == ids[0]).first()
    domain = (project.domain or 'example.com').replace('https://', '').replace('http://', '').strip('/')
    url = f'https://{domain}/checkout'
    form_id = 'checkout-form'

    # 5 sessions start the checkout form; 2 complete, 3 abandon on phone / card_number
    scenarios = [
        ('fsim_1', [('email', 1100), ('full_name', 1400), ('phone', 2800), ('card_number', 3400)], True, None),
        ('fsim_2', [('email', 950), ('full_name', 1200), ('phone', 2100), ('card_number', 2900)], True, None),
        ('fsim_3', [('email', 1300), ('full_name', 1600), ('phone', 4900)], False, 'phone'),
        ('fsim_4', [('email', 1050), ('full_name', 1500), ('phone', 3100), ('card_number', 6200)], False, 'card_number'),
        ('fsim_5', [('email', 1200), ('full_name', 1750), ('phone', 3800), ('card_number', 5800)], False, 'card_number'),
    ]
    created = 0
    for sid, fields, submitted, abandon_field in scenarios:
        for fname, dur in fields:
            db.add(models.Event(
                project_id=project.id,
                event_type='form_focus',
                url=url,
                session_id=sid,
                properties={'form_id': form_id, 'field': fname, 'duration_ms': dur},
            ))
            created += 1
        if submitted:
            db.add(models.Event(
                project_id=project.id,
                event_type='form_submit',
                url=url,
                session_id=sid,
                properties={'form_id': form_id},
            ))
        else:
            db.add(models.Event(
                project_id=project.id,
                event_type='form_abandon',
                url=url,
                session_id=sid,
                properties={'form_id': form_id, 'last_field': abandon_field},
            ))
        created += 1
    db.commit()
    return {'created': created}


# ------------------------------------------- 4. A/B Testing & Feature Flags
class ExperimentCreate(BaseModel):
    key: str
    name: str
    target_url: str = '*'
    selector: Optional[str] = None
    control_text: Optional[str] = 'Control (A)'
    variant_text: Optional[str] = 'Variant (B)'
    goal_target: str = '/thank-you'
    traffic_split: int = 50
    project_id: Optional[int] = None


class ExperimentUpdate(BaseModel):
    status: str  # 'running' | 'paused'


@router.get('/api/v1/experiments/active')
def list_active_experiments_public(request: Request, api_key: Optional[str] = None, db: Session = Depends(get_db)):
    project = _project_from_key(db, _request_key(request, api_key))
    exps = db.query(models.Experiment).filter(
        models.Experiment.project_id == project.id,
        models.Experiment.status == 'running',
    ).all()
    return [{
        'id': e.id,
        'key': e.key,
        'target_url': e.target_url,
        'selector': e.selector,
        'control_text': e.control_text,
        'variant_text': e.variant_text,
        'traffic_split': e.traffic_split,
    } for e in exps]


@router.post('/api/v1/experiments')
def create_experiment(data: ExperimentCreate, db: Session = Depends(get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    clean_key = (data.key or '').strip().lower().replace(' ', '_')
    if not clean_key or not data.name.strip():
        raise HTTPException(status_code=422, detail='key and name are required')
    if not 1 <= data.traffic_split <= 99:
        raise HTTPException(status_code=422, detail='traffic_split must be between 1 and 99')
    ids = _project_ids(db, current_user, data.project_id)
    if not ids:
        raise HTTPException(status_code=404 if data.project_id else 400, detail='Project not found')
    exp = models.Experiment(
        project_id=ids[0],
        key=clean_key[:80],
        name=data.name.strip()[:120],
        status='running',
        target_url=(data.target_url or '*').strip()[:200],
        selector=(data.selector or '').strip()[:200] or None,
        control_text=(data.control_text or 'Control (A)').strip()[:300],
        variant_text=(data.variant_text or 'Variant (B)').strip()[:300],
        goal_target=(data.goal_target or '/thank-you').strip()[:200],
        traffic_split=data.traffic_split,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    return {'id': exp.id, 'key': exp.key, 'name': exp.name, 'status': exp.status, 'project_id': exp.project_id}


@router.get('/api/v1/experiments')
def list_experiments(project_id: Optional[int] = None, db: Session = Depends(get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user, project_id)
    if not ids:
        return []
    exps = db.query(models.Experiment).filter(
        models.Experiment.project_id.in_(ids)
    ).order_by(models.Experiment.created_at.desc()).all()
    if not exps:
        return []

    events = db.query(models.Event).filter(
        models.Event.project_id.in_(ids),
        models.Event.event_type.in_(['experiment_exposure', 'pageview', 'click']),
    ).limit(EVENT_SCAN_LIMIT).all()

    out = []
    for e in exps:
        exposures = {'A': set(), 'B': set()}
        for ev in events:
            if ev.project_id != e.project_id or ev.event_type != 'experiment_exposure':
                continue
            props = ev.properties or {}
            if props.get('experiment_key') == e.key and ev.session_id:
                variant = 'B' if props.get('variant') in ('B', 'variant') else 'A'
                exposures[variant].add(ev.session_id)

        goal_want = _path_of(e.goal_target) if e.goal_target.startswith('/') or '://' in e.goal_target else e.goal_target
        converted_sessions = set()
        for ev in events:
            if ev.project_id != e.project_id or not ev.session_id:
                continue
            if e.goal_target.startswith('/') or '://' in e.goal_target:
                if ev.event_type == 'pageview' and _path_of(ev.url) == goal_want:
                    converted_sessions.add(ev.session_id)
            else:
                if ev.event_type == e.goal_target:
                    converted_sessions.add(ev.session_id)

        exp_a = len(exposures['A'])
        exp_b = len(exposures['B'])
        conv_a = len(exposures['A'] & converted_sessions)
        conv_b = len(exposures['B'] & converted_sessions)
        rate_a = round(conv_a * 100 / exp_a, 2) if exp_a else 0.0
        rate_b = round(conv_b * 100 / exp_b, 2) if exp_b else 0.0
        lift = round(((rate_b - rate_a) / rate_a) * 100, 1) if rate_a > 0 else (100.0 if rate_b > 0 else 0.0)
        winner = 'B' if rate_b > rate_a and conv_b > 0 else ('A' if rate_a > rate_b and conv_a > 0 else 'tie')

        out.append({
            'id': e.id,
            'project_id': e.project_id,
            'key': e.key,
            'name': e.name,
            'status': e.status,
            'target_url': e.target_url,
            'selector': e.selector,
            'control_text': e.control_text,
            'variant_text': e.variant_text,
            'goal_target': e.goal_target,
            'traffic_split': e.traffic_split,
            'control': {'exposures': exp_a, 'conversions': conv_a, 'conversion_rate': rate_a},
            'variant': {'exposures': exp_b, 'conversions': conv_b, 'conversion_rate': rate_b},
            'lift_pct': lift,
            'winner': winner,
            'created_at': e.created_at.isoformat(),
        })
    return out


@router.patch('/api/v1/experiments/{exp_id}')
def update_experiment_status(exp_id: int, data: ExperimentUpdate, db: Session = Depends(get_db),
                             current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user)
    exp = db.query(models.Experiment).filter(
        models.Experiment.id == exp_id,
        models.Experiment.project_id.in_(ids),
    ).first() if ids else None
    if not exp:
        raise HTTPException(status_code=404, detail='Experiment not found')
    if data.status not in ('running', 'paused'):
        raise HTTPException(status_code=422, detail='status must be running or paused')
    exp.status = data.status
    db.commit()
    return {'id': exp.id, 'status': exp.status}


@router.delete('/api/v1/experiments/{exp_id}')
def delete_experiment(exp_id: int, db: Session = Depends(get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user)
    exp = db.query(models.Experiment).filter(
        models.Experiment.id == exp_id,
        models.Experiment.project_id.in_(ids),
    ).first() if ids else None
    if not exp:
        raise HTTPException(status_code=404, detail='Experiment not found')
    db.delete(exp)
    db.commit()
    return {'ok': True}


@router.post('/api/v1/experiments/{exp_id}/simulate')
def simulate_experiment_traffic(exp_id: int, db: Session = Depends(get_db),
                                current_user: models.User = Depends(auth.get_current_user)):
    ids = _project_ids(db, current_user)
    exp = db.query(models.Experiment).filter(
        models.Experiment.id == exp_id,
        models.Experiment.project_id.in_(ids),
    ).first() if ids else None
    if not exp:
        raise HTTPException(status_code=404, detail='Experiment not found')
    project = db.query(models.Project).filter(models.Project.id == exp.project_id).first()
    domain = (project.domain or 'example.com').replace('https://', '').replace('http://', '').strip('/')
    goal_path = exp.goal_target if exp.goal_target.startswith('/') else f'/{exp.goal_target}'

    # Control A: 20 sessions, 4 conversions (20%)
    # Variant B: 20 sessions, 7 conversions (35% -> +75% lift)
    for i in range(20):
        sid_a = f'exp_{exp.id}_a_{i}_{uuid.uuid4().hex[:4]}'
        db.add(models.Event(
            project_id=project.id,
            event_type='experiment_exposure',
            url=f'https://{domain}/pricing',
            session_id=sid_a,
            properties={'experiment_key': exp.key, 'variant': 'A'},
        ))
        if i < 4:
            db.add(models.Event(
                project_id=project.id,
                event_type='pageview',
                url=f'https://{domain}{goal_path}',
                session_id=sid_a,
                properties={},
            ))

        sid_b = f'exp_{exp.id}_b_{i}_{uuid.uuid4().hex[:4]}'
        db.add(models.Event(
            project_id=project.id,
            event_type='experiment_exposure',
            url=f'https://{domain}/pricing',
            session_id=sid_b,
            properties={'experiment_key': exp.key, 'variant': 'B'},
        ))
        if i < 7:
            db.add(models.Event(
                project_id=project.id,
                event_type='pageview',
                url=f'https://{domain}{goal_path}',
                session_id=sid_b,
                properties={},
            ))
    db.commit()
    return {'simulated_sessions': 40}
