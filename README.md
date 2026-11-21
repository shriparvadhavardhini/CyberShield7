# CYBERSHIELD x HACKLAB  -  Learn. Exploit. Defend.

An interactive web application security learning platform.
Stack: HTML, CSS, vanilla JavaScript, Python Flask, SQLite. All labs are local simulations.

## Build status (delivered in parts)

| Part | Contents | Status |
|------|----------|--------|
| 1 | Backend (app.py, database.py, content.py), design system, app shell, landing page | DONE |
| 2 | Dashboard, Academy (12 lessons + quizzes), Achievements, Progress, About | DONE |
| 3 | HackLab: 6 labs + Surface Scan simulator | DONE |
| 4 | Challenge Zone (7 challenge sets, 22 questions) | DONE |

Pages that belong to later parts show a friendly "MODULE OFFLINE" message until they are added.

## Run on Windows (PowerShell or Command Prompt)

1. Install Python 3.10+ from python.org (tick "Add python.exe to PATH").
2. Open a terminal inside the `cybershield` folder.
3. Create a virtual environment and install Flask:

       python -m venv venv
       venv\Scripts\activate
       pip install -r requirements.txt

   (PowerShell blocked the activate script? Run once:
   `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`)
4. Start the server:

       python app.py

5. Open http://127.0.0.1:5000 in your browser. Stop the server with Ctrl+C.

The database file `instance/cybershield.db` is created automatically.
To start from zero, use Settings > Reset progress, or delete that file while the server is stopped.

## Test Part 1

- Landing page: the boot terminal types itself, counters animate when scrolled into view,
  the six vulnerability cards link to `/academy/<slug>`, the menu button appears on narrow screens.
- API health: open http://127.0.0.1:5000/api/health (should show `"status": "online"`).
- API state: open http://127.0.0.1:5000/api/state to see your profile, level and stats as JSON.
- Server-offline handling: stop the server, then click a button that needs it. A friendly error appears.

## How it fits together

    Browser (HTML/CSS/JS)  --fetch JSON-->  Flask routes (app.py)  --SQL-->  SQLite (instance/cybershield.db)

- `content.py`  fixed catalogue: levels, modules, labs, achievements, daily missions
- `database.py` tables, seeding and reset
- `app.py`      page routes + JSON API. The SERVER decides every XP amount
- `static/js/main.js` shared helpers (API calls, toasts, modals, search, settings)

## Database schema

profile, modules, module_progress, labs, lab_completion, quiz_results,
achievements, daily_missions, activity (see `database.py`).

## API routes

GET /api/health, /api/state, /api/progress, /api/modules, /api/modules/<slug>, /api/search?q=
POST /api/profile, /api/settings, /api/modules/<slug>/open, /api/modules/<slug>/complete,
/api/labs/<id>/complete, /api/quiz/result, /api/daily/complete, /api/reset

## Safety notes

Nothing here attacks, scans or contacts real systems. No passwords are stored; the profile is a nickname only.
Practice security testing only on systems you own or have written permission to test.
# CyberShield7
