"""
app.py  -  CyberShield x HackLab (Flask backend)

Run with:   python app.py
Then open:  http://127.0.0.1:5000

Two kinds of routes live here:
  1. PAGE routes   -> return an HTML template   (e.g. /dashboard)
  2. API routes    -> return JSON for main.js   (e.g. /api/state)

The server decides all XP amounts. The browser only reports WHAT the
learner did (for example "finished lab sqli"), never how much XP to give.
"""
import json
import re
from datetime import date, datetime, timedelta

from flask import Flask, g, jsonify, render_template, request, abort
from jinja2 import TemplateNotFound

import content
import database

try:                                   # lesson text is added in Part 2
    from lessons import LESSONS
except ImportError:
    LESSONS = {}

app = Flask(__name__)
database.init_db()                     # create tables on startup

MODULE_BY_SLUG = {m["slug"]: m for m in content.MODULES}
LAB_BY_ID = {lab["id"]: lab for lab in content.LABS}
ACHIEVEMENT_BY_CODE = {a["code"]: a for a in content.ACHIEVEMENTS}
NICKNAME_RE = re.compile(r"^[A-Za-z0-9_\- ]{2,20}$")


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------
def get_db():
    """One database connection per request, closed automatically."""
    if "db" not in g:
        g.db = database.get_connection()
    return g.db


@app.teardown_appcontext
def close_db(_exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


def now_iso():
    return datetime.now().isoformat(timespec="seconds")


def today_str():
    return date.today().isoformat()


def scalar(db, sql, params=()):
    row = db.execute(sql, params).fetchone()
    return row[0] if row and row[0] is not None else 0


def error(message, status=400):
    return jsonify({"ok": False, "error": message}), status


def int_field(data, name, low, high):
    """Read an integer from JSON and make sure it is within [low, high]."""
    value = data.get(name)
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"'{name}' must be a whole number.")
    if value < low or value > high:
        raise ValueError(f"'{name}' must be between {low} and {high}.")
    return value


# ---------------------------------------------------------------------------
# Levels, streaks, XP
# ---------------------------------------------------------------------------
def level_info(xp):
    index = 0
    for i, (_name, threshold) in enumerate(content.LEVELS):
        if xp >= threshold:
            index = i
    name, floor = content.LEVELS[index]
    if index + 1 < len(content.LEVELS):
        next_name, ceiling = content.LEVELS[index + 1]
        percent = round((xp - floor) / (ceiling - floor) * 100)
        to_next = ceiling - xp
    else:
        next_name, ceiling, percent, to_next = None, None, 100, 0
    return {"index": index, "name": name, "floor": floor, "next_name": next_name,
            "next_xp": ceiling, "percent": percent, "xp_to_next": to_next}


def get_profile(db):
    return db.execute("SELECT * FROM profile WHERE id = 1").fetchone()


def touch_streak(db):
    """Count consecutive days with activity."""
    profile = get_profile(db)
    today = date.today()
    if profile["last_active"] == today.isoformat():
        return
    yesterday = (today - timedelta(days=1)).isoformat()
    streak = profile["streak"] + 1 if profile["last_active"] == yesterday else 1
    best = max(streak, profile["best_streak"])
    db.execute("UPDATE profile SET streak = ?, best_streak = ?, last_active = ? WHERE id = 1",
               (streak, best, today.isoformat()))


def log_activity(db, kind, ref, title, xp=0):
    db.execute("INSERT INTO activity (kind, ref, title, xp, created_at) VALUES (?, ?, ?, ?, ?)",
               (kind, ref, title, xp, now_iso()))
    touch_streak(db)


def grant_xp(db, amount):
    if amount > 0:
        db.execute("UPDATE profile SET xp = xp + ? WHERE id = 1", (amount,))


