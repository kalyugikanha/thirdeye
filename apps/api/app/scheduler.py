import asyncio
import time
import urllib.request as ur
from datetime import datetime
import logging

logger = logging.getLogger('scheduler')
_scheduler_task = None

async def ping_monitor(monitor_id: int):
    from app.database import SessionLocal
    from app import models, alerts
    db = SessionLocal()
    try:
        monitor = db.query(models.UptimeMonitor).filter(models.UptimeMonitor.id == monitor_id).first()
        if not monitor:
            return

        start = time.time()
        prev_status = monitor.status
        try:
            req = ur.Request(monitor.url, headers={'User-Agent': 'ThirdEye-Uptime-Bot/2.0'})
            with ur.urlopen(req, timeout=10) as resp:
                resp.read()
            elapsed = int((time.time() - start) * 1000)
            monitor.status = 'up'
            monitor.response_time_ms = elapsed
            monitor.error_message = None
        except Exception as e:
            elapsed = int((time.time() - start) * 1000)
            monitor.status = 'down'
            monitor.response_time_ms = elapsed
            monitor.error_message = str(e)

            # Trigger multi-channel alert on transition to DOWN or initial failure
            if prev_status != 'down':
                project = db.query(models.Project).filter(models.Project.id == monitor.project_id).first()
                if project:
                    alerts.dispatch_alert(
                        db=db,
                        organization_id=project.organization_id,
                        title=f'🚨 Monitor DOWN: {monitor.name}',
                        message=f'Target URL {monitor.url} is unreachable. Error: {str(e)}',
                        alert_type='error'
                    )

        monitor.last_checked = datetime.utcnow()
        db.commit()
    except Exception as ex:
        logger.error(f'Error checking monitor {monitor_id}: {ex}')
    finally:
        db.close()

async def background_uptime_loop():
    logger.info('Starting 24/7 background uptime scheduler loop...')
    while True:
        try:
            from app.database import SessionLocal
            from app import models
            db = SessionLocal()
            monitors = db.query(models.UptimeMonitor).all()
            db.close()

            tasks = [ping_monitor(m.id) for m in monitors]
            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as e:
            logger.error(f'Scheduler loop error: {e}')
        await asyncio.sleep(30)  # Check every 30 seconds automatically

def start_scheduler():
    global _scheduler_task
    _scheduler_task = asyncio.create_task(background_uptime_loop())
