"""
app.py

The Flask backend. This file defines every API endpoint the React
frontend will call, and also serves the built React app itself in
production (see the static-file routes at the bottom).

Local development:
    python app.py
Starts a local server at http://localhost:5000

------------------------------------------------------------------
How a bet flows through this file (POST /api/predictions):
1. Validate the input (name, contract exists, position is YES/NO,
   tokens > 0).
2. Look up (or create) the user, check they have enough tokens.
3. Insert a row into `predictions`.
4. Deduct tokens from the user's balance.
5. Update the contract's yes_total/no_total.
6. Record a new row in `probability_snapshots` with the new
   implied probability (this is what feeds the history chart).
7. Return the updated contract + user balance to React.

Steps 3-6 all happen inside one function so the numbers never get
out of sync with each other.

------------------------------------------------------------------
Market resolution (POST /api/contracts/<id>/resolve):
Only the "Instructor" user can resolve a market. Resolution is a
one-way action -- once resolved, no more bets are accepted on that
contract (enforced both here and via the frontend hiding the bet
form). Payouts use a pari-mutuel design: the losing side's total
stake is pooled and redistributed to winners in proportion to their
share of the winning side's stake. See resolve_contract() below for
the exact math.
------------------------------------------------------------------

Note on the database layer: this uses psycopg2 (Postgres), not
sqlite3. Two things differ mechanically from the SQLite version:
  - Placeholders are %s instead of ?
  - cursor.execute(...) returns None in psycopg2 (unlike sqlite3,
    which returns the cursor), so execute() and fetchone()/fetchall()
    are always two separate statements here, and INSERTs that need
    the new row's id use "RETURNING id" instead of cursor.lastrowid.
"""

import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from datetime import datetime, timezone
from database import get_connection, init_db

app = Flask(__name__, static_folder="static", static_url_path="")

# In production, frontend and backend are served from the same origin
# (Flask serves the built React app directly -- see the catch-all
# route at the bottom), so cross-origin requests normally shouldn't
# happen at all. This is kept narrow rather than removed outright as
# a safety net for local development, where the Vite dev server
# (localhost:5173) still talks to Flask (localhost:5000) cross-port.
# Set ALLOWED_ORIGIN in production only if you deploy frontend and
# backend separately; otherwise it's unused.
ALLOWED_ORIGIN = os.environ.get("ALLOWED_ORIGIN")
if ALLOWED_ORIGIN:
    CORS(app, origins=[ALLOWED_ORIGIN])
else:
    # No ALLOWED_ORIGIN set -- assume local dev, allow the Vite dev server.
    CORS(app, origins=["http://localhost:5173", "http://127.0.0.1:5173"])

STARTING_TOKENS = 1000

# The one privileged user for this demo. Matched as an exact,
# case-sensitive string -- same trust model the rest of the app
# already uses (no passwords, no accounts, identity == typed name).
# This is a convenience gate for a live demo among a trusted
# audience, not real authentication.
INSTRUCTOR_NAME = "Instructor"


def calculate_probability(yes_total, no_total):
    """
    The core prediction market formula: implied probability is just
    each side's share of the total tokens wagered.

    If nobody has bet yet (both totals are 0), we default to 50%
    since there's no information yet to push it either way.
    """
    total = yes_total + no_total
    if total == 0:
        return 0.5
    return yes_total / total


def contract_to_dict(row, your_payout=None):
    """
    Convert a contracts table row into the JSON shape React expects.

    your_payout is an optional per-user net gain/loss (positive if
    they won, negative if they lost, None if this user placed no
    bets on this contract or the contract isn't resolved yet). It's
    computed by the caller, not this function, since it depends on
    who's asking -- contract_to_dict itself stays user-agnostic.
    """
    yes_total = row["yes_total"]
    no_total = row["no_total"]
    yes_probability = calculate_probability(yes_total, no_total)

    result = {
        "id": row["id"],
        "question": row["question"],
        "yes_total": yes_total,
        "no_total": no_total,
        "yes_probability": round(yes_probability, 4),
        "no_probability": round(1 - yes_probability, 4),
        "resolved": bool(row["resolved"]),
        "outcome": row["outcome"],
    }

    if row["resolved"] and your_payout is not None:
        result["your_payout"] = your_payout

    return result