# ---------------------------------------------------------------------------
# Achievements
# ---------------------------------------------------------------------------
def achievement_metrics(db):
    """code -> (current, target). Used for unlocking AND for progress bars."""
    modules_done = scalar(db, "SELECT COUNT(*) FROM module_progress WHERE status = 'completed'")
    labs_done = scalar(db, "SELECT COUNT(*) FROM lab_completion")
    missions_done = scalar(db, "SELECT COUNT(*) FROM daily_missions WHERE completed = 1")
    phishing = scalar(db, "SELECT COUNT(*) FROM lab_completion WHERE lab_id = 'phishing'")
    code_review = scalar(db, "SELECT COUNT(*) FROM quiz_results WHERE quiz_key = 'code_review' "
                             "AND correct * 100 >= total * ?", (content.PASS_PERCENT,))
    total_modules, total_labs = len(content.MODULES), len(content.LABS)
    return {
        "first_access": (min(modules_done, 1), 1),
        "bug_hunter": (min(labs_done, 3), 3),
        "secure_mind": (min(modules_done, 5), 5),
        "phantom_detective": (phishing, 1),
        "code_sentinel": (min(code_review, 1), 1),
        "iron_wall": (labs_done, total_labs),
        "night_owl": (min(missions_done, 5), 5),
        "cyber_guardian": (modules_done + labs_done, total_modules + total_labs),
    }


def check_achievements(db):
    """Unlock every badge whose condition is now true. Returns the new ones."""
    unlocked = {r["code"] for r in db.execute("SELECT code FROM achievements")}
    new = []
    for code, (current, target) in achievement_metrics(db).items():
        if current >= target and code not in unlocked:
            db.execute("INSERT INTO achievements (code, unlocked_at) VALUES (?, ?)", (code, now_iso()))
            grant_xp(db, content.ACHIEVEMENT_XP)
            badge = ACHIEVEMENT_BY_CODE[code]
            log_activity(db, "achievement", code, f"Achievement unlocked: {badge['name']}",
                         content.ACHIEVEMENT_XP)
            new.append({"code": code, "name": badge["name"], "desc": badge["desc"],
                        "xp": content.ACHIEVEMENT_XP})
    return new


# ---------------------------------------------------------------------------
# Daily mission
# ---------------------------------------------------------------------------
def mission_ready(db, mission):
    """Has the learner really done what the mission asks, today?"""
    like = today_str() + "%"
    check, refs = mission["check"], mission.get("refs")
    if check == "questions":
        return scalar(db, "SELECT COALESCE(SUM(total), 0) FROM quiz_results WHERE created_at LIKE ?",
                      (like,)) >= 5
    if check in ("module_refs", "lab_refs"):
        kind = "module" if check == "module_refs" else "lab"
        rows = db.execute("SELECT DISTINCT ref FROM activity WHERE kind = ? AND created_at LIKE ?",
                          (kind, like)).fetchall()
        done = {r["ref"] for r in rows}
        return bool(done) if refs is None else bool(done & set(refs))
    if check == "quiz_keys":
        marks = ",".join("?" for _ in refs)
        return scalar(db, f"SELECT COUNT(*) FROM quiz_results WHERE created_at LIKE ? "
                          f"AND quiz_key IN ({marks})", (like, *refs)) > 0
    return False


def todays_mission(db):
    pool = content.DAILY_MISSIONS
    mission = pool[date.today().toordinal() % len(pool)]
    db.execute("INSERT OR IGNORE INTO daily_missions (mission_date, mission_code) VALUES (?, ?)",
               (today_str(), mission["code"]))
    row = db.execute("SELECT * FROM daily_missions WHERE mission_date = ?", (today_str(),)).fetchone()
    return mission, row


# ---------------------------------------------------------------------------
# Building the "state" object the frontend uses everywhere
# ---------------------------------------------------------------------------
def module_list(db):
    progress = {r["slug"]: r for r in db.execute("SELECT * FROM module_progress")}
    result = []
    for m in content.MODULES:
        p = progress.get(m["slug"])
        result.append({
            **m,
            "status": p["status"] if p else "not_started",
            "quiz_correct": p["quiz_correct"] if p else None,
            "quiz_total": p["quiz_total"] if p else None,
        })
    return result


def lab_list(db):
    done = {r["lab_id"]: r for r in db.execute("SELECT * FROM lab_completion")}
    return [{**lab, "completed": lab["id"] in done,
             "score": done[lab["id"]]["score"] if lab["id"] in done else None}
            for lab in content.LABS]


