# -*- coding: utf-8 -*-
"""
일기장 로컬 서버
- 이 컴퓨터(127.0.0.1)에서만 접속할 수 있어요. 바깥 인터넷으로 일기가 나가지 않아요.
- 일기는 같은 폴더의 data/diary.db (SQLite 파일 하나)에 저장돼요.
- 파이썬만 있으면 되고, 따로 설치할 패키지는 없어요.

실행: "일기장 시작.bat" 더블클릭 (또는 python server.py)
"""
import json
import os
import re
import sqlite3
import sys
import threading
import webbrowser
from datetime import datetime, date, timedelta
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

HOST = "127.0.0.1"   # 이 컴퓨터에서만 접속 가능
PORT = int(os.environ.get("DIARY_PORT", "8765"))

APP_DIR = os.path.dirname(os.path.abspath(__file__))
HUB_ROOT = os.path.abspath(os.path.join(APP_DIR, "..", ".."))  # teacher-hub 폴더
DATA_DIR = os.path.join(APP_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "diary.db")

# 이 주소에서 열린 화면만 일기장 서버를 쓸 수 있어요.
ALLOWED_ORIGINS = {
    "https://goalstorm91-stack.github.io",   # GitHub Pages에 올린 허브
    f"http://127.0.0.1:{PORT}",
    f"http://localhost:{PORT}",
    "null",                                   # 컴퓨터에서 index.html을 더블클릭해 연 경우
}

MOODS = {"😊", "😌", "😐", "😢", "😠", "😴", "🤩", ""}