def compute_user_net_payout(cursor, contract_id, outcome, user_name):
    """
    For a resolved contract, compute one user's total net gain/loss
    across all bets they placed on it (summed, in case they bet
    multiple times on the same contract).

    Returns None if this user placed no bets on this contract at all,
    so the frontend can tell "didn't participate" apart from "broke
    even" -- both would otherwise look like 0.
    """
    cursor.execute(
        "SELECT position, tokens_wagered FROM predictions WHERE contract_id = %s AND user_name = %s",
        (contract_id, user_name),
    )
    predictions = cursor.fetchall()

    if not predictions:
        return None

    cursor.execute(
        "SELECT yes_total, no_total FROM contracts WHERE id = %s", (contract_id,)
    )
    contract_row = cursor.fetchone()
    winning_total = contract_row["yes_total"] if outcome == "YES" else contract_row["no_total"]
    losing_total = contract_row["no_total"] if outcome == "YES" else contract_row["yes_total"]

    net = 0
    for p in predictions:
        stake = p["tokens_wagered"]
        if p["position"] == outcome:
            # Winning stake gets itself back plus a proportional share
            # of the losing pool -- see resolve_contract() for the
            # same formula applied when payouts are actually paid out.
            payout = round(stake + (losing_total * stake / winning_total))
            net += payout - stake
        else:
            # Losing stake was already deducted at bet time; nothing
            # more happens to it, so the net effect is just -stake.
            net += -stake

    return net


@app.route("/api/health")
def health_check():
    """Simple endpoint to confirm the server is running."""
    return jsonify({"status": "ok", "message": "Prediction market API is running"})


@app.route("/api/contracts", methods=["GET"])
def get_contracts():
    """
    Return all contracts with their current totals and implied
    probability.

    Accepts an optional ?user_name=... query param. When present,
    and a contract is resolved, the response includes a your_payout
    field showing that specific user's net gain/loss on it -- this
    is how the existing polling loop in App.jsx ends up delivering
    personalized "Resolved: YES Payout: +200 tokens" banners to every
    user automatically, without a separate endpoint or a new polling
    loop.
    """
    user_name = (request.args.get("user_name") or "").strip()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM contracts ORDER BY id")
    rows = cursor.fetchall()

    contracts = []
    for row in rows:
        your_payout = None
        if row["resolved"] and user_name:
            your_payout = compute_user_net_payout(cursor, row["id"], row["outcome"], user_name)
        contracts.append(contract_to_dict(row, your_payout))

    conn.close()
    return jsonify(contracts)


@app.route("/api/contracts/<int:contract_id>", methods=["GET"])
def get_contract(contract_id):
    """Return a single contract by id."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM contracts WHERE id = %s", (contract_id,))
    row = cursor.fetchone()
    conn.close()

    if row is None:
        return jsonify({"error": "Contract not found"}), 404

    return jsonify(contract_to_dict(row))


@app.route("/api/contracts/<int:contract_id>/history", methods=["GET"])
def get_contract_history(contract_id):
    """
    Return the probability history for one contract, ordered oldest
    to newest. This is what the React line chart plots.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT yes_probability, timestamp
        FROM probability_snapshots
        WHERE contract_id = %s
        ORDER BY timestamp ASC
        """,
        (contract_id,),
    )
    rows = cursor.fetchall()
    conn.close()

    history = [{"yes_probability": r["yes_probability"], "timestamp": r["timestamp"]} for r in rows]
    return jsonify(history)


@app.route("/api/predictions/recent", methods=["GET"])
def get_recent_predictions():
    """
    Return the most recent predictions across all contracts, newest
    first. Joins against contracts so React gets the question text
    directly instead of having to look it up by contract_id.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT predictions.id, predictions.user_name, predictions.position,
               predictions.tokens_wagered, predictions.timestamp,
               contracts.id AS contract_id, contracts.question
        FROM predictions
        JOIN contracts ON predictions.contract_id = contracts.id
        ORDER BY predictions.timestamp DESC
        LIMIT 15
        """
    )
    rows = cursor.fetchall()
    conn.close()

    recent = [dict(row) for row in rows]
    return jsonify(recent)


@app.route("/api/users/<string:user_name>", methods=["GET"])
def get_user(user_name):
    """
    Return a user's remaining token balance. If the name has never
    placed a bet before, they don't exist in the database yet --
    in that case we just report the default starting balance
    without creating a row (the row gets created on their first bet).
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_name = %s", (user_name,))
    row = cursor.fetchone()
    conn.close()

    if row is None:
        return jsonify({"user_name": user_name, "tokens_remaining": STARTING_TOKENS})

    return jsonify({"user_name": row["user_name"], "tokens_remaining": row["tokens_remaining"]})


