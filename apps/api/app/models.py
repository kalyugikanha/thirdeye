from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, JSON, Index, Text, Float, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class Plan(Base):
    __tablename__ = 'plans'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    monthly_price = Column(Integer, default=0)
    session_limit = Column(Integer, default=5000)
    retention_days = Column(Integer, default=30)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    features = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

class User(Base):
    __tablename__ = 'users'
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    name = Column(String)
    role = Column(String, default='ADMIN')
    organization_id = Column(Integer, ForeignKey('organizations.id'), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship('Organization', back_populates='users')

class Organization(Base):
    __tablename__ = 'organizations'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    plan = Column(String, default='Pro')
    monthly_event_limit = Column(Integer, default=100000)
    storage_quota_mb = Column(Integer, default=5120)
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship('User', back_populates='organization')
    projects = relationship('Project', back_populates='organization')

class Project(Base):
    __tablename__ = 'projects'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    domain = Column(String)
    api_key = Column(String, unique=True, index=True)
    dns_verified = Column(Boolean, default=False)
    dns_token = Column(String, nullable=True)
    app_type = Column(String, default='web')           # 'web', 'internal_portal', 'mobile_app', 'backend_api'
    platform = Column(String, default='browser')       # 'browser', 'react_native', 'flutter', 'android', 'ios', 'nodejs', 'python'
    mask_all_inputs = Column(Boolean, default=False)
    organization_id = Column(Integer, ForeignKey('organizations.id'))
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship('Organization', back_populates='projects')
    connectors = relationship('Connector', back_populates='project')
    events = relationship('Event', back_populates='project')
    recordings = relationship('SessionRecording', back_populates='project')
    apm_traces = relationship('APMTrace', back_populates='project')
    storage_config = relationship('StorageConfig', back_populates='project', uselist=False)

class Connector(Base):
    __tablename__ = 'connectors'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    provider = Column(String)
    access_token = Column(String)
    status = Column(String, default='active')

    project = relationship('Project', back_populates='connectors')

class Event(Base):
    __tablename__ = 'events'
    __table_args__ = (
        Index('idx_events_project_id', 'project_id'),
        Index('idx_events_created_at', 'created_at'),
        Index('idx_events_proj_created', 'project_id', 'created_at'),
        Index('idx_events_proj_type', 'project_id', 'event_type'),
    )
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    event_type = Column(String, index=True) # e.g., 'pageview', 'click', 'screen_view', 'app_crash'
    url = Column(String)
    referrer = Column(String, nullable=True)
    session_id = Column(String, index=True)
    user_id = Column(String, index=True, nullable=True)
    user_email = Column(String, index=True, nullable=True)
    user_name = Column(String, nullable=True)
    user_role = Column(String, nullable=True)
    app_version = Column(String, nullable=True)
    properties = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    project = relationship('Project', back_populates='events')

class SessionRecording(Base):
    __tablename__ = 'session_recordings'
    __table_args__ = (
        Index('idx_recordings_proj_created', 'project_id', 'created_at'),
    )
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True, nullable=True)
    duration = Column(Integer, default=0)
    file_path = Column(String, nullable=False)
    user_id = Column(String, index=True, nullable=True)
    user_email = Column(String, index=True, nullable=True)
    user_name = Column(String, nullable=True)
    user_role = Column(String, nullable=True)
    app_version = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    project = relationship('Project', back_populates='recordings')