# ---------------------------------------------------------------- DB
def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    os.makedirs(DATA_DIR, exist_ok=True)
    with db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS entries (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                date       TEXT NOT NULL,           -- 2026-11-14
                title      TEXT NOT NULL DEFAULT '',
                body       TEXT NOT NULL DEFAULT '',
                mood       TEXT NOT NULL DEFAULT '',
                weather    TEXT NOT NULL DEFAULT '',
                tags       TEXT NOT NULL DEFAULT '', -- 쉼표로 구분
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(date)")


def now():
    return datetime.now().isoformat(timespec="seconds")


def row_to_dict(r, full=True):
    d = dict(r)
    d["tags"] = [t for t in (d.get("tags") or "").split(",") if t]
    if not full:
        body = d.pop("body", "")
        d["excerpt"] = body[:120]
    return d


def clean_entry(data):
    """화면에서 받은 값을 검사하고 정리해요."""
    if not isinstance(data, dict):
        raise ValueError("잘못된 형식이에요.")
    day = str(data.get("date") or "").strip()
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", day):
        raise ValueError("날짜 형식이 올바르지 않아요 (예: 2026-11-14).")
    date.fromisoformat(day)
    tags = data.get("tags") or []
    if isinstance(tags, str):
        tags = tags.split(",")
    tags = [re.sub(r"[,#]", "", str(t)).strip()[:20] for t in tags]
    tags = list(dict.fromkeys(t for t in tags if t))[:10]
    mood = str(data.get("mood") or "")
    return {
        "date": day,
        "title": str(data.get("title") or "").strip()[:100],
        "body": str(data.get("body") or "")[:50000],
        "mood": mood if mood in MOODS else "",
        "weather": str(data.get("weather") or "").strip()[:10],
        "tags": ",".join(tags),
    }


def streak(conn):
    days = {r[0] for r in conn.execute("SELECT DISTINCT date FROM entries")}
    d = date.today()
    if d.isoformat() not in days:
        d -= timedelta(days=1)  # 오늘 아직 안 썼으면 어제부터 셈
    n = 0
    while d.isoformat() in days:
        n += 1
        d -= timedelta(days=1)
    return n


# ---------------------------------------------------------------- HTTP
class Handler(SimpleHTTPRequestHandler):
    server_version = "TeacherDiary/1.0"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=HUB_ROOT, **kwargs)

    # 터미널 창에 접속 기록을 너무 많이 찍지 않도록
    def log_message(self, fmt, *args):
        if self.path.startswith("/api/") and self.command != "GET":
            sys.stderr.write("  %s %s\n" % (self.command, self.path))

    # ----- 공통
    def origin_ok(self):
        origin = self.headers.get("Origin")
        return origin is None or origin in ALLOWED_ORIGINS

    def cors_headers(self):
        origin = self.headers.get("Origin")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            # 인터넷 사이트(GitHub Pages)가 내 컴퓨터 서버에 접속할 때 크롬이 요구하는 헤더
            self.send_header("Access-Control-Allow-Private-Network", "true")

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.cors_headers()
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        if "application/json" not in (self.headers.get("Content-Type") or ""):
            raise ValueError("JSON으로 보내 주세요.")
        n = int(self.headers.get("Content-Length") or 0)
        if n > 20 * 1024 * 1024:
            raise ValueError("데이터가 너무 커요.")
        return json.loads(self.rfile.read(n).decode("utf-8") or "null")

    def do_OPTIONS(self):
        self.send_response(204 if self.origin_ok() else 403)
        self.cors_headers()
        self.send_header("Content-Length", "0")
        self.end_headers()

    # ----- 라우팅
    def route(self, method):
        url = urlparse(self.path)
        path = url.path
        if not path.startswith("/api/"):
            if method != "GET":
                return self.send_json({"error": "없는 주소예요."}, 404)
            if path in ("/", ""):
                self.send_response(302)
                self.send_header("Location", "/apps/diary/index.html")
                self.end_headers()
                return
            # 일기 DB 파일이나 숨김 파일은 화면으로 내보내지 않아요.
            if "/data/" in path or "/." in path or path.endswith(".py") or path.endswith(".bat"):
                return self.send_json({"error": "없는 주소예요."}, 404)
            return SimpleHTTPRequestHandler.do_GET(self)

        if not self.origin_ok():
            return self.send_json({"error": "허용되지 않은 곳에서 온 요청이에요."}, 403)

        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        m = re.fullmatch(r"/api/entries/(\d+)", path)
        try:
            with db() as conn:
                if method == "GET" and path == "/api/health":
                    return self.send_json({"ok": True, "app": "diary", "db": DB_PATH})
                if method == "GET" and path == "/api/entries":
                    return self.list_entries(conn, q)
                if method == "GET" and path == "/api/stats":
                    return self.stats(conn, q)
                if method == "GET" and path == "/api/export":
                    rows = conn.execute("SELECT * FROM entries ORDER BY date, id").fetchall()
                    return self.send_json({"app": "teacher-hub-diary", "version": 1,
                                           "exported_at": now(),
                                           "entries": [row_to_dict(r) for r in rows]})
                if method == "POST" and path == "/api/import":
                    return self.import_entries(conn, self.read_json())
                if method == "POST" and path == "/api/entries":
                    e = clean_entry(self.read_json())
                    t = now()
                    cur = conn.execute(
                        "INSERT INTO entries (date,title,body,mood,weather,tags,created_at,updated_at)"
                        " VALUES (?,?,?,?,?,?,?,?)",
                        (e["date"], e["title"], e["body"], e["mood"], e["weather"], e["tags"], t, t))
                    r = conn.execute("SELECT * FROM entries WHERE id=?", (cur.lastrowid,)).fetchone()
                    return self.send_json(row_to_dict(r), 201)
                if m:
                    eid = int(m.group(1))
                    r = conn.execute("SELECT * FROM entries WHERE id=?", (eid,)).fetchone()
                    if not r:
                        return self.send_json({"error": "일기를 찾을 수 없어요."}, 404)
                    if method == "GET":
                        return self.send_json(row_to_dict(r))
                    if method == "PUT":
                        e = clean_entry(self.read_json())
                        conn.execute(
                            "UPDATE entries SET date=?,title=?,body=?,mood=?,weather=?,tags=?,updated_at=?"
                            " WHERE id=?",
                            (e["date"], e["title"], e["body"], e["mood"], e["weather"], e["tags"], now(), eid))
                        r = conn.execute("SELECT * FROM entries WHERE id=?", (eid,)).fetchone()
                        return self.send_json(row_to_dict(r))
                    if method == "DELETE":
                        conn.execute("DELETE FROM entries WHERE id=?", (eid,))
                        return self.send_json({"ok": True})
            return self.send_json({"error": "없는 주소예요."}, 404)
        except (ValueError, json.JSONDecodeError) as ex:
            return self.send_json({"error": str(ex)}, 400)

    def do_GET(self): self.route("GET")
    def do_POST(self): self.route("POST")
    def do_PUT(self): self.route("PUT")
    def do_DELETE(self): self.route("DELETE")

    # ----- 기능
    def list_entries(self, conn, q):
        sql, args = "SELECT * FROM entries WHERE 1=1", []
        if q.get("date"):
            sql += " AND date = ?"; args.append(q["date"])
        if q.get("month"):
            sql += " AND substr(date,1,7) = ?"; args.append(q["month"])
        if q.get("q"):
            like = "%" + q["q"] + "%"
            sql += " AND (title LIKE ? OR body LIKE ? OR tags LIKE ?)"; args += [like, like, like]
        if q.get("tag"):
            sql += " AND (',' || tags || ',') LIKE ?"; args.append("%," + q["tag"] + ",%")
        sql += " ORDER BY date DESC, id DESC LIMIT ?"
        args.append(min(int(q.get("limit") or 200), 1000))
        rows = conn.execute(sql, args).fetchall()
        return self.send_json([row_to_dict(r, full=False) for r in rows])

    def stats(self, conn, q):
        month = q.get("month") or date.today().strftime("%Y-%m")
        days = {}
        for r in conn.execute(
                "SELECT date, mood FROM entries WHERE substr(date,1,7)=? ORDER BY id", (month,)):
            days[r["date"]] = r["mood"] or days.get(r["date"]) or "✏️"
        total = conn.execute("SELECT COUNT(*) FROM entries").fetchone()[0]
        this_month = conn.execute(
            "SELECT COUNT(*) FROM entries WHERE substr(date,1,7)=?",
            (date.today().strftime("%Y-%m"),)).fetchone()[0]
        tags = {}
        for (t,) in conn.execute("SELECT tags FROM entries WHERE tags != ''"):
            for x in t.split(","):
                tags[x] = tags.get(x, 0) + 1
        top = sorted(tags.items(), key=lambda kv: -kv[1])[:12]
        return self.send_json({"total": total, "this_month": this_month, "streak": streak(conn),
                               "days": days, "tags": [k for k, _ in top]})

    def import_entries(self, conn, data):
        items = data.get("entries") if isinstance(data, dict) else data
        if not isinstance(items, list):
            raise ValueError("백업 파일 형식이 아니에요.")
        added = skipped = 0
        for raw in items:
            e = clean_entry(raw)
            dup = conn.execute(
                "SELECT 1 FROM entries WHERE date=? AND title=? AND body=?",
                (e["date"], e["title"], e["body"])).fetchone()
            if dup:
                skipped += 1
                continue
            created = str(raw.get("created_at") or now())[:19]
            updated = str(raw.get("updated_at") or created)[:19]
            conn.execute(
                "INSERT INTO entries (date,title,body,mood,weather,tags,created_at,updated_at)"
                " VALUES (?,?,?,?,?,?,?,?)",
                (e["date"], e["title"], e["body"], e["mood"], e["weather"], e["tags"], created, updated))
            added += 1
        return self.send_json({"added": added, "skipped": skipped})


def main():
    init_db()
    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError:
        print(f"\n  이미 일기장 서버가 켜져 있는 것 같아요. 브라우저에서 http://localhost:{PORT} 를 열어 보세요.\n")
        if "--no-browser" not in sys.argv:
            webbrowser.open(f"http://localhost:{PORT}/")
        return
    url = f"http://localhost:{PORT}/"
    print("")
    print("  ✦ 일기장 서버가 켜졌어요!")
    print(f"  ✦ 주소: {url}")
    print(f"  ✦ 일기 저장 위치: {DB_PATH}")
    print("  ✦ 이 창을 닫으면 서버가 꺼져요. 일기를 쓰는 동안은 열어 두세요.")
    print("")
    if "--no-browser" not in sys.argv:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