def full_state(db):
    profile = get_profile(db)
    xp = profile["xp"]
    modules = module_list(db)
    labs = lab_list(db)
    unlocked = {r["code"]: r["unlocked_at"] for r in db.execute("SELECT * FROM achievements")}
    metrics = achievement_metrics(db)
    badges = [{**a, "unlocked": a["code"] in unlocked, "unlocked_at": unlocked.get(a["code"]),
               "current": metrics[a["code"]][0], "target": metrics[a["code"]][1]}
              for a in content.ACHIEVEMENTS]

    mission, mrow = todays_mission(db)
    recent = [dict(r) for r in db.execute(
        "SELECT kind, ref, title, xp, created_at FROM activity ORDER BY id DESC LIMIT 12")]

    # average of the best score for every quiz key
    best = db.execute("SELECT MAX(correct * 100.0 / total) AS pct FROM quiz_results GROUP BY quiz_key").fetchall()
    quiz_avg = round(sum(r["pct"] for r in best) / len(best)) if best else None

    done_m = sum(1 for m in modules if m["status"] == "completed")
    done_l = sum(1 for lab in labs if lab["completed"])
    total_items = len(modules) + len(labs)

    last = MODULE_BY_SLUG.get(profile["last_module"])
    settings = {**content.DEFAULT_SETTINGS, **json.loads(profile["settings"] or "{}")}

    return {
        "profile": {"nickname": profile["nickname"], "xp": xp, "streak": profile["streak"],
                    "best_streak": profile["best_streak"], "settings": settings},
        "level": level_info(xp),
        "levels": [{"name": n, "xp": t} for n, t in content.LEVELS],
        "stats": {
            "xp": xp, "modules_done": done_m, "modules_total": len(modules),
            "labs_done": done_l, "labs_total": len(labs), "quiz_avg": quiz_avg,
            "quiz_attempts": scalar(db, "SELECT COUNT(*) FROM quiz_results"),
            "streak": profile["streak"], "achievements": len(unlocked),
            "achievements_total": len(content.ACHIEVEMENTS),
            "completion": round((done_m + done_l) / total_items * 100),
        },
        "modules": modules,
        "labs": labs,
        "achievements": badges,
        "daily": {"code": mission["code"], "title": mission["title"], "desc": mission["desc"],
                  "xp": mission["xp"], "completed": bool(mrow["completed"]),
                  "ready": mission_ready(db, mission)},
        "recent": recent,
        "continue": ({"slug": last["slug"], "title": last["title"]} if last else None),
        "challenges": [{"key": k, **v} for k, v in content.CHALLENGES.items()],
    }


def finish(db, before_xp, extra=None):
    """Common ending for every route that can give XP."""
    new_badges = check_achievements(db)
    db.commit()
    after_xp = get_profile(db)["xp"]
    before_level, after_level = level_info(before_xp), level_info(after_xp)
    payload = {
        "ok": True,
        "xp_gained": after_xp - before_xp,
        "new_achievements": new_badges,
        "level_up": after_level if after_level["index"] > before_level["index"] else None,
        "state": full_state(db),
    }
    payload.update(extra or {})
    return jsonify(payload)


# ---------------------------------------------------------------------------
# Security hardening for our own app (a nice thing to learn from!)
# ---------------------------------------------------------------------------
@app.before_request
def require_json_for_writes():
    """State-changing API calls must be JSON.
    A cross-site HTML form cannot send JSON without a CORS pre-flight, which
    this app never approves - a simple CSRF defence for a local app."""
    if request.path.startswith("/api/") and request.method in ("POST", "PUT", "DELETE"):
        if not request.is_json:
            return error("Requests must be sent as JSON.", 415)


@app.after_request
def add_security_headers(resp):
    resp.headers["Content-Security-Policy"] = (
        "default-src 'self'; script-src 'self'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; "
        "base-uri 'self'; form-action 'self'; frame-ancestors 'none'")
    resp.headers["X-Content-Type-Options"] = "nosniff"
    resp.headers["Referrer-Policy"] = "same-origin"
    resp.headers["X-Frame-Options"] = "DENY"
    return resp


# ---------------------------------------------------------------------------
# PAGE routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    return render_template("index.html", modules=content.MODULES, labs=content.LABS)


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", page="dashboard")


