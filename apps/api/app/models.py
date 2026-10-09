from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

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
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship('User', back_populates='organization')
    projects = relationship('Project', back_populates='organization')

class Project(Base):
    __tablename__ = 'projects'
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    domain = Column(String)
    api_key = Column(String, unique=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'))
    created_at = Column(DateTime, default=datetime.utcnow)

    organization = relationship('Organization', back_populates='projects')
    connectors = relationship('Connector', back_populates='project')
    events = relationship('Event', back_populates='project')
    recordings = relationship('SessionRecording', back_populates='project')

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
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    event_type = Column(String, index=True) # e.g., 'pageview', 'click'
    url = Column(String)
    referrer = Column(String, nullable=True)
    session_id = Column(String, index=True)
    properties = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project', back_populates='events')

class SessionRecording(Base):
    __tablename__ = 'session_recordings'
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, index=True, nullable=False)
    project_id = Column(Integer, ForeignKey('projects.id'), index=True, nullable=True)
    duration = Column(Integer, default=0)
    file_path = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    project = relationship('Project', back_populates='recordings')


class UptimeMonitor(Base):
    __tablename__ = 'uptime_monitors'
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey('projects.id'))
    name = Column(String)
    url = Column(String)
    status = Column(String, default='pending')
    last_checked = Column(DateTime, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    project = relationship('Project')

class Notification(Base):
    __tablename__ = 'notifications'
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'))
    title = Column(String)
    message = Column(String)
    type = Column(String, default='info')
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AlertChannel(Base):
    __tablename__ = 'alert_channels'
    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(Integer, ForeignKey('organizations.id'))
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