@app.route("/api/predictions", methods=["POST"])
def create_prediction():
    """
    Place a new bet. Expects JSON body:
    {
        "user_name": "Maya",
        "contract_id": 1,
        "position": "YES",
        "tokens_wagered": 100
    }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    user_name = (data.get("user_name") or "").strip()
    contract_id = data.get("contract_id")
    position = (data.get("position") or "").upper().strip()
    tokens_wagered = data.get("tokens_wagered")

    # --- Validation ---
    if not user_name:
        return jsonify({"error": "Name is required"}), 400

    if position not in ("YES", "NO"):
        return jsonify({"error": "Position must be YES or NO"}), 400

    if not isinstance(tokens_wagered, int) or tokens_wagered <= 0:
        return jsonify({"error": "tokens_wagered must be a positive whole number"}), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM contracts WHERE id = %s", (contract_id,))
    contract_row = cursor.fetchone()
    if contract_row is None:
        conn.close()
        return jsonify({"error": "Contract not found"}), 404

    # --- Reject bets on a resolved market ---
    # Mirrors the frontend hiding the bet form once resolved, but
    # enforced here too so a direct API call can't bypass it.
    if contract_row["resolved"]:
        conn.close()
        return jsonify({"error": "This market has been resolved and is no longer accepting predictions"}), 400

    # --- Look up or create the user ---
    cursor.execute("SELECT * FROM users WHERE user_name = %s", (user_name,))
    user_row = cursor.fetchone()

    if user_row is None:
        cursor.execute(
            "INSERT INTO users (user_name, tokens_remaining) VALUES (%s, %s)",
            (user_name, STARTING_TOKENS),
        )
        tokens_remaining = STARTING_TOKENS
    else:
        tokens_remaining = user_row["tokens_remaining"]

    # --- Enforce the token balance ---
    if tokens_wagered > tokens_remaining:
        conn.close()
        return jsonify({
            "error": f"Insufficient tokens. {user_name} has {tokens_remaining} tokens remaining."
        }), 400

    # --- Record the bet ---
    timestamp = datetime.now(timezone.utc).isoformat()

    cursor.execute(
        """
        INSERT INTO predictions (user_name, contract_id, position, tokens_wagered, timestamp)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (user_name, contract_id, position, tokens_wagered, timestamp),
    )

    # --- Deduct the user's balance ---
    new_balance = tokens_remaining - tokens_wagered
    cursor.execute(
        "UPDATE users SET tokens_remaining = %s WHERE user_name = %s",
        (new_balance, user_name),
    )

    # --- Update the contract's running totals ---
    new_yes_total = contract_row["yes_total"] + (tokens_wagered if position == "YES" else 0)
    new_no_total = contract_row["no_total"] + (tokens_wagered if position == "NO" else 0)

    cursor.execute(
        "UPDATE contracts SET yes_total = %s, no_total = %s WHERE id = %s",
        (new_yes_total, new_no_total, contract_id),
    )

    # --- Record the new probability snapshot for the history chart ---
    new_probability = calculate_probability(new_yes_total, new_no_total)
    cursor.execute(
        """
        INSERT INTO probability_snapshots (contract_id, yes_probability, timestamp)
        VALUES (%s, %s, %s)
        """,
        (contract_id, new_probability, timestamp),
    )

    conn.commit()
    conn.close()

    return jsonify({
        "message": "Prediction recorded",
        "user_balance_remaining": new_balance,
        "contract": {
            "id": contract_id,
            "yes_total": new_yes_total,
            "no_total": new_no_total,
            "yes_probability": round(new_probability, 4),
            "no_probability": round(1 - new_probability, 4),
        },
    }), 201