@app.route("/academy")
def academy():
    return render_template("academy.html", page="academy")


@app.route("/academy/<slug>")
def lesson(slug):
    module = MODULE_BY_SLUG.get(slug)
    if module is None:
        abort(404)
    return render_template("lesson.html", page="academy", module=module)


@app.route("/hacklab")
def hacklab():
    return render_template("hacklab.html", page="hacklab")


@app.route("/challenges")
def challenges():
    return render_template("challenges.html", page="challenges")


@app.route("/achievements")
def achievements_page():
    return render_template("achievements.html", page="achievements")


@app.route("/progress")
def progress_page():
    return render_template("progress.html", page="progress")


@app.route("/about")
def about():
    return render_template("about.html", page="about")


@app.errorhandler(TemplateNotFound)
def template_not_built_yet(exc):
    """Friendly message while the project is delivered in parts."""
    return (f"<body style='background:#07090B;color:#B6FF00;font-family:monospace;padding:3rem'>"
            f"<h1>[ MODULE OFFLINE ]</h1><p>The template <code>{exc.name}</code> is added in a "
            f"later part of the project.</p><p><a style='color:#00E5FF' href='/'>Back to home</a></p>"
            f"</body>"), 200


@app.errorhandler(404)
def not_found(_exc):
    if request.path.startswith("/api/"):
        return error("That API route does not exist.", 404)
    return ("<body style='background:#07090B;color:#FF365E;font-family:monospace;padding:3rem'>"
            "<h1>404 // SIGNAL LOST</h1><p><a style='color:#00E5FF' href='/'>Return to base</a></p></body>"), 404


@app.errorhandler(500)
def server_error(_exc):
    if request.path.startswith("/api/"):
        return error("Something went wrong on the server. Check the terminal running app.py.", 500)
    return "Server error. Check the terminal running app.py.", 500


# ---------------------------------------------------------------------------
# API routes
# ---------------------------------------------------------------------------
@app.get("/api/health")
def api_health():
    return jsonify({"ok": True, "status": "online"})


@app.get("/api/state")
def api_state():
    db = get_db()
    state = full_state(db)
    db.commit()                      # todays_mission() may insert a row
    return jsonify({"ok": True, "state": state})


@app.post("/api/profile")
def api_profile():
    data = request.get_json(silent=True) or {}
    nickname = str(data.get("nickname", "")).strip()
    if not NICKNAME_RE.match(nickname):
        return error("Nickname must be 2-20 characters: letters, numbers, spaces, - or _.")
    db = get_db()
    db.execute("UPDATE profile SET nickname = ? WHERE id = 1", (nickname,))
    db.commit()
    return jsonify({"ok": True, "state": full_state(db)})


@app.post("/api/settings")
def api_settings():
    data = request.get_json(silent=True) or {}
    clean = {}
    for key in content.DEFAULT_SETTINGS:
        if key in data:
            if not isinstance(data[key], bool):
                return error(f"Setting '{key}' must be true or false.")
            clean[key] = data[key]
    db = get_db()
    current = json.loads(get_profile(db)["settings"] or "{}")
    current.update(clean)
    db.execute("UPDATE profile SET settings = ? WHERE id = 1", (json.dumps(current),))
    db.commit()
    return jsonify({"ok": True, "state": full_state(db)})


@app.get("/api/modules")
def api_modules():
    return jsonify({"ok": True, "modules": module_list(get_db())})


@app.get("/api/modules/<slug>")
def api_module(slug):
    module = MODULE_BY_SLUG.get(slug)
    if module is None:
        return error("Module not found.", 404)
    lesson_content = LESSONS.get(slug)
    index = content.MODULES.index(module)
    nxt = content.MODULES[index + 1] if index + 1 < len(content.MODULES) else None
    prev = content.MODULES[index - 1] if index > 0 else None
    return jsonify({"ok": True, "module": module, "lesson": lesson_content,
                    "next": nxt and {"slug": nxt["slug"], "title": nxt["title"]},
                    "prev": prev and {"slug": prev["slug"], "title": prev["title"]}})


