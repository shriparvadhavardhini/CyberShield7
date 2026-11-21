"""
content.py  -  The fixed "catalogue" of CyberShield.

Everything that never changes while the app runs lives here: levels,
modules, labs, challenge types, achievements and daily missions.
The server is the single source of truth for XP values, so a user
cannot invent XP by editing JavaScript in the browser.
"""

# (name, XP needed to reach it)
LEVELS = [
    ("ROOKIE", 0),
    ("ANALYST", 500),
    ("DEFENDER", 1500),
    ("GUARDIAN", 3000),
    ("ELITE", 5000),
]

PASS_PERCENT = 60          # minimum quiz score to complete a module
ACHIEVEMENT_XP = 25        # bonus XP for every new badge

# severity is only used for the vulnerability cards on the landing page
MODULES = [
    {"slug": "intro-web-security", "title": "Introduction to Web Application Security",
     "category": "Foundations", "difficulty": "Beginner", "minutes": 15, "xp": 60,
     "severity": "INFO",
     "summary": "How web apps work, where they break, and the mindset of a defender."},
    {"slug": "sql-injection", "title": "SQL Injection",
     "category": "Injection", "difficulty": "Beginner", "minutes": 25, "xp": 80,
     "severity": "CRITICAL",
     "summary": "What happens when user input is glued into a database query."},
    {"slug": "xss", "title": "Cross-Site Scripting (XSS)",
     "category": "Client-side", "difficulty": "Intermediate", "minutes": 25, "xp": 80,
     "severity": "HIGH",
     "summary": "Why untrusted text must never be rendered as live HTML."},
    {"slug": "csrf", "title": "Cross-Site Request Forgery (CSRF)",
     "category": "Client-side", "difficulty": "Intermediate", "minutes": 20, "xp": 80,
     "severity": "HIGH",
     "summary": "How a browser can be tricked into sending actions you never intended."},
    {"slug": "auth-sessions", "title": "Authentication & Session Security",
     "category": "Authentication", "difficulty": "Intermediate", "minutes": 25, "xp": 80,
     "severity": "HIGH",
     "summary": "Proving who you are, and keeping that proof safe after login."},
    {"slug": "access-control", "title": "Broken Access Control",
     "category": "Access Control", "difficulty": "Intermediate", "minutes": 25, "xp": 90,
     "severity": "CRITICAL",
     "summary": "Why hiding a button is not the same as blocking an action."},
    {"slug": "password-security", "title": "Password Security",
     "category": "Authentication", "difficulty": "Beginner", "minutes": 20, "xp": 70,
     "severity": "MEDIUM",
     "summary": "Strong passwords, hashing, salting and multi-factor authentication."},
    {"slug": "https-tls", "title": "HTTPS & TLS",
     "category": "Transport", "difficulty": "Beginner", "minutes": 20, "xp": 70,
     "severity": "MEDIUM",
     "summary": "How encryption in transit protects data between browser and server."},
    {"slug": "security-headers", "title": "Security Headers",
     "category": "Configuration", "difficulty": "Intermediate", "minutes": 20, "xp": 70,
     "severity": "MEDIUM",
     "summary": "Response headers that tell the browser how to behave safely."},
    {"slug": "file-upload", "title": "File Upload Security",
     "category": "Injection", "difficulty": "Intermediate", "minutes": 20, "xp": 70,
     "severity": "HIGH",
     "summary": "Accepting files without accepting trouble."},
    {"slug": "phishing", "title": "Phishing & Social Engineering",
     "category": "Human Factor", "difficulty": "Beginner", "minutes": 20, "xp": 70,
     "severity": "HIGH",
     "summary": "Spotting messages that try to trick people instead of systems."},
    {"slug": "secure-coding", "title": "Secure Coding Practices",
     "category": "Foundations", "difficulty": "Advanced", "minutes": 25, "xp": 90,
     "severity": "INFO",
     "summary": "Habits that prevent whole classes of bugs before they exist."},
]