class UptimeMonitor(Base):
    __tablename__ = 'uptime_monitors'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    name = Column(String)
    url = Column(String)
    status = Column(String, default='pending') # up, down, degraded, pending
    http_method = Column(String, default='GET')
    headers = Column(JSON, default=dict)
    request_body = Column(Text, nullable=True)
    assertions = Column(JSON, default=list)
    failure_threshold = Column(Integer, default=2) # consecutive failures before hard alert
    consecutive_failures = Column(Integer, default=0)
    is_degraded = Column(Boolean, default=False)
    last_status = Column(String, nullable=True)
    last_checked = Column(DateTime, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship('Project')

class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), index=True)
    title = Column(String)
    message = Column(String)
    type = Column(String, default='info')
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AlertChannel(Base):
    __tablename__ = 'alert_channels'
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), index=True)
    name = Column(String)
    type = Column(String, default='webhook')
    config = Column(JSON, nullable=True)
    events = Column(JSON, default=list)
    severity = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class AlertEventLog(Base):
    __tablename__ = 'alert_event_logs'
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'), index=True)
    channel_id = Column(Integer, nullable=True)
    channel_name = Column(String, nullable=True)
    channel_type = Column(String, default='webhook')
    title = Column(String)
    alert_type = Column(String, default='error')
    status = Column(String, default='delivered')  # delivered, failed, throttled
    response_code = Column(Integer, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class OrganizationInvite(Base):
    __tablename__ = 'organization_invites'
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'))
    email = Column(String, index=True)
    role = Column(String, default='MEMBER')
    token = Column(String, unique=True, index=True)
    is_accepted = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Funnel(Base):
    __tablename__ = 'funnels'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    name = Column(String)
    steps_json = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project')


class SyntheticMonitor(Base):
    __tablename__ = 'synthetic_monitors'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    name = Column(String)
    steps_json = Column(JSON)
    status = Column(String, default='pending')
    last_run = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project')


class APMTrace(Base):
    __tablename__ = 'apm_traces'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    service_name = Column(String, default='web-backend')
    trace_type = Column(String, default='http')        # 'http', 'db_query', 'external_api', 'worker_job'
    endpoint = Column(String, index=True)
    method = Column(String, default='GET')
    status_code = Column(Integer, default=200)
    duration_ms = Column(Integer, default=0)
    error_detail = Column(String, nullable=True)
    user_id = Column(String, nullable=True)
    app_version = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project', back_populates='apm_traces')


class StorageConfig(Base):
    __tablename__ = 'storage_configs'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), unique=True, index=True)
    provider = Column(String, default='thirdeye_cloud')  # 'thirdeye_cloud', 's3', 'r2', 'custom_webhook'
    bucket_name = Column(String, nullable=True)
    endpoint_url = Column(String, nullable=True)
    access_key = Column(String, nullable=True)
    secret_key = Column(String, nullable=True)
    region = Column(String, default='us-east-1')
    webhook_url = Column(String, nullable=True)
    custom_folder_path = Column(String, nullable=True)
    retention_days = Column(Integer, default=30)  # 30, 60, 90, 0=unlimited
    last_vacuum_at = Column(DateTime, nullable=True)
    bytes_reclaimed = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project', back_populates='storage_config')


class AnalyticsDailyRollup(Base):
    __tablename__ = 'analytics_daily_rollups'
    __table_args__ = (
        Index('idx_rollups_proj_date', 'project_id', 'date'),
        UniqueConstraint('project_id', 'date', 'event_type', name='uq_rollup_proj_date_type'),
    )
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    date = Column(String, index=True)  # YYYY-MM-DD
    event_type = Column(String, index=True)
    event_count = Column(Integer, default=0)
    unique_sessions = Column(Integer, default=0)
    mobile_count = Column(Integer, default=0)
    desktop_count = Column(Integer, default=0)
    tablet_count = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project')


class LiveVisitor(Base):
    __tablename__ = 'live_visitors'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    session_id = Column(String, index=True)
    current_url = Column(String)
    referrer = Column(String, nullable=True)
    browser = Column(String, default='Chrome')
    os = Column(String, default='Windows')
    device = Column(String, default='Desktop')
    country = Column(String, default='Global')
    city = Column(String, nullable=True)
    ip_hash = Column(String, nullable=True)
    last_ping = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project')


class Goal(Base):
    __tablename__ = 'goals'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    name = Column(String)
    type = Column(String, default='url')  # 'url', 'click', 'custom'
    target = Column(String)               # '/checkout', '#signup-btn', 'purchase'
    revenue_usd = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship('Project')


