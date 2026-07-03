"""
seed.py

Run this once after init_db() to load the 3 example contracts into
the database. Safe to re-run -- it checks if contracts already exist
first, so you won't get duplicates.

Usage:
    python seed.py
"""

from database import get_connection, init_db

CONTRACTS = [
    "Will the Chiefs win their next game?",
    "Will inflation be below 3% at year-end?",
    "Will OpenAI release GPT-6 before January 1, 2027?",
]


def seed_contracts():
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) AS count FROM contracts")
    existing_count = cursor.fetchone()["count"]

    if existing_count > 0:
        print(f"Contracts already exist ({existing_count} found) -- skipping seed.")
        conn.close()
        return

    for question in CONTRACTS:
        cursor.execute(
            "INSERT INTO contracts (question, yes_total, no_total) VALUES (%s, 0, 0)",
            (question,),
        )

    conn.commit()
    conn.close()
    print(f"Seeded {len(CONTRACTS)} contracts.")


if __name__ == "__main__":
    init_db()  # make sure tables exist first
    seed_contracts()