LABS = [
    {"id": "sqli", "codename": "LAB 01", "title": "AUTHENTICATION BREACH",
     "difficulty": "Beginner", "xp": 100, "module": "sql-injection",
     "summary": "SecureBank login simulator: unsafe vs parameterized queries."},
    {"id": "xss", "codename": "LAB 02", "title": "INJECTION POINT",
     "difficulty": "Intermediate", "xp": 150, "module": "xss",
     "summary": "A simulated comment system: unsafe HTML rendering vs safe text."},
    {"id": "phishing", "codename": "LAB 03", "title": "OPERATION: PHANTOM MAIL",
     "difficulty": "Beginner", "xp": 100, "module": "phishing",
     "summary": "Inspect a fictional inbox and flag the phishing indicators."},
    {"id": "password", "codename": "LAB 04", "title": "KEYBREAKER",
     "difficulty": "Beginner", "xp": 100, "module": "password-security",
     "summary": "Strength meter, entropy, hashing and MFA, all in your browser."},
    {"id": "access", "codename": "LAB 05", "title": "PRIVILEGE ESCALATION: SIMULATION",
     "difficulty": "Advanced", "xp": 200, "module": "access-control",
     "summary": "Roles, permissions and why the server must enforce them."},
    {"id": "headers", "codename": "LAB 06", "title": "SHIELD PROTOCOL",
     "difficulty": "Intermediate", "xp": 150, "module": "security-headers",
     "summary": "Toggle simulated response headers and watch the rating change."},
]

# XP per correct answer. quiz_key -> (label, xp_per_correct, page section)
CHALLENGES = {
    "quiz_easy":   {"title": "Security Quiz (Easy)",   "unit": 10},
    "quiz_medium": {"title": "Security Quiz (Medium)", "unit": 15},
    "quiz_hard":   {"title": "Security Quiz (Hard)",   "unit": 20},
    "spot":        {"title": "Spot the Vulnerability", "unit": 15},
    "code_review": {"title": "Code Review",            "unit": 20},
    "rapid":       {"title": "Rapid Response",         "unit": 10},
    "case":        {"title": "Case Files",             "unit": 25},
}
MAX_QUESTIONS_PER_ATTEMPT = 30

ACHIEVEMENTS = [
    {"code": "first_access", "name": "FIRST ACCESS", "desc": "Complete your first module."},
    {"code": "bug_hunter", "name": "BUG HUNTER", "desc": "Complete 3 labs."},
    {"code": "secure_mind", "name": "SECURE MIND", "desc": "Finish 5 learning modules."},
    {"code": "phantom_detective", "name": "PHANTOM DETECTIVE", "desc": "Complete the phishing mission."},
    {"code": "code_sentinel", "name": "CODE SENTINEL", "desc": "Pass the Code Review challenge."},
    {"code": "iron_wall", "name": "IRON WALL", "desc": "Complete every HackLab lab."},
    {"code": "night_owl", "name": "NIGHT OWL", "desc": "Complete 5 daily missions."},
    {"code": "cyber_guardian", "name": "CYBER GUARDIAN", "desc": "Complete the entire learning path."},
]

# check types are verified on the server against real activity done today
DAILY_MISSIONS = [
    {"code": "answer5", "title": "Answer 5 security questions",
     "desc": "Finish any quiz or challenge today so that at least 5 questions are answered.",
     "xp": 50, "check": "questions"},
    {"code": "auth_lesson", "title": "Complete one authentication lesson",
     "desc": "Complete or review the Authentication & Sessions or Password Security module.",
     "xp": 60, "check": "module_refs", "refs": ["auth-sessions", "password-security"]},
    {"code": "phish_indicators", "title": "Identify phishing indicators",
     "desc": "Finish the Phantom Mail lab (a replay counts).",
     "xp": 50, "check": "lab_refs", "refs": ["phishing"]},
    {"code": "code_issue", "title": "Find a security issue in code",
     "desc": "Finish the Code Review or Spot the Vulnerability challenge.",
     "xp": 50, "check": "quiz_keys", "refs": ["code_review", "spot"]},
    {"code": "run_lab", "title": "Run a HackLab simulation",
     "desc": "Finish any HackLab lab today (a replay counts).",
     "xp": 40, "check": "lab_refs", "refs": None},
    {"code": "study", "title": "Study an Academy module",
     "desc": "Complete or review any module today.",
     "xp": 40, "check": "module_refs", "refs": None},
]

# Pages and sections the search box can jump to
PAGES = [
    {"title": "Dashboard", "url": "/dashboard", "summary": "Your command center"},
    {"title": "Security Academy", "url": "/academy", "summary": "Lessons and quizzes"},
    {"title": "HackLab", "url": "/hacklab", "summary": "Interactive simulations"},
    {"title": "Surface Scan Simulator", "url": "/hacklab#scan", "summary": "Fictional scan report"},
    {"title": "Challenge Zone", "url": "/challenges", "summary": "Quizzes, code review, case files"},
    {"title": "Achievements", "url": "/achievements", "summary": "Badges and levels"},
    {"title": "Progress", "url": "/progress", "summary": "Analytics and charts"},
    {"title": "About", "url": "/about", "summary": "About this project"},
]

DEFAULT_SETTINGS = {"scanlines": True, "particles": True, "reduce_motion": False}
