"""
database.py

Handles the PostgreSQL connection and creates all tables if they
don't already exist.

Connects using the DATABASE_URL environment variable. Render injects
this automatically once a Postgres database is attached to this
service; for local development, set it yourself (see README).

Every function in this file opens its own short-lived connection and
closes it when done -- same pattern as before, just swapped from
sqlite3 to psycopg2.
"""

import os
import psycopg2
import psycopg2.extras

DATABASE_URL = os.environ.get("DATABASE_URL")


def get_connection():
    """
    Open a new connection to the Postgres database.

    cursor_factory=RealDictCursor lets us access columns by name
    (row["yes_total"]) instead of by index, same as sqlite3.Row did
    before -- so the rest of the code barely has to change.
    """
    if not DATABASE_URL:
        raise RuntimeError(
            "DATABASE_URL environment variable is not set. "
            "Set it to your Postgres connection string."
        )
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


def _add_resolution_columns_if_missing(conn):
    """
    Migration helper for market resolution.

    Checks the actual columns on the existing `contracts` table via
    information_schema and only runs ALTER TABLE for whichever
    columns are missing. Safe to call every time the app starts.
    """
    cursor = conn.cursor()
    cursor.execute(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'contracts'"
    )
    existing_columns = {row["column_name"] for row in cursor.fetchall()}

    if "resolved" not in existing_columns:
        cursor.execute(
            "ALTER TABLE contracts ADD COLUMN resolved INTEGER NOT NULL DEFAULT 0"
        )
    if "outcome" not in existing_columns:
        cursor.execute("ALTER TABLE contracts ADD COLUMN outcome TEXT")

    conn.commit()


def init_db():
    """
    Create all tables if they don't already exist.

    Safe to call every time the app starts -- CREATE TABLE IF NOT
    EXISTS is a no-op if the table is already there.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # The prediction markets. yes_total/no_total are running sums
    # of tokens wagered on each side -- updated every time a bet
    # is placed, so we never need to re-sum predictions to display
    # the current state of a market.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contracts (
            id SERIAL PRIMARY KEY,
            question TEXT NOT NULL,
            yes_total INTEGER NOT NULL DEFAULT 0,
            no_total INTEGER NOT NULL DEFAULT 0,
            resolved INTEGER NOT NULL DEFAULT 0,
            outcome TEXT CHECK (outcome IN ('YES', 'NO'))
        )
    """)

    # One row per user (identified only by the name they typed in --
    # no accounts/passwords). Tracks remaining token balance so we
    # can enforce the 1,000 token starting limit.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_name TEXT PRIMARY KEY,
            tokens_remaining INTEGER NOT NULL DEFAULT 1000
        )
    """)

    # Every bet ever placed. This table is the permanent audit log --
    # we never update or delete rows here, only insert.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id SERIAL PRIMARY KEY,
            user_name TEXT NOT NULL,
            contract_id INTEGER NOT NULL,
            position TEXT NOT NULL CHECK (position IN ('YES', 'NO')),
            tokens_wagered INTEGER NOT NULL CHECK (tokens_wagered > 0),
            timestamp TEXT NOT NULL,
            FOREIGN KEY (contract_id) REFERENCES contracts (id)
        )
    """)

    # One row per bet, recording what the implied YES probability
    # became immediately after that bet. This is what powers the
    # "probability history" line chart.
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS probability_snapshots (
            id SERIAL PRIMARY KEY,
            contract_id INTEGER NOT NULL,
            yes_probability REAL NOT NULL,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (contract_id) REFERENCES contracts (id)
        )
    """)

    conn.commit()

    # Runs on every startup; no-ops after the first time the columns
    # exist.
    _add_resolution_columns_if_missing(conn)

    conn.close()
    print("Database initialized (Postgres)")


if __name__ == "__main__":
    # Running python database.py directly will just set up the tables.
    init_db()
