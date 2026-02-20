from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "voxel_quest.sqlite3"

app = Flask(__name__)


def db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with db_connection() as conn:
        conn.executescript(
            """
            PRAGMA foreign_keys = ON;

            CREATE TABLE IF NOT EXISTS players (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_seen TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS game_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_id INTEGER NOT NULL,
                mode TEXT NOT NULL DEFAULT 'survival',
                started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                ended_at TEXT,
                result TEXT,
                score INTEGER NOT NULL DEFAULT 0,
                crystals INTEGER NOT NULL DEFAULT 0,
                enemies_defeated INTEGER NOT NULL DEFAULT 0,
                survived_seconds INTEGER NOT NULL DEFAULT 0,
                max_combo INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (player_id) REFERENCES players(id)
            );

            CREATE TABLE IF NOT EXISTS game_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER NOT NULL,
                event_type TEXT NOT NULL,
                event_value INTEGER NOT NULL DEFAULT 0,
                payload_json TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES game_sessions(id)
            );
            """
        )


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {key: row[key] for key in row.keys()}


@app.route("/")
def index() -> str:
    return render_template("index.html")


@app.route("/api/health")
def health():
    return jsonify({"ok": True, "db": str(DB_PATH.name)})


@app.route("/api/player/register", methods=["POST"])
def register_player():
    payload = request.get_json(silent=True) or {}
    name = str(payload.get("name", "")).strip()[:40]
    if len(name) < 3:
        return jsonify({"ok": False, "error": "Nombre demasiado corto"}), 400

    with db_connection() as conn:
        conn.execute(
            """
            INSERT INTO players (name) VALUES (?)
            ON CONFLICT(name) DO UPDATE SET last_seen=CURRENT_TIMESTAMP
            """,
            (name,),
        )
        row = conn.execute(
            "SELECT id, name, created_at, last_seen FROM players WHERE name = ?",
            (name,),
        ).fetchone()

    return jsonify({"ok": True, "player": row_to_dict(row)})


@app.route("/api/session/start", methods=["POST"])
def start_session():
    payload = request.get_json(silent=True) or {}
    player_id = int(payload.get("player_id", 0))
    mode = str(payload.get("mode", "survival")).strip()[:20] or "survival"

    if player_id <= 0:
        return jsonify({"ok": False, "error": "player_id inválido"}), 400

    with db_connection() as conn:
        exists = conn.execute("SELECT id FROM players WHERE id=?", (player_id,)).fetchone()
        if exists is None:
            return jsonify({"ok": False, "error": "Jugador no encontrado"}), 404

        cur = conn.execute(
            "INSERT INTO game_sessions (player_id, mode) VALUES (?, ?)",
            (player_id, mode),
        )
        session_id = cur.lastrowid

    return jsonify({"ok": True, "session_id": session_id})


@app.route("/api/session/event", methods=["POST"])
def add_event():
    payload = request.get_json(silent=True) or {}
    session_id = int(payload.get("session_id", 0))
    event_type = str(payload.get("event_type", "")).strip()[:40]
    event_value = int(payload.get("event_value", 0))
    extra = payload.get("payload", {})

    if session_id <= 0 or not event_type:
        return jsonify({"ok": False, "error": "Datos de evento incompletos"}), 400

    with db_connection() as conn:
        exists = conn.execute("SELECT id FROM game_sessions WHERE id=?", (session_id,)).fetchone()
        if exists is None:
            return jsonify({"ok": False, "error": "Sesión no encontrada"}), 404

        conn.execute(
            """
            INSERT INTO game_events (session_id, event_type, event_value, payload_json)
            VALUES (?, ?, ?, ?)
            """,
            (session_id, event_type, event_value, json.dumps(extra, ensure_ascii=False)),
        )

    return jsonify({"ok": True})


@app.route("/api/session/end", methods=["POST"])
def end_session():
    payload = request.get_json(silent=True) or {}
    session_id = int(payload.get("session_id", 0))
    result = str(payload.get("result", "defeat")).strip()[:20]
    score = int(payload.get("score", 0))
    crystals = int(payload.get("crystals", 0))
    enemies_defeated = int(payload.get("enemies_defeated", 0))
    survived_seconds = int(payload.get("survived_seconds", 0))
    max_combo = int(payload.get("max_combo", 0))

    if session_id <= 0:
        return jsonify({"ok": False, "error": "session_id inválido"}), 400

    with db_connection() as conn:
        exists = conn.execute("SELECT id FROM game_sessions WHERE id=?", (session_id,)).fetchone()
        if exists is None:
            return jsonify({"ok": False, "error": "Sesión no encontrada"}), 404

        conn.execute(
            """
            UPDATE game_sessions
               SET ended_at = CURRENT_TIMESTAMP,
                   result = ?,
                   score = ?,
                   crystals = ?,
                   enemies_defeated = ?,
                   survived_seconds = ?,
                   max_combo = ?
             WHERE id = ?
            """,
            (result, score, crystals, enemies_defeated, survived_seconds, max_combo, session_id),
        )

    return jsonify({"ok": True})


