"""
Phase 2: Internal Portals, Employee Audit Trail & Mobile/Full-Stack Application Tracking
"""
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List
import secrets
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text, func

from app import models, auth, alerts
from app.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


def migrate_phase2_schema(engine):
    """Idempotent additive schema migration for Phase 2 tables and columns."""
    alter_statements = [
        "ALTER TABLE projects ADD COLUMN app_type VARCHAR DEFAULT 'web'",
        "ALTER TABLE projects ADD COLUMN platform VARCHAR DEFAULT 'browser'",
        "ALTER TABLE projects ADD COLUMN mask_all_inputs BOOLEAN DEFAULT 0",
        "ALTER TABLE events ADD COLUMN user_id VARCHAR",
        "ALTER TABLE events ADD COLUMN user_email VARCHAR",
        "ALTER TABLE events ADD COLUMN user_name VARCHAR",
        "ALTER TABLE events ADD COLUMN user_role VARCHAR",
        "ALTER TABLE events ADD COLUMN app_version VARCHAR",
        "ALTER TABLE session_recordings ADD COLUMN user_id VARCHAR",
        "ALTER TABLE session_recordings ADD COLUMN user_email VARCHAR",
        "ALTER TABLE session_recordings ADD COLUMN user_name VARCHAR",
        "ALTER TABLE session_recordings ADD COLUMN user_role VARCHAR",
        "ALTER TABLE session_recordings ADD COLUMN app_version VARCHAR",
        "ALTER TABLE apm_traces ADD COLUMN trace_type VARCHAR DEFAULT 'http'",
        "ALTER TABLE apm_traces ADD COLUMN user_id VARCHAR",
        "ALTER TABLE apm_traces ADD COLUMN app_version VARCHAR",
    ]
    create_tables = [
        """
        CREATE TABLE IF NOT EXISTS internal_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            session_id VARCHAR,
            user_id VARCHAR,
            user_email VARCHAR,
            user_name VARCHAR,
            user_role VARCHAR,
            department VARCHAR,
            action VARCHAR,
            target_resource VARCHAR,
            risk_level VARCHAR DEFAULT 'low',
            ip_address VARCHAR,
            metadata_json JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS app_crash_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER,
            session_id VARCHAR,
            user_id VARCHAR,
            user_email VARCHAR,
            platform VARCHAR DEFAULT 'react_native',
            app_version VARCHAR DEFAULT '1.0.0',
            os_version VARCHAR,
            device_model VARCHAR,
            error_type VARCHAR DEFAULT 'crash',
            message VARCHAR,
            stack_trace TEXT,
            screen_name VARCHAR,
            memory_free_mb INTEGER,
            battery_pct INTEGER,
            network_type VARCHAR DEFAULT 'wifi',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    ]
    with engine.connect() as conn:
        for stmt in alter_statements:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass
        for tbl in create_tables:
            try:
                conn.execute(text(tbl))
                conn.commit()
            except Exception:
                pass


def _resolve_active_project(db: Session, user: models.User, project_id: Optional[int] = None) -> Optional[models.Project]:
    q = db.query(models.Project).filter(models.Project.organization_id == user.organization_id)
    if project_id:
        p = q.filter(models.Project.id == project_id).first()
        if p:
            return p
    return q.order_by(models.Project.id.asc()).first()


# ===================== 1. INTERNAL PORTAL AUDIT LOGGING =====================

class InternalAuditPayload(BaseModel):
    api_key: str
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    user_role: Optional[str] = None
    department: Optional[str] = None
    action: str
    target_resource: Optional[str] = None
    risk_level: str = 'low'  # low, medium, high, critical
    metadata: Optional[Dict[str, Any]] = None


@router.post('/api/v1/internal/audit')
def ingest_internal_audit(data: InternalAuditPayload, request: Request, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.api_key == data.api_key).first()
    if not project:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    risk = (data.risk_level or 'low').lower()
    if risk not in ('low', 'medium', 'high', 'critical'):
        risk = 'low'

    client_ip = request.client.host if request.client else None
    entry = models.InternalAuditLog(
        project_id=project.id,
        session_id=data.session_id,
        user_id=data.user_id,
        user_email=data.user_email,
        user_name=data.user_name,
        user_role=data.user_role,
        department=data.department,
        action=data.action,
        target_resource=data.target_resource,
        risk_level=risk,
        ip_address=client_ip,
        metadata_json=data.metadata or {}
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)

    # Trigger Omnichannel Alert on High / Critical internal audit actions
    if risk in ('high', 'critical') and project.organization_id:
        actor = data.user_email or data.user_id or 'Unknown Employee'
        role_tag = f" ({data.user_role})" if data.user_role else ""
        alerts.dispatch_alert(
            db=db,
            organization_id=project.organization_id,
            title=f"🛡️ Internal Audit [{risk.upper()}]: {data.action}",
            message=(
                f"Actor {actor}{role_tag} executed sensitive action '{data.action}' "
                f"on '{data.target_resource or project.domain}' (IP: {client_ip or 'N/A'})."
            ),
            alert_type='critical' if risk == 'critical' else 'warning',
            metadata={
                "audit_id": entry.id,
                "action": data.action,
                "actor": actor,
                "risk_level": risk,
                "target": data.target_resource
            },
            event_category='security_finding'
        )

    return {"status": "recorded", "audit_id": entry.id, "risk_level": risk}


@router.get('/api/v1/internal/overview')
def get_internal_overview(
    project_id: Optional[int] = None,
    search: Optional[str] = None,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    project = _resolve_active_project(db, current_user, project_id)
    if not project:
        return {
            "kpis": {"total_identified_users": 0, "total_audit_actions": 0, "high_risk_actions": 0, "identified_sessions": 0},
            "identified_users": [],
            "audit_logs": [],
            "portal_routes": []
        }

    since = datetime.utcnow() - timedelta(days=days)

    # 1. Aggregate Identified Users across Events, Recordings, and Audit Logs
    users_map: Dict[str, Dict[str, Any]] = {}

    ev_rows = db.query(models.Event).filter(
        models.Event.project_id == project.id,
        models.Event.created_at >= since,
        (models.Event.user_id.isnot(None)) | (models.Event.user_email.isnot(None))
    ).order_by(models.Event.created_at.desc()).limit(2000).all()

    for ev in ev_rows:
        props = ev.properties if isinstance(ev.properties, dict) else {}
        uid = ev.user_id or props.get('user_id') or ev.user_email or props.get('user_email')
        if not uid:
            continue
        u = users_map.setdefault(str(uid), {
            "user_id": ev.user_id or props.get('user_id') or str(uid),
            "user_email": ev.user_email or props.get('user_email') or '',
            "user_name": ev.user_name or props.get('user_name') or '',
            "user_role": ev.user_role or props.get('user_role') or 'Member',
            "department": props.get('department') or 'General',
            "events_count": 0,
            "sessions": set(),
            "audit_actions_count": 0,
            "last_seen": ev.created_at.isoformat() if ev.created_at else None,
            "last_url": ev.url or '',
            "latest_session_id": ev.session_id
        })
        u["events_count"] += 1
        if ev.session_id:
            u["sessions"].add(ev.session_id)
        if not u["user_email"] and (ev.user_email or props.get('user_email')):
            u["user_email"] = ev.user_email or props.get('user_email')
        if not u["user_name"] and (ev.user_name or props.get('user_name')):
            u["user_name"] = ev.user_name or props.get('user_name')

    rec_rows = db.query(models.SessionRecording).filter(
        models.SessionRecording.project_id == project.id,
        models.SessionRecording.created_at >= since,
        (models.SessionRecording.user_id.isnot(None)) | (models.SessionRecording.user_email.isnot(None))
    ).order_by(models.SessionRecording.created_at.desc()).limit(500).all()

    for r in rec_rows:
        uid = r.user_id or r.user_email
        if not uid:
            continue
        u = users_map.setdefault(str(uid), {
            "user_id": r.user_id or str(uid),
            "user_email": r.user_email or '',
            "user_name": r.user_name or '',
            "user_role": r.user_role or 'Member',
            "department": 'General',
            "events_count": 0,
            "sessions": set(),
            "audit_actions_count": 0,
            "last_seen": r.created_at.isoformat() if r.created_at else None,
            "last_url": '',
            "latest_session_id": r.session_id
        })
        if r.session_id:
            u["sessions"].add(r.session_id)
        if not u.get("latest_session_id"):
            u["latest_session_id"] = r.session_id

    audit_rows = db.query(models.InternalAuditLog).filter(
        models.InternalAuditLog.project_id == project.id,
        models.InternalAuditLog.created_at >= since
    ).order_by(models.InternalAuditLog.created_at.desc()).limit(200).all()

    for a in audit_rows:
        uid = a.user_id or a.user_email
        if uid:
            u = users_map.setdefault(str(uid), {
                "user_id": a.user_id or str(uid),
                "user_email": a.user_email or '',
                "user_name": a.user_name or '',
                "user_role": a.user_role or 'Admin',
                "department": a.department or 'Operations',
                "events_count": 0,
                "sessions": set(),
                "audit_actions_count": 0,
                "last_seen": a.created_at.isoformat() if a.created_at else None,
                "last_url": a.target_resource or '',
                "latest_session_id": a.session_id
            })
            u["audit_actions_count"] += 1
            if a.session_id:
                u["sessions"].add(a.session_id)

    identified_list = []
    total_identified_sessions = set()
    for uid, info in users_map.items():
        sess_set = info.pop("sessions", set())
        total_identified_sessions.update(sess_set)
        info["sessions_count"] = len(sess_set)
        if search:
            q_str = search.lower().strip()
            hay = f"{info['user_id']} {info['user_email']} {info['user_name']} {info['user_role']} {info['department']}".lower()
            if q_str not in hay:
                continue
        identified_list.append(info)

    identified_list.sort(key=lambda x: (x.get("last_seen") or ""), reverse=True)

    # 2. Portal route breakdown
    route_counts: Dict[str, int] = {}
    for ev in ev_rows:
        if ev.event_type in ('pageview', 'screen_view') and ev.url:
            route_counts[ev.url] = route_counts.get(ev.url, 0) + 1
    portal_routes = [{"url": k, "views": v} for k, v in sorted(route_counts.items(), key=lambda i: i[1], reverse=True)[:10]]

    high_risk_count = sum(1 for a in audit_rows if a.risk_level in ('high', 'critical'))

    return {
        "kpis": {
            "total_identified_users": len(identified_list),
            "total_audit_actions": len(audit_rows),
            "high_risk_actions": high_risk_count,
            "identified_sessions": len(total_identified_sessions)
        },
        "identified_users": identified_list,
        "audit_logs": [{
            "id": a.id,
            "session_id": a.session_id,
            "user_id": a.user_id,
            "user_email": a.user_email,
            "user_name": a.user_name,
            "user_role": a.user_role,
            "department": a.department,
            "action": a.action,
            "target_resource": a.target_resource,
            "risk_level": a.risk_level,
            "ip_address": a.ip_address,
            "metadata": a.metadata_json or {},
            "created_at": a.created_at.isoformat() if a.created_at else None
        } for a in audit_rows[:100]],
        "portal_routes": portal_routes
    }


@router.post('/api/v1/internal/simulate')
def simulate_internal_portal_activity(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    project = _resolve_active_project(db, current_user, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found")

    sample_employees = [
        {"id": "emp_101", "email": f"akash@{project.domain}", "name": "Akash (Founder)", "role": "Super_Admin", "dept": "Executive"},
        {"id": "emp_102", "email": f"shubham@{project.domain}", "name": "Shubham", "role": "Ops_Admin", "dept": "Operations"},
        {"id": "emp_103", "email": f"finance@{project.domain}", "name": "Priya Verma", "role": "Billing_Manager", "dept": "Finance"},
    ]
    sample_audits = [
        ("emp_101", "role_permission_updated", "Granted Ops_Admin access to Shubham", "medium"),
        ("emp_103", "invoice_batch_generated", "Monthly Enterprise Invoices (48 clients)", "low"),
        ("emp_102", "export_customer_csv", "Exported 14,720 customer records to CSV", "high"),
    ]

    for emp in sample_employees:
        sid = f"int_sess_{emp['id']}_{secrets.token_hex(3)}"
        for route in ["/admin/dashboard", "/admin/customers", "/admin/billing"]:
            db.add(models.Event(
                project_id=project.id,
                event_type="pageview",
                url=f"https://{project.domain}{route}",
                session_id=sid,
                user_id=emp["id"],
                user_email=emp["email"],
                user_name=emp["name"],
                user_role=emp["role"],
                properties={
                    "user_id": emp["id"],
                    "user_email": emp["email"],
                    "user_name": emp["name"],
                    "user_role": emp["role"],
                    "department": emp["dept"],
                    "portal": "Internal_Admin"
                }
            ))

    emp_by_id = {e["id"]: e for e in sample_employees}
    for emp_id, action, target, risk in sample_audits:
        emp = emp_by_id[emp_id]
        db.add(models.InternalAuditLog(
            project_id=project.id,
            session_id=f"int_sess_{emp_id}",
            user_id=emp["id"],
            user_email=emp["email"],
            user_name=emp["name"],
            user_role=emp["role"],
            department=emp["dept"],
            action=action,
            target_resource=target,
            risk_level=risk,
            ip_address="159.65.154.209",
            metadata_json={"simulated": True}
        ))

    db.commit()
    return {"status": "simulated", "employees": len(sample_employees), "audit_logs": len(sample_audits)}


# ===================== 2. MOBILE & FULL-STACK APP TELEMETRY =====================

class AppTelemetryPayload(BaseModel):
    api_key: str
    type: str = 'screen_view'  # 'screen_view', 'crash', 'anr', 'unhandled_exception', 'custom_event'
    session_id: Optional[str] = None
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    platform: str = 'react_native'  # 'react_native', 'flutter', 'android', 'ios', 'web'
    app_version: str = '1.0.0'
    os_version: Optional[str] = None
    device_model: Optional[str] = None
    screen_name: Optional[str] = None
    event_name: Optional[str] = None
    message: Optional[str] = None
    stack_trace: Optional[str] = None
    memory_free_mb: Optional[int] = None
    battery_pct: Optional[int] = None
    network_type: Optional[str] = 'wifi'
    properties: Optional[Dict[str, Any]] = None


@router.post('/api/v1/app/telemetry')
def ingest_app_telemetry(data: AppTelemetryPayload, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.api_key == data.api_key).first()
    if not project:
        raise HTTPException(status_code=401, detail="Invalid API Key")

    sid = data.session_id or f"app_{secrets.token_hex(6)}"
    t_type = (data.type or 'screen_view').lower()

    # Always record a unified Event row for session & screen analytics
    ev_type = 'screen_view' if t_type == 'screen_view' else ('app_crash' if t_type in ('crash', 'anr', 'unhandled_exception') else (data.event_name or 'app_event'))
    screen_url = f"app://{data.platform}/{data.screen_name or 'HomeScreen'}"

    ev = models.Event(
        project_id=project.id,
        event_type=ev_type,
        url=screen_url,
        session_id=sid,
        user_id=data.user_id,
        user_email=data.user_email,
        user_name=data.user_name,
        app_version=data.app_version,
        properties={
            "platform": data.platform,
            "app_version": data.app_version,
            "os_version": data.os_version,
            "device_model": data.device_model,
            "screen_name": data.screen_name,
            "network_type": data.network_type,
            **(data.properties or {})
        }
    )
    db.add(ev)

    crash_id = None
    if t_type in ('crash', 'anr', 'unhandled_exception'):
        crash_entry = models.AppCrashLog(
            project_id=project.id,
            session_id=sid,
            user_id=data.user_id,
            user_email=data.user_email,
            platform=data.platform,
            app_version=data.app_version,
            os_version=data.os_version,
            device_model=data.device_model,
            error_type=t_type,
            message=data.message or f"Application {t_type.upper()} on {data.screen_name or 'UnknownScreen'}",
            stack_trace=data.stack_trace,
            screen_name=data.screen_name,
            memory_free_mb=data.memory_free_mb,
            battery_pct=data.battery_pct,
            network_type=data.network_type or 'wifi'
        )
        db.add(crash_entry)
        db.commit()
        db.refresh(crash_entry)
        crash_id = crash_entry.id

        if project.organization_id:
            alerts.dispatch_alert(
                db=db,
                organization_id=project.organization_id,
                title=f"📱 App {t_type.upper()} ({data.platform} v{data.app_version})",
                message=(
                    f"{crash_entry.message} on screen '{data.screen_name or 'N/A'}' "
                    f"(Device: {data.device_model or data.platform}, User: {data.user_email or data.user_id or 'Anonymous'})."
                ),
                alert_type='critical' if t_type in ('crash', 'anr') else 'error',
                metadata={
                    "crash_id": crash_id,
                    "platform": data.platform,
                    "app_version": data.app_version,
                    "screen": data.screen_name
                },
                event_category='error_spike'
            )
    else:
        db.commit()

    return {"status": "ok", "event_type": ev_type, "crash_id": crash_id}


@router.get('/api/v1/app/overview')
def get_app_overview(
    project_id: Optional[int] = None,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    project = _resolve_active_project(db, current_user, project_id)
    if not project:
        return {
            "kpis": {"crash_free_rate_pct": 100.0, "total_app_events": 0, "total_crashes": 0, "anr_count": 0, "active_versions_count": 0},
            "versions": [],
            "devices": [],
            "screens": [],
            "crashes": []
        }

    since = datetime.utcnow() - timedelta(days=days)

    app_events = db.query(models.Event).filter(
        models.Event.project_id == project.id,
        models.Event.created_at >= since,
        (models.Event.event_type.in_(['screen_view', 'app_crash', 'app_event'])) | (models.Event.app_version.isnot(None))
    ).order_by(models.Event.created_at.desc()).limit(3000).all()

    crashes = db.query(models.AppCrashLog).filter(
        models.AppCrashLog.project_id == project.id,
        models.AppCrashLog.created_at >= since
    ).order_by(models.AppCrashLog.created_at.desc()).limit(100).all()

    all_sessions = set()
    crashed_sessions = set()
    version_stats: Dict[str, Dict[str, Any]] = {}
    device_counts: Dict[str, int] = {}
    screen_counts: Dict[str, int] = {}

    for ev in app_events:
        props = ev.properties if isinstance(ev.properties, dict) else {}
        ver = ev.app_version or props.get('app_version') or '1.0.0'
        plat = props.get('platform') or 'web'
        dev = props.get('device_model') or plat
        scr = props.get('screen_name') or ev.url

        if ev.session_id:
            all_sessions.add(ev.session_id)
        v_entry = version_stats.setdefault(ver, {"version": ver, "platform": plat, "sessions": set(), "crashes": 0, "events": 0})
        v_entry["events"] += 1
        if ev.session_id:
            v_entry["sessions"].add(ev.session_id)

        device_counts[f"{dev} ({plat})"] = device_counts.get(f"{dev} ({plat})", 0) + 1
        if scr:
            screen_counts[str(scr)] = screen_counts.get(str(scr), 0) + 1

    for c in crashes:
        if c.session_id:
            all_sessions.add(c.session_id)
            crashed_sessions.add(c.session_id)
        ver = c.app_version or '1.0.0'
        v_entry = version_stats.setdefault(ver, {"version": ver, "platform": c.platform, "sessions": set(), "crashes": 0, "events": 0})
        v_entry["crashes"] += 1
        if c.session_id:
            v_entry["sessions"].add(c.session_id)

    total_sess_count = len(all_sessions)
    crash_free_pct = round(((total_sess_count - len(crashed_sessions)) / total_sess_count) * 100.0, 2) if total_sess_count > 0 else 100.0
    anr_count = sum(1 for c in crashes if c.error_type == 'anr')

    versions_out = []
    for ver, st in version_stats.items():
        s_cnt = max(1, len(st["sessions"]))
        versions_out.append({
            "version": ver,
            "platform": st["platform"],
            "sessions": len(st["sessions"]),
            "events": st["events"],
            "crashes": st["crashes"],
            "crash_free_pct": round(max(0.0, ((s_cnt - st["crashes"]) / s_cnt) * 100.0), 1)
        })
    versions_out.sort(key=lambda x: x["events"], reverse=True)

    return {
        "kpis": {
            "crash_free_rate_pct": crash_free_pct,
            "total_app_events": len(app_events),
            "total_crashes": len(crashes),
            "anr_count": anr_count,
            "active_versions_count": len(versions_out)
        },
        "versions": versions_out,
        "devices": [{"device": k, "count": v} for k, v in sorted(device_counts.items(), key=lambda i: i[1], reverse=True)[:10]],
        "screens": [{"screen": k, "views": v} for k, v in sorted(screen_counts.items(), key=lambda i: i[1], reverse=True)[:10]],
        "crashes": [{
            "id": c.id,
            "session_id": c.session_id,
            "user_id": c.user_id,
            "user_email": c.user_email,
            "platform": c.platform,
            "app_version": c.app_version,
            "os_version": c.os_version,
            "device_model": c.device_model,
            "error_type": c.error_type,
            "message": c.message,
            "stack_trace": c.stack_trace,
            "screen_name": c.screen_name,
            "memory_free_mb": c.memory_free_mb,
            "battery_pct": c.battery_pct,
            "network_type": c.network_type,
            "created_at": c.created_at.isoformat() if c.created_at else None
        } for c in crashes]
    }


@router.post('/api/v1/app/simulate')
def simulate_mobile_app_telemetry(
    project_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    project = _resolve_active_project(db, current_user, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="No active project found")

    screens = ["HomeScreen", "ProductCatalogScreen", "CheckoutScreen", "ProfileSettingsScreen"]
    devices = [
        ("react_native", "2.4.0", "iOS 17.4", "iPhone 15 Pro", "wifi"),
        ("react_native", "2.4.0", "Android 14", "Samsung Galaxy S24", "5g"),
        ("flutter", "2.3.1", "Android 13", "OnePlus 11R", "4g"),
    ]

    for idx, (plat, ver, os_v, dev, net) in enumerate(devices):
        sid = f"mob_sess_{idx}_{secrets.token_hex(3)}"
        for scr in screens:
            db.add(models.Event(
                project_id=project.id,
                event_type="screen_view",
                url=f"app://{plat}/{scr}",
                session_id=sid,
                user_id=f"usr_{100+idx}",
                user_email=f"mobile_user{idx+1}@{project.domain}",
                app_version=ver,
                properties={
                    "platform": plat,
                    "app_version": ver,
                    "os_version": os_v,
                    "device_model": dev,
                    "screen_name": scr,
                    "network_type": net
                }
            ))

    # Add 1 crash and 1 ANR
    db.add(models.AppCrashLog(
        project_id=project.id,
        session_id=f"mob_crash_{secrets.token_hex(3)}",
        user_id="usr_101",
        user_email=f"mobile_user1@{project.domain}",
        platform="react_native",
        app_version="2.4.0",
        os_version="Android 14",
        device_model="Samsung Galaxy S24",
        error_type="crash",
        message="TypeError: Cannot read property 'paymentIntent' of undefined",
        stack_trace="at CheckoutScreen.handlePay (CheckoutScreen.tsx:142:19)\nat Object.invokeGuardedCallbackProd (ReactNativeRenderer-prod.js:48:12)",
        screen_name="CheckoutScreen",
        memory_free_mb=312,
        battery_pct=64,
        network_type="5g"
    ))
    db.add(models.AppCrashLog(
        project_id=project.id,
        session_id=f"mob_anr_{secrets.token_hex(3)}",
        user_id="usr_102",
        user_email=f"mobile_user2@{project.domain}",
        platform="flutter",
        app_version="2.3.1",
        os_version="Android 13",
        device_model="OnePlus 11R",
        error_type="anr",
        message="ANR: Main thread blocked for >5000ms during synchronous SQLite JSON parse",
        stack_trace="main (runnable): io.flutter.embedding.engine.FlutterJNI.nativeNotifyVsync\n  at ProductCatalogScreen.build (catalog_screen.dart:88)",
        screen_name="ProductCatalogScreen",
        memory_free_mb=128,
        battery_pct=22,
        network_type="4g"
    ))
    db.commit()
    return {"status": "simulated", "screens_logged": len(devices) * len(screens), "crashes_logged": 2}


# ===================== 3. MULTI-APPLICATION & PORTAL HUB =====================

class ApplicationCreateRequest(BaseModel):
    name: str
    domain: str
    app_type: str = 'web'        # 'web', 'internal_portal', 'mobile_app', 'backend_api'
    platform: str = 'browser'    # 'browser', 'react_native', 'flutter', 'android', 'ios', 'nodejs', 'python'
    mask_all_inputs: bool = False


class ApplicationUpdateRequest(BaseModel):
    name: Optional[str] = None
    app_type: Optional[str] = None
    platform: Optional[str] = None
    mask_all_inputs: Optional[bool] = None


@router.get('/api/v1/applications')
def list_applications(db: Session = Depends(get_db), current_user: models.User = Depends(auth.get_current_user)):
    projects = db.query(models.Project).filter(
        models.Project.organization_id == current_user.organization_id
    ).order_by(models.Project.id.asc()).all()

    out = []
    for p in projects:
        ev_cnt = db.query(func.count(models.Event.id)).filter(models.Event.project_id == p.id).scalar() or 0
        rec_cnt = db.query(func.count(models.SessionRecording.id)).filter(models.SessionRecording.project_id == p.id).scalar() or 0
        out.append({
            "id": p.id,
            "name": p.name,
            "domain": p.domain,
            "api_key": p.api_key,
            "app_type": getattr(p, 'app_type', None) or 'web',
            "platform": getattr(p, 'platform', None) or 'browser',
            "mask_all_inputs": bool(getattr(p, 'mask_all_inputs', False)),
            "dns_verified": bool(p.dns_verified),
            "event_count": ev_cnt,
            "recording_count": rec_cnt,
            "created_at": p.created_at.isoformat() if p.created_at else None
        })
    return out


@router.post('/api/v1/applications')
def create_application(
    data: ApplicationCreateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    clean_domain = data.domain.replace("https://", "").replace("http://", "").strip("/") or "app.internal"
    new_key = "te_live_" + secrets.token_hex(12)
    proj = models.Project(
        name=data.name.strip() or clean_domain,
        domain=clean_domain,
        api_key=new_key,
        app_type=data.app_type,
        platform=data.platform,
        mask_all_inputs=data.mask_all_inputs,
        dns_verified=(data.app_type in ('internal_portal', 'mobile_app', 'backend_api')),
        organization_id=current_user.organization_id
    )
    db.add(proj)
    db.commit()
    db.refresh(proj)
    return {
        "id": proj.id,
        "name": proj.name,
        "domain": proj.domain,
        "api_key": proj.api_key,
        "app_type": proj.app_type,
        "platform": proj.platform,
        "mask_all_inputs": bool(proj.mask_all_inputs)
    }


@router.put('/api/v1/applications/{project_id}')
def update_application(
    project_id: int,
    data: ApplicationUpdateRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    proj = db.query(models.Project).filter(
        models.Project.id == project_id,
        models.Project.organization_id == current_user.organization_id
    ).first()
    if not proj:
        raise HTTPException(status_code=404, detail="Application not found")
    if data.name is not None:
        proj.name = data.name
    if data.app_type is not None:
        proj.app_type = data.app_type
    if data.platform is not None:
        proj.platform = data.platform
    if data.mask_all_inputs is not None:
        proj.mask_all_inputs = data.mask_all_inputs
    db.commit()
    db.refresh(proj)
    return {
        "id": proj.id,
        "name": proj.name,
        "domain": proj.domain,
        "api_key": proj.api_key,
        "app_type": proj.app_type,
        "platform": proj.platform,
        "mask_all_inputs": bool(proj.mask_all_inputs)
    }