class Feedback(Base):
    __tablename__ = 'feedbacks'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    session_id = Column(String, index=True, nullable=True)
    rating = Column(Integer, default=5)   # 1 to 5
    sentiment = Column(String, default='positive')  # 'positive', 'neutral', 'negative'
    comment = Column(String, nullable=True)
    url = Column(String)
    browser = Column(String, default='Chrome')
    trigger = Column(String, default='widget')  # 'widget', 'rage_click', 'simulated'
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship('Project')


class FeedbackConfig(Base):
    __tablename__ = 'feedback_configs'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), unique=True, index=True)
    enabled = Column(Boolean, default=False)
    prompt = Column(String, default='How is your experience?')
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship('Project')


class IncidentLog(Base):
    __tablename__ = 'incident_logs'
    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey('alert_channels.id'), nullable=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    incident_key = Column(String, index=True, nullable=True)  # cooldown dedupe key
    incident_type = Column(String)        # 'uptime_downtime', 'error_spike'
    title = Column(String)
    message = Column(String)
    status = Column(String, default='delivered')  # 'delivered', 'failed', 'suppressed'
    response_code = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Experiment(Base):
    __tablename__ = 'experiments'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    key = Column(String, index=True)          # e.g., 'pricing_hero_cta'
    name = Column(String)
    status = Column(String, default='running')  # 'running', 'paused'
    target_url = Column(String, default='*')
    selector = Column(String, nullable=True)   # optional CSS selector for DOM text test
    control_text = Column(String, nullable=True)
    variant_text = Column(String, nullable=True)
    goal_target = Column(String, default='/thank-you')  # URL or event that counts as conversion
    traffic_split = Column(Integer, default=50)  # % routed to Variant B
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship('Project')


class WebVital(Base):
    __tablename__ = 'web_vitals'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    session_id = Column(String, index=True)
    url = Column(String, index=True)
    device = Column(String, default='Desktop')
    lcp_ms = Column(Integer, nullable=True)
    fid_ms = Column(Integer, nullable=True)
    inp_ms = Column(Integer, nullable=True)
    cls_score = Column(String, nullable=True)  # stored as float string e.g. "0.04"
    ttfb_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship('Project')