@app.route("/api/leaderboard")
def leaderboard():
    limit = max(5, min(int(request.args.get("limit", 12)), 50))
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT s.id,
                   p.name AS player_name,
                   s.result,
                   s.score,
                   s.crystals,
                   s.enemies_defeated,
                   s.survived_seconds,
                   s.max_combo,
                   s.ended_at
              FROM game_sessions s
              JOIN players p ON p.id = s.player_id
             WHERE s.ended_at IS NOT NULL
             ORDER BY s.score DESC, s.survived_seconds DESC
             LIMIT ?
            """,
            (limit,),
        ).fetchall()

    return jsonify({"ok": True, "items": [row_to_dict(row) for row in rows]})


@app.route("/api/player/<int:player_id>/history")
def player_history(player_id: int):
    limit = max(5, min(int(request.args.get("limit", 10)), 40))
    with db_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, mode, started_at, ended_at, result, score, crystals,
                   enemies_defeated, survived_seconds, max_combo
              FROM game_sessions
             WHERE player_id = ?
             ORDER BY id DESC
             LIMIT ?
            """,
            (player_id, limit),
        ).fetchall()

    return jsonify({"ok": True, "items": [row_to_dict(row) for row in rows]})


@app.route("/api/stats")
def stats():
    with db_connection() as conn:
        players = conn.execute("SELECT COUNT(*) AS total FROM players").fetchone()["total"]
        sessions = conn.execute("SELECT COUNT(*) AS total FROM game_sessions").fetchone()["total"]
        completed = conn.execute(
            "SELECT COUNT(*) AS total FROM game_sessions WHERE ended_at IS NOT NULL"
        ).fetchone()["total"]
        events = conn.execute("SELECT COUNT(*) AS total FROM game_events").fetchone()["total"]

    return jsonify(
        {
            "ok": True,
            "players": players,
            "sessions": sessions,
            "completed_sessions": completed,
            "events": events,
        }
    )


# ─── v2: Seed & Import ───────────────────────────────────

import random as _rnd

SEED_NAMES = ["AlphaWolf", "NovaStrike", "CrystalHunter", "VoxelKing", "PixelNinja"]


@app.route("/api/seed", methods=["POST"])
def seed_data():
    """Inserta partidas demo para demostrar el leaderboard."""
    inserted = 0
    with db_connection() as conn:
        for name in SEED_NAMES:
            conn.execute(
                "INSERT INTO players (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET last_seen=CURRENT_TIMESTAMP",
                (name,),
            )
            pid = conn.execute("SELECT id FROM players WHERE name=?", (name,)).fetchone()["id"]
            score = _rnd.randint(120, 950)
            crystals = _rnd.randint(3, 14)
            survived = _rnd.randint(30, 100)
            result = "victory" if survived >= 90 and crystals >= 12 else "defeat"
            conn.execute(
                """INSERT INTO game_sessions
                   (player_id, mode, ended_at, result, score, crystals, enemies_defeated, survived_seconds, max_combo)
                   VALUES (?, 'voxel_survival', CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)""",
                (pid, result, score, crystals, _rnd.randint(2, 18), survived, _rnd.randint(1, 6)),
            )
            inserted += 1
    return jsonify({"ok": True, "inserted": inserted})


@app.route("/api/import", methods=["POST"])
def import_data():
    """Re-inserta partidas desde un JSON exportado previamente."""
    payload = request.get_json(silent=True) or {}
    items = payload.get("leaderboard", [])
    if not items:
        return jsonify({"ok": False, "error": "Sin datos de leaderboard"}), 400

    imported = 0
    with db_connection() as conn:
        for item in items:
            name = str(item.get("player_name", "imported"))[:40]
            conn.execute(
                "INSERT INTO players (name) VALUES (?) ON CONFLICT(name) DO UPDATE SET last_seen=CURRENT_TIMESTAMP",
                (name,),
            )
            pid = conn.execute("SELECT id FROM players WHERE name=?", (name,)).fetchone()["id"]
            conn.execute(
                """INSERT INTO game_sessions
                   (player_id, mode, ended_at, result, score, crystals, enemies_defeated, survived_seconds, max_combo)
                   VALUES (?, 'voxel_survival', CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?)""",
                (
                    pid,
                    item.get("result", "defeat"),
                    item.get("score", 0),
                    item.get("crystals", 0),
                    item.get("enemies_defeated", 0),
                    item.get("survived_seconds", 0),
                    item.get("max_combo", 0),
                ),
            )
            imported += 1
    return jsonify({"ok": True, "imported": imported})


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5090, debug=True)
