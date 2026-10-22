from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, JSON, Index, Text
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
    event_type = Column(String, index=True) # e.g., 'pageview', 'click'
    url = Column(String)
    referrer = Column(String, nullable=True)
    session_id = Column(String, index=True)
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
    is_active = Column(Boolean, default=True)
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
    endpoint = Column(String, index=True)
    method = Column(String, default='GET')
    status_code = Column(Integer, default=200)
    duration_ms = Column(Integer, default=0)
    error_detail = Column(String, nullable=True)
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
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project', back_populates='storage_config')


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