class Release(Base):
    __tablename__ = 'releases'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    version = Column(String, index=True)          # e.g., 'v2.4.0'
    commit_sha = Column(String, nullable=True)    # e.g., '3d2e6b4'
    environment = Column(String, default='production')
    notes = Column(String, nullable=True)
    deployed_by = Column(String, default='CI/CD')
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class NetworkRequest(Base):
    __tablename__ = 'network_requests'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    session_id = Column(String, index=True)
    page_url = Column(String)
    endpoint_url = Column(String, index=True)
    method = Column(String, default='GET')
    status_code = Column(Integer, index=True)
    duration_ms = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class InternalAuditLog(Base):
    __tablename__ = 'internal_audit_logs'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    session_id = Column(String, index=True, nullable=True)
    user_id = Column(String, index=True, nullable=True)
    user_email = Column(String, index=True, nullable=True)
    user_name = Column(String, nullable=True)
    user_role = Column(String, nullable=True)
    department = Column(String, nullable=True)
    action = Column(String, index=True)               # e.g., 'export_csv', 'delete_record', 'role_change'
    target_resource = Column(String, nullable=True)   # e.g., 'customers_table (12,500 rows)'
    risk_level = Column(String, default='low')        # 'low', 'medium', 'high', 'critical'
    ip_address = Column(String, nullable=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class AppCrashLog(Base):
    __tablename__ = 'app_crash_logs'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    session_id = Column(String, index=True, nullable=True)
    user_id = Column(String, index=True, nullable=True)
    user_email = Column(String, index=True, nullable=True)
    platform = Column(String, default='react_native') # 'react_native', 'flutter', 'android', 'ios', 'web'
    app_version = Column(String, default='1.0.0')
    os_version = Column(String, nullable=True)
    device_model = Column(String, nullable=True)
    error_type = Column(String, default='crash')      # 'crash', 'anr', 'unhandled_exception'
    message = Column(String)
    stack_trace = Column(Text, nullable=True)
    screen_name = Column(String, nullable=True)
    memory_free_mb = Column(Integer, nullable=True)
    battery_pct = Column(Integer, nullable=True)
    network_type = Column(String, default='wifi')     # 'wifi', '5g', '4g', 'offline'
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class SecureEyeFinding(Base):
    __tablename__ = 'secureeye_findings'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    title = Column(String, index=True)
    category = Column(String, default='web', index=True)  # 'web', 'api', 'server', 'network', 'cloud', 'auth', 'internal_portal', 'mobile', 'qa'
    asset = Column(String)
    severity = Column(String, default='Medium', index=True)  # 'Critical', 'High', 'Medium', 'Low', 'Info'
    cvss_score = Column(Float, default=5.0)
    confidence = Column(String, default='High')
    cia_impact = Column(String, default='Confidentiality')  # 'Confidentiality', 'Integrity', 'Availability', 'All (CIA)'
    evidence = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    root_cause = Column(String, nullable=True)
    impact = Column(Text, nullable=True)
    fix_steps = Column(Text, nullable=True)
    references_json = Column(JSON, default=list)  # ['CWE-200', 'OWASP A05:2021', 'MITRE T1190']
    status = Column(String, default='open', index=True)  # 'open', 'accepted', 'fixed', 'retest'
    owner = Column(String, default='Security Team')
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class SecureEyeScanLog(Base):
    __tablename__ = 'secureeye_scan_logs'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    user_email = Column(String, nullable=True)
    scan_mode = Column(String, default='passive')  # 'passive', 'safe_active', 'deep_authorized'
    target = Column(String)
    ownership_verified = Column(Boolean, default=True)
    summary_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class SecureEyeAgentReport(Base):
    __tablename__ = 'secureeye_agent_reports'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    hostname = Column(String, default='droplet-node-01')
    os_info = Column(String, default='Ubuntu 24.04 LTS')
    listening_sockets_json = Column(JSON, default=list)  # [{'proto':'tcp','bind':'0.0.0.0','port':8000,'process':'uvicorn','risk':'high'}]
    firewall_active = Column(Boolean, default=False)
    ssh_root_login = Column(String, default='unknown')
    env_permissions_ok = Column(Boolean, default=True)
    fim_status_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class SecureEyeQATestCase(Base):
    __tablename__ = 'secureeye_qa_test_cases'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    suite = Column(String, default='launch_checklist', index=True)  # 'launch_checklist', 'smoke', 'regression', 'boundary', 'negative', 'uat'
    area = Column(String, default='Functional')
    title = Column(String)
    test_type = Column(String, default='automated')  # 'automated', 'manual', 'hybrid'
    perspective = Column(String, default='black_box')
    steps = Column(Text, nullable=True)
    expected_result = Column(Text, nullable=True)
    status = Column(String, default='pending')  # 'passed', 'failed', 'flaky', 'pending'
    last_run_ms = Column(Integer, default=0)
    evidence = Column(Text, nullable=True)
    owner = Column(String, default='QA Team')
    updated_at = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class SecureEyeLoadTestRun(Base):
    __tablename__ = 'secureeye_load_test_runs'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    test_kind = Column(String, default='load')  # 'load', 'spike', 'fuzz', 'monkey'
    target_url = Column(String)
    total_requests = Column(Integer, default=10)
    success_count = Column(Integer, default=10)
    error_5xx_count = Column(Integer, default=0)
    p50_ms = Column(Integer, default=0)
    p95_ms = Column(Integer, default=0)
    p99_ms = Column(Integer, default=0)
    rps = Column(Float, default=0.0)
    details_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    project = relationship('Project')


class DigestSubscription(Base):
    __tablename__ = 'digest_subscriptions'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True)
    recipients = Column(String, default='akash@colladome.com,shubham@colladome.com')
    is_active = Column(Boolean, default=True)
    delivery_day = Column(String, default='Monday')
    delivery_time_ist = Column(String, default='09:00 AM')
    last_sent_at = Column(DateTime, nullable=True)
    last_status = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project')