@app.post("/api/modules/<slug>/open")
def api_module_open(slug):
    if slug not in MODULE_BY_SLUG:
        return error("Module not found.", 404)
    db = get_db()
    db.execute("INSERT OR IGNORE INTO module_progress (slug, status, opened_at) "
               "VALUES (?, 'in_progress', ?)", (slug, now_iso()))
    db.execute("UPDATE profile SET last_module = ? WHERE id = 1", (slug,))
    touch_streak(db)
    db.commit()
    return jsonify({"ok": True})


@app.post("/api/modules/<slug>/complete")
def api_module_complete(slug):
    module = MODULE_BY_SLUG.get(slug)
    if module is None:
        return error("Module not found.", 404)
    data = request.get_json(silent=True) or {}
    try:
        total = int_field(data, "total", 1, 20)
        correct = int_field(data, "correct", 0, total)
    except ValueError as exc:
        return error(str(exc))
    if correct * 100 < total * content.PASS_PERCENT:
        return error(f"Score at least {content.PASS_PERCENT}% on the quiz to complete this module.")

    db = get_db()
    before = get_profile(db)["xp"]
    existing = db.execute("SELECT status FROM module_progress WHERE slug = ?", (slug,)).fetchone()
    first_time = not existing or existing["status"] != "completed"
    now = now_iso()
    if existing:
        db.execute("UPDATE module_progress SET status = 'completed', quiz_correct = ?, quiz_total = ?, "
                   "completed_at = COALESCE(completed_at, ?) WHERE slug = ?", (correct, total, now, slug))
    else:
        db.execute("INSERT INTO module_progress (slug, status, quiz_correct, quiz_total, opened_at, completed_at) "
                   "VALUES (?, 'completed', ?, ?, ?, ?)", (slug, correct, total, now, now))
    db.execute("INSERT INTO quiz_results (quiz_key, difficulty, correct, total, xp_awarded, created_at) "
               "VALUES (?, ?, ?, ?, 0, ?)", (f"module:{slug}", module["difficulty"], correct, total, now))
    db.execute("UPDATE profile SET last_module = ? WHERE id = 1", (slug,))
    if first_time:
        grant_xp(db, module["xp"])
        log_activity(db, "module", slug, f"Completed module: {module['title']}", module["xp"])
    else:
        log_activity(db, "module", slug, f"Reviewed module: {module['title']}", 0)
    return finish(db, before, {"first_time": first_time})


@app.post("/api/labs/<lab_id>/complete")
def api_lab_complete(lab_id):
    lab = LAB_BY_ID.get(lab_id)
    if lab is None:
        return error("Lab not found.", 404)
    data = request.get_json(silent=True) or {}
    try:
        score = int_field(data, "score", 0, 100) if "score" in data else 100
    except ValueError as exc:
        return error(str(exc))

    db = get_db()
    before = get_profile(db)["xp"]
    first_time = db.execute("SELECT 1 FROM lab_completion WHERE lab_id = ?", (lab_id,)).fetchone() is None
    if first_time:
        db.execute("INSERT INTO lab_completion (lab_id, score, xp_awarded, completed_at) VALUES (?, ?, ?, ?)",
                   (lab_id, score, lab["xp"], now_iso()))
        grant_xp(db, lab["xp"])
        log_activity(db, "lab", lab_id, f"Completed lab: {lab['title']}", lab["xp"])
    else:
        db.execute("UPDATE lab_completion SET score = MAX(COALESCE(score, 0), ?) WHERE lab_id = ?",
                   (score, lab_id))
        log_activity(db, "lab", lab_id, f"Replayed lab: {lab['title']}", 0)
    return finish(db, before, {"first_time": first_time})