@app.route("/api/contracts/<int:contract_id>/resolve", methods=["POST"])
def resolve_contract(contract_id):
    """
    Instructor-only. Resolves a market to YES or NO and pays out
    winners. Expects JSON body:
    {
        "user_name": "Instructor",
        "outcome": "YES"
    }

    Payout design (pari-mutuel):
    - Losers' stakes were already deducted at bet time; they get
      nothing further -- this function makes no changes to their
      balance.
    - Winners get their stake back, plus a share of the losing
      pool proportional to their share of the winning pool:

          payout = stake + losing_pool * (stake / winning_pool)

      This fully redistributes the losing pool with nothing created
      or destroyed: total paid out == winning_pool + losing_pool.
    - Edge case: if nobody bet the winning side (winning_pool == 0),
      there's no one to redistribute to, so the losing pool simply
      isn't paid out to anyone. Rare in practice, harmless for a demo.
    """
    data = request.get_json(silent=True) or {}
    user_name = (data.get("user_name") or "").strip()
    outcome = (data.get("outcome") or "").upper().strip()

    # Backend-side check, not just a UI gate -- this is what actually
    # stops a direct API call (e.g. from browser dev tools) from
    # resolving a market. Not real auth, but consistent with the
    # name-as-identity trust model the rest of the app already uses.
    if user_name != INSTRUCTOR_NAME:
        return jsonify({"error": "Only the Instructor can resolve a market"}), 403

    if outcome not in ("YES", "NO"):
        return jsonify({"error": "outcome must be YES or NO"}), 400

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM contracts WHERE id = %s", (contract_id,))
    contract_row = cursor.fetchone()
    if contract_row is None:
        conn.close()
        return jsonify({"error": "Contract not found"}), 404

    if contract_row["resolved"]:
        conn.close()
        return jsonify({"error": "This market has already been resolved"}), 400

    winning_total = contract_row["yes_total"] if outcome == "YES" else contract_row["no_total"]
    losing_total = contract_row["no_total"] if outcome == "YES" else contract_row["yes_total"]

    cursor.execute(
        "SELECT user_name, position, tokens_wagered FROM predictions WHERE contract_id = %s",
        (contract_id,),
    )
    predictions = cursor.fetchall()

    # Aggregate payout per user first (in case someone bet the winning
    # side multiple times on this contract), then apply once per user
    # so we only issue one balance update per person.
    payouts_by_user = {}
    if winning_total > 0:
        for p in predictions:
            if p["position"] == outcome:
                stake = p["tokens_wagered"]
                payout = round(stake + (losing_total * stake / winning_total))
                payouts_by_user[p["user_name"]] = payouts_by_user.get(p["user_name"], 0) + payout

    for winner_name, payout in payouts_by_user.items():
        cursor.execute("SELECT * FROM users WHERE user_name = %s", (winner_name,))
        user_row = cursor.fetchone()

        if user_row is None:
            # Shouldn't normally happen (placing a bet always creates
            # the user row), but handled defensively so resolution
            # never crashes mid-payout.
            cursor.execute(
                "INSERT INTO users (user_name, tokens_remaining) VALUES (%s, %s)",
                (winner_name, STARTING_TOKENS + payout),
            )
        else:
            new_balance = user_row["tokens_remaining"] + payout
            cursor.execute(
                "UPDATE users SET tokens_remaining = %s WHERE user_name = %s",
                (new_balance, winner_name),
            )

    cursor.execute(
        "UPDATE contracts SET resolved = 1, outcome = %s WHERE id = %s",
        (outcome, contract_id),
    )

    conn.commit()

    cursor.execute("SELECT * FROM contracts WHERE id = %s", (contract_id,))
    updated_row = cursor.fetchone()
    conn.close()

    return jsonify(contract_to_dict(updated_row)), 200


