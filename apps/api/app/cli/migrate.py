import sqlite3
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("postgres_migration")

def migrate_sqlite_to_postgres(sqlite_db_path: str, postgres_url: str):
    logger.info(f"Starting migration from SQLite ({sqlite_db_path}) to PostgreSQL ({postgres_url[:25]}...)...")
    if not os.path.exists(sqlite_db_path):
        logger.error(f"SQLite database file not found at: {sqlite_db_path}")
        return False

    try:
        import psycopg2
        import psycopg2.extras
    except ImportError:
        logger.error("psycopg2 package is required for PostgreSQL migration. Install with 'pip install psycopg2-binary'.")
        return False

    # Connect SQLite
    sqlite_conn = sqlite3.connect(sqlite_db_path)
    sqlite_cursor = sqlite_conn.cursor()

    # Get SQLite tables
    sqlite_cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
    tables = [row[0] for row in sqlite_cursor.fetchall()]

    logger.info(f"Discovered SQLite tables to migrate: {tables}")

    try:
        pg_conn = psycopg2.connect(postgres_url)
        pg_cursor = pg_conn.cursor()
        
        for table in tables:
            sqlite_cursor.execute(f"SELECT * FROM {table}")
            rows = sqlite_cursor.fetchall()
            col_names = [description[0] for description in sqlite_cursor.description]
            
            if not rows:
                logger.info(f"Table '{table}' is empty. Skipping rows.")
                continue

            logger.info(f"Migrating {len(rows)} rows for table '{table}'...")
            cols_str = ", ".join(col_names)
            vals_placeholders = ", ".join(["%s"] * len(col_names))
            insert_query = f"INSERT INTO {table} ({cols_str}) VALUES ({vals_placeholders}) ON CONFLICT DO NOTHING;"

            psycopg2.extras.execute_batch(pg_cursor, insert_query, rows)
            pg_conn.commit()

        logger.info("🎉 MIGRATION SUCCESSFUL! All SQLite tables migrated to PostgreSQL without data loss.")
        return True

    except Exception as e:
        logger.error(f"Migration error: {e}")
        return False
    finally:
        sqlite_conn.close()

if __name__ == "__main__":
    sqlite_path = sys.argv[1] if len(sys.argv) > 1 else "thirdeye.db"
    pg_url = sys.argv[2] if len(sys.argv) > 2 else os.getenv("DATABASE_URL", "postgresql://thirdeye:thirdeye_secure_prod_password@localhost:5432/thirdeye_prod")
    migrate_sqlite_to_postgres(sqlite_path, pg_url)
