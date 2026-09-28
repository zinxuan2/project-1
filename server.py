from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sqlite3
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parent
DATABASE = ROOT / "moods.sqlite3"
HOST = "127.0.0.1"
PORT = 8000
MOODS = {"radiant", "good", "steady", "low", "anxious"}


def connect_db():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """CREATE TABLE IF NOT EXISTS entries (
            day TEXT PRIMARY KEY,
            mood TEXT NOT NULL,
            intensity INTEGER NOT NULL,
            note TEXT NOT NULL DEFAULT '',
            saved_at TEXT NOT NULL
        )"""
    )
    return connection


class MoodHandler(BaseHTTPRequestHandler):
    def send_json(self, data, status=200):
        payload = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def serve_static(self, filename):
        path = ROOT / filename
        if not path.is_file():
            self.send_error(404)
            return
        payload = path.read_bytes()
        content_type = "text/html; charset=utf-8" if filename.endswith(".html") else None
        if content_type is None:
            import mimetypes
            content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
            if content_type.startswith("text/") or content_type in ("application/javascript",):
                content_type += "; charset=utf-8"
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        request = urlsplit(self.path)
        if request.path == "/api/entries":
            with connect_db() as connection:
                if parse_qs(request.query).get("all") == ["1"]:
                    rows = connection.execute(
                        "SELECT day, mood, intensity, note FROM entries ORDER BY day"
                    ).fetchall()
                else:
                    cutoff = (date.today() - timedelta(days=6)).isoformat()
                    rows = connection.execute(
                        "SELECT day, mood, intensity, note FROM entries WHERE day >= ? ORDER BY day",
                        (cutoff,),
                    ).fetchall()
            self.send_json([dict(row) for row in rows])
        elif request.path == "/":
            self.serve_static("index.html")
        elif request.path in ("/styles.css", "/app.js"):
            self.serve_static(request.path.lstrip("/"))
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path != "/api/entries":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 8192:
                raise ValueError("Invalid request size")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            mood = payload.get("mood")
            intensity = payload.get("intensity")
            note = payload.get("note", "")
            if mood not in MOODS:
                raise ValueError("Choose a mood from the list")
            if not isinstance(intensity, int) or isinstance(intensity, bool) or not 1 <= intensity <= 5:
                raise ValueError("Intensity must be between 1 and 5")
            if not isinstance(note, str) or len(note) > 280:
                raise ValueError("Note must be 280 characters or fewer")
            today = date.today().isoformat()
            with connect_db() as connection:
                connection.execute(
                    """INSERT INTO entries (day, mood, intensity, note, saved_at)
                       VALUES (?, ?, ?, ?, ?)
                       ON CONFLICT(day) DO UPDATE SET
                           mood = excluded.mood,
                           intensity = excluded.intensity,
                           note = excluded.note,
                           saved_at = excluded.saved_at""",
                    (today, mood, intensity, note.strip(), datetime.now().isoformat(timespec="seconds")),
                )
            self.send_json({"day": today, "mood": mood, "intensity": intensity, "note": note.strip()})
        except (ValueError, TypeError, json.JSONDecodeError, UnicodeDecodeError) as error:
            self.send_json({"error": str(error)}, 400)

    def do_DELETE(self):
        if self.path != "/api/entries":
            self.send_error(404)
            return
        today = date.today().isoformat()
        with connect_db() as connection:
            deleted = connection.execute("DELETE FROM entries WHERE day = ?", (today,)).rowcount > 0
        self.send_json({"day": today, "deleted": deleted})

    def log_message(self, format_string, *args):
        print("%s - %s" % (self.address_string(), format_string % args))


if __name__ == "__main__":
    with connect_db():
        pass
    print("Daily Mood Tracker is running at http://127.0.0.1:%d" % PORT)
    ThreadingHTTPServer((HOST, PORT), MoodHandler).serve_forever()