@app.route("/api/reset", methods=["POST"])
def reset_market():
    """
    Instructor-only. Demo-only endpoint: wipes all bets and resets
    every contract back to a clean, unresolved 0/0 state. Does NOT
    delete the contracts themselves -- only their activity. Intended
    to be called from a "Reset Market" button before a presentation.
    """
    data = request.get_json(silent=True) or {}
    user_name = (data.get("user_name") or "").strip()

    if user_name != INSTRUCTOR_NAME:
        return jsonify({"error": "Only the Instructor can reset the market"}), 403

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM predictions")
    cursor.execute("DELETE FROM probability_snapshots")
    cursor.execute("UPDATE contracts SET yes_total = 0, no_total = 0, resolved = 0, outcome = NULL")

    # Also reset every user's token balance back to the starting amount,
    # so a fresh demo run isn't accidentally constrained by old balances.
    cursor.execute("DELETE FROM users")

    conn.commit()
    conn.close()

    return jsonify({"message": "Market reset successfully"}), 200


@app.route("/api/contracts", methods=["POST"])
def create_contract():
    """
    Create a new YES/NO contract at runtime. Expects JSON body:
    { "question": "Will it rain tomorrow?" }
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    user_name = (data.get("user_name") or "").strip()
    if user_name != INSTRUCTOR_NAME:
        return jsonify({"error": "Only the Instructor can create a market"}), 403

    question = (data.get("question") or "").strip()
    if not question:
        return jsonify({"error": "question is required"}), 400

    conn = get_connection()
    cursor = conn.cursor()
    # RETURNING id replaces sqlite3's cursor.lastrowid, which psycopg2
    # doesn't provide -- Postgres gives the new row's id back directly
    # as part of the INSERT itself.
    cursor.execute(
        "INSERT INTO contracts (question, yes_total, no_total) VALUES (%s, 0, 0) RETURNING id",
        (question,),
    )
    new_id = cursor.fetchone()["id"]
    conn.commit()
    conn.close()

    return jsonify({
        "id": new_id,
        "question": question,
        "yes_total": 0,
        "no_total": 0,
        "yes_probability": 0.5,
        "no_probability": 0.5,
        "resolved": False,
        "outcome": None,
    }), 201


@app.route("/api/contracts/<int:contract_id>", methods=["DELETE"])
def delete_contract(contract_id):
    """
    Instructor-only. Delete a contract and all of its related data.
    Works on both seeded and runtime-created contracts -- there's no
    distinction between them in the database.

    Expects a JSON body: { "user_name": "Instructor" }
    (fetch() supports a body on DELETE requests, so this follows the
    same request-body pattern as the other instructor-only endpoints
    rather than using a query param.)
    """
    data = request.get_json(silent=True) or {}
    user_name = (data.get("user_name") or "").strip()

    if user_name != INSTRUCTOR_NAME:
        return jsonify({"error": "Only the Instructor can delete a market"}), 403

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM contracts WHERE id = %s", (contract_id,))
    existing = cursor.fetchone()
    if existing is None:
        conn.close()
        return jsonify({"error": "Contract not found"}), 404

    cursor.execute("DELETE FROM predictions WHERE contract_id = %s", (contract_id,))
    cursor.execute("DELETE FROM probability_snapshots WHERE contract_id = %s", (contract_id,))
    cursor.execute("DELETE FROM contracts WHERE id = %s", (contract_id,))

    conn.commit()
    conn.close()

    return jsonify({"message": "Contract deleted", "id": contract_id}), 200


# ------------------------------------------------------------------
# Static file serving: in production, the React app is built (npm run
# build) into frontend/dist, and that build gets copied into
# backend/static at deploy time (see the build command in the deploy
# guide). Flask serves it directly so the whole app is one origin --
# one URL, no CORS needed between frontend and backend in production.
#
# This route is a catch-all: any path that isn't /api/... and isn't a
# real static file falls through to index.html, so React Router-style
# client-side paths (if any are added later) still load the app
# instead of getting a Flask 404.
# ------------------------------------------------------------------
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, "index.html")


if __name__ == "__main__":
    # Make sure the database and tables exist before the server starts.
    init_db()
    app.run(debug=True, port=5000, threaded=True)
