"""
database.py  -  SQLite setup for CyberShield.

Python's built-in `sqlite3` module is used (no extra install needed).
The database file lives at instance/cybershield.db and is created
automatically the first time the app starts.
"""
import sqlite3
import os
from pathlib import Path

import content

BASE_DIR = Path(__file__).resolve().parent
if os.getenv("VERCEL"):
    INSTANCE_DIR = Path("/tmp")
else:
    INSTANCE_DIR = BASE_DIR / "instance"
DB_PATH = INSTANCE_DIR / "cybershield.db"

# ---------------------------------------------------------------------------
# Schema. Every table is created only if it does not exist yet.
# ---------------------------------------------------------------------------
SCHEMA = """
-- One local learning profile (id is always 1). No passwords are stored.
CREATE TABLE IF NOT EXISTS profile (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    nickname    TEXT,
    xp          INTEGER NOT NULL DEFAULT 0,
    streak      INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    last_active TEXT,                -- YYYY-MM-DD
    last_module TEXT,                -- slug of the last opened module
    settings    TEXT NOT NULL DEFAULT '{}',   -- JSON text
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Catalogue of Academy modules (seeded from content.py).
CREATE TABLE IF NOT EXISTS modules (
    slug       TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    category   TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    minutes    INTEGER NOT NULL,
    xp         INTEGER NOT NULL,
    position   INTEGER NOT NULL
);

-- Which modules the learner opened / completed.
CREATE TABLE IF NOT EXISTS module_progress (
    slug         TEXT PRIMARY KEY REFERENCES modules(slug),
    status       TEXT NOT NULL DEFAULT 'in_progress'
                 CHECK (status IN ('in_progress', 'completed')),
    quiz_correct INTEGER,
    quiz_total   INTEGER,
    opened_at    TEXT,
    completed_at TEXT
);

-- Catalogue of HackLab labs (seeded from content.py).
CREATE TABLE IF NOT EXISTS labs (
    lab_id     TEXT PRIMARY KEY,
    codename   TEXT NOT NULL,
    title      TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    xp         INTEGER NOT NULL,
    position   INTEGER NOT NULL
);

-- A lab can only be completed (and rewarded) once.
CREATE TABLE IF NOT EXISTS lab_completion (
    lab_id       TEXT PRIMARY KEY REFERENCES labs(lab_id),
    score        INTEGER,
    xp_awarded   INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL
);

-- Every quiz / challenge attempt (module quizzes use key "module:<slug>").
CREATE TABLE IF NOT EXISTS quiz_results (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    quiz_key   TEXT NOT NULL,
    difficulty TEXT,
    correct    INTEGER NOT NULL,
    total      INTEGER NOT NULL,
    xp_awarded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

-- Unlocked badges.
CREATE TABLE IF NOT EXISTS achievements (
    code        TEXT PRIMARY KEY,
    unlocked_at TEXT NOT NULL
);

-- One row per calendar day, so a mission can only be claimed once per day.
CREATE TABLE IF NOT EXISTS daily_missions (
    mission_date TEXT PRIMARY KEY,   -- YYYY-MM-DD
    mission_code TEXT NOT NULL,
    completed    INTEGER NOT NULL DEFAULT 0,
    xp_awarded   INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT
);

-- Timeline shown on the dashboard and the progress page.
CREATE TABLE IF NOT EXISTS activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    kind       TEXT NOT NULL,        -- module | lab | quiz | mission | achievement
    ref        TEXT,                 -- slug / lab id / quiz key
    title      TEXT NOT NULL,
    xp         INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity(created_at);
CREATE INDEX IF NOT EXISTS idx_quiz_created ON quiz_results(created_at);
"""

# Tables that hold learner progress (wiped by "Reset progress").
PROGRESS_TABLES = [
    "module_progress", "lab_completion", "quiz_results",
    "achievements", "daily_missions", "activity",
]


def get_connection():
    """Open a new connection. Rows behave like dictionaries."""
    INSTANCE_DIR.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def sync_catalog(conn):
    """Copy the module and lab lists from content.py into the database."""
    for pos, m in enumerate(content.MODULES, start=1):
        conn.execute(
            "INSERT INTO modules (slug, title, category, difficulty, minutes, xp, position) "
            "VALUES (?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(slug) DO UPDATE SET title=excluded.title, category=excluded.category, "
            "difficulty=excluded.difficulty, minutes=excluded.minutes, xp=excluded.xp, "
            "position=excluded.position",
            (m["slug"], m["title"], m["category"], m["difficulty"], m["minutes"], m["xp"], pos),
        )
    for pos, lab in enumerate(content.LABS, start=1):
        conn.execute(
            "INSERT INTO labs (lab_id, codename, title, difficulty, xp, position) "
            "VALUES (?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(lab_id) DO UPDATE SET codename=excluded.codename, title=excluded.title, "
            "difficulty=excluded.difficulty, xp=excluded.xp, position=excluded.position",
            (lab["id"], lab["codename"], lab["title"], lab["difficulty"], lab["xp"], pos),
        )


def init_db():
    """Create tables, seed the catalogue and make sure the profile row exists."""
    conn = get_connection()
    try:
        conn.executescript(SCHEMA)
        conn.execute("INSERT OR IGNORE INTO profile (id) VALUES (1)")
        sync_catalog(conn)
        conn.commit()
    finally:
        conn.close()


def reset_progress(conn):
    """Erase all progress but keep the nickname and interface settings."""
    for table in PROGRESS_TABLES:
        conn.execute(f"DELETE FROM {table}")  # table names come from the list above
    conn.execute(
        "UPDATE profile SET xp = 0, streak = 0, best_streak = 0, "
        "last_active = NULL, last_module = NULL WHERE id = 1"
    )
    conn.commit()


if __name__ == "__main__":
    init_db()
    print(f"Database ready at {DB_PATH}")