@app.post("/api/quiz/result")
def api_quiz_result():
    data = request.get_json(silent=True) or {}
    key = data.get("quiz_key")
    challenge = content.CHALLENGES.get(key)
    if challenge is None:
        return error("Unknown challenge type.")
    try:
        total = int_field(data, "total", 1, content.MAX_QUESTIONS_PER_ATTEMPT)
        correct = int_field(data, "correct", 0, total)
    except ValueError as exc:
        return error(str(exc))
    difficulty = str(data.get("difficulty", ""))[:12] or None

    db = get_db()
    before = get_profile(db)["xp"]
    # XP is "best score so far": repeating a challenge never farms XP.
    earned_total = scalar(db, "SELECT COALESCE(SUM(xp_awarded), 0) FROM quiz_results WHERE quiz_key = ?", (key,))
    reward = max(0, correct * challenge["unit"] - earned_total)
    db.execute("INSERT INTO quiz_results (quiz_key, difficulty, correct, total, xp_awarded, created_at) "
               "VALUES (?, ?, ?, ?, ?, ?)", (key, difficulty, correct, total, reward, now_iso()))
    grant_xp(db, reward)
    log_activity(db, "quiz", key, f"{challenge['title']}: {correct}/{total}", reward)
    return finish(db, before, {"correct": correct, "total": total})


@app.post("/api/daily/complete")
def api_daily_complete():
    db = get_db()
    before = get_profile(db)["xp"]
    mission, row = todays_mission(db)
    if row["completed"]:
        return error("Today's mission is already complete. A new one arrives tomorrow.")
    if not mission_ready(db, mission):
        return error("Not yet: " + mission["desc"])
    db.execute("UPDATE daily_missions SET completed = 1, xp_awarded = ?, completed_at = ? "
               "WHERE mission_date = ?", (mission["xp"], now_iso(), today_str()))
    grant_xp(db, mission["xp"])
    log_activity(db, "mission", mission["code"], f"Daily mission: {mission['title']}", mission["xp"])
    return finish(db, before)


@app.get("/api/progress")
def api_progress():
    """Data for the Progress page charts."""
    db = get_db()
    state = full_state(db)
    by_category = {}
    for m in state["modules"]:
        c = by_category.setdefault(m["category"], {"done": 0, "total": 0})
        c["total"] += 1
        c["done"] += 1 if m["status"] == "completed" else 0
    # XP earned per day for the last 14 days
    xp_per_day = []
    for offset in range(13, -1, -1):
        day = (date.today() - timedelta(days=offset)).isoformat()
        xp_per_day.append({"date": day, "xp": scalar(
            db, "SELECT COALESCE(SUM(xp), 0) FROM activity WHERE created_at LIKE ?", (day + "%",))})
    quizzes = [dict(r) for r in db.execute(
        "SELECT quiz_key, correct, total, created_at FROM quiz_results ORDER BY id DESC LIMIT 12")]
    activity = [dict(r) for r in db.execute(
        "SELECT kind, ref, title, xp, created_at FROM activity ORDER BY id DESC LIMIT 30")]
    return jsonify({"ok": True, "state": state, "categories": by_category,
                    "xp_per_day": xp_per_day, "quizzes": quizzes, "activity": activity})


@app.get("/api/search")
def api_search():
    q = request.args.get("q", "").strip().lower()[:50]
    if len(q) < 2:
        return jsonify({"ok": True, "results": []})
    results = []
    for m in content.MODULES:
        if q in m["title"].lower() or q in m["summary"].lower() or q in m["category"].lower():
            results.append({"type": "Module", "title": m["title"], "url": f"/academy/{m['slug']}"})
    for lab in content.LABS:
        if q in lab["title"].lower() or q in lab["summary"].lower():
            results.append({"type": "Lab", "title": f"{lab['codename']}: {lab['title']}",
                            "url": f"/hacklab#{lab['id']}"})
    for key, ch in content.CHALLENGES.items():
        if q in ch["title"].lower():
            results.append({"type": "Challenge", "title": ch["title"], "url": f"/challenges#{key}"})
    for p in content.PAGES:
        if q in p["title"].lower() or q in p["summary"].lower():
            results.append({"type": "Page", "title": p["title"], "url": p["url"]})
    return jsonify({"ok": True, "results": results[:8]})


@app.post("/api/reset")
def api_reset():
    db = get_db()
    database.reset_progress(db)
    return jsonify({"ok": True, "state": full_state(db)})


if __name__ == "__main__":
    # 127.0.0.1 = only this computer can open the site. debug=True reloads
    # the server when you save a file (fine locally, never use it online).
    app.run(host="127.0.0.1", port=5000, debug=True)
