"""lessons.py - Academy lesson text and quizzes (Part 2). Defensive, conceptual content only."""
def L(a, b, c, d, qs):
    return {"sections": [{"h": a, "p": b}, {"h": c, "p": d}],
            "quiz": [{"q": q, "options": o, "answer": i, "why": w} for q, o, i, w in qs]}

LESSONS = {
 "intro-web-security": L("How web apps work", "A browser sends requests, a server answers, and a database stores data. Every place where outside data enters is a possible weak point.",
  "The defender's mindset", "Never trust input, give every user the least access needed, and layer defences so one failure is not fatal.", [
  ("Which principle means giving users only the access they need?", ["Least privilege", "Obscurity", "Open access"], 0, "Least privilege limits damage when an account is abused."),
  ("Where should security checks be enforced?", ["Only in the browser", "On the server", "Nowhere"], 1, "Browser code can be changed by the user; the server is the trusted place."),
  ("Layering several defences is called:", ["Defence in depth", "Overengineering", "Caching"], 0, "If one layer fails, others still protect you.")]),
 "sql-injection": L("The problem", "SQL injection happens when user input is concatenated into a query, so data is treated as commands.",
  "The fix", "Use parameterized queries (placeholders), validate input, and give the database account minimal rights. Never build SQL with string formatting.", [
  ("Best defence against SQL injection?", ["Parameterized queries", "Hiding error pages only", "Longer passwords"], 0, "Placeholders keep data separate from the query."),
  ("Why is string concatenation in queries risky?", ["It is slow", "Input can change query logic", "It uses memory"], 1, "Input becomes part of the command."),
  ("Which database account is safest for a web app?", ["Admin", "Minimal-privilege", "Shared root"], 1, "Limits what a flaw can do.")]),
 "xss": L("The problem", "Cross-site scripting occurs when untrusted text is rendered as live HTML or script in another user's browser.",
  "The fix", "Escape output for its context, prefer textContent over innerHTML, and add a Content-Security-Policy as a second layer.", [
  ("Safest way to show user text in the DOM?", ["innerHTML", "textContent", "eval"], 1, "textContent never parses HTML."),
  ("A Content-Security-Policy is:", ["A primary fix only", "An extra layer", "A password rule"], 1, "It limits damage if escaping is missed."),
  ("XSS runs in whose browser?", ["The attacker's", "The victim's", "The server's"], 1, "The malicious script executes for the visitor.")]),
 "csrf": L("The problem", "CSRF tricks a logged-in browser into sending a state-changing request the user never intended, because cookies are attached automatically.",
  "The fix", "Use anti-CSRF tokens, SameSite cookies, and require re-authentication for sensitive actions.", [
  ("Which cookie attribute helps against CSRF?", ["SameSite", "Path", "Domain"], 0, "SameSite limits cross-site cookie sending."),
  ("Why do CSRF attacks work?", ["Browsers attach cookies automatically", "Passwords are weak", "TLS is off"], 0, "The request looks authenticated."),
  ("A CSRF token proves:", ["The request came from our page", "The user is an admin", "The data is encrypted"], 0, "An outside site cannot know the token.")]),
 "auth-sessions": L("Authentication", "Authentication proves identity; a session keeps that proof between requests. Both must resist guessing and theft.",
  "Session safety", "Use random session IDs, HttpOnly and Secure cookies, expiry, regeneration after login, and rate limiting on login attempts.", [
  ("HttpOnly cookies are hidden from:", ["The server", "JavaScript", "The network"], 1, "This reduces theft through XSS."),
  ("When should a session ID change?", ["After login", "Never", "Every click"], 0, "Prevents session fixation."),
  ("Rate limiting login helps stop:", ["Brute force", "Typos", "Caching"], 0, "It slows repeated guessing.")]),
 "access-control": L("The problem", "Broken access control means users can reach data or actions beyond their role, such as changing an ID in a URL to see someone else's record.",
  "The fix", "Deny by default and check ownership and role on the server for every request. Hiding a button is not protection.", [
  ("Hiding an admin button is:", ["Enough", "Not real protection", "Required"], 1, "Requests can still be sent directly."),
  ("Default access policy should be:", ["Allow", "Deny", "Random"], 1, "Deny by default, then grant."),
  ("Where are permissions enforced?", ["Server on every request", "Browser", "CSS"], 0, "Only the server is trusted.")]),
 "password-security": L("Storing passwords", "Never store plain passwords. Store a salted hash made with a slow algorithm such as bcrypt, scrypt or Argon2.",
  "Using passwords", "Long unique passphrases plus a password manager and multi-factor authentication beat complexity rules.", [
  ("Passwords should be stored as:", ["Plain text", "Salted slow hashes", "Base64"], 1, "Hashes cannot be simply reversed."),
  ("A salt prevents:", ["Identical hashes for identical passwords", "Typos", "Logout"], 0, "Each hash is unique."),
  ("Best extra protection for an account?", ["MFA", "Shorter password", "Reuse"], 0, "A stolen password alone is not enough.")]),
 "https-tls": L("Encryption in transit", "HTTPS uses TLS to encrypt traffic and verify the server with a certificate, stopping eavesdropping and tampering.",
  "Doing it right", "Redirect HTTP to HTTPS, enable HSTS, renew certificates, and mark cookies Secure.", [
  ("TLS provides:", ["Encryption and server identity", "Faster pages only", "Input validation"], 0, "Confidentiality plus authentication."),
  ("HSTS tells browsers to:", ["Always use HTTPS", "Clear cookies", "Block ads"], 0, "It prevents downgrade to HTTP."),
  ("The Secure cookie flag means:", ["Sent over HTTPS only", "Hidden from JS", "Never expires"], 0, "It stops cookies travelling in plain text.")]),
 "security-headers": L("Why headers", "Response headers instruct the browser to enforce protections such as framing limits and script restrictions.",
  "Key headers", "Content-Security-Policy, X-Content-Type-Options, X-Frame-Options or frame-ancestors, Referrer-Policy and Strict-Transport-Security.", [
  ("Which header restricts where scripts load from?", ["Content-Security-Policy", "Accept", "ETag"], 0, "CSP controls allowed sources."),
  ("Clickjacking is reduced by:", ["frame-ancestors / X-Frame-Options", "Gzip", "Cache-Control"], 0, "They stop hostile framing."),
  ("nosniff stops browsers from:", ["Guessing content types", "Using HTTPS", "Saving cookies"], 0, "Prevents MIME confusion.")]),
 "file-upload": L("The risk", "Uploaded files can carry scripts or be disguised. Trusting filename or declared type is unsafe.",
  "Safe handling", "Allow-list extensions, check real content, limit size, rename files, store outside the web root and never execute uploads.", [
  ("Safer upload policy?", ["Allow-list types", "Block a few types", "Accept all"], 0, "Allow-lists are stricter."),
  ("Should you keep the user's filename?", ["Yes", "No, generate your own", "Only .exe"], 1, "Prevents path tricks and collisions."),
  ("Uploads should be stored:", ["Outside the web root", "In /admin", "In the URL"], 0, "So they cannot be executed.")]),
 "phishing": L("Recognising it", "Phishing tricks people with urgency, fear or rewards. Look at the real sender, mismatched links and unexpected requests.",
  "Responding", "Do not click or open attachments; go to the site yourself, report the message, and use MFA so stolen passwords are less useful.", [
  ("A common phishing sign is:", ["Urgent threats", "Correct grammar", "Known sender and context"], 0, "Pressure is a manipulation tactic."),
  ("Safest response to a suspicious bank email?", ["Click link", "Open the bank site yourself", "Reply with details"], 1, "Avoid the message's links."),
  ("Which limits damage from stolen passwords?", ["MFA", "Bookmarks", "Dark mode"], 0, "A second factor blocks reuse.")]),
 "secure-coding": L("Core habits", "Validate input, encode output, use safe libraries, handle errors without leaking details, and keep secrets out of code.",
  "Process", "Review code, update dependencies, test security cases, and log events without logging secrets.", [
  ("Secrets such as API keys belong in:", ["Source code", "Environment or secret store", "HTML"], 1, "Code gets shared and leaked."),
  ("Error messages to users should:", ["Show stack traces", "Be generic", "Include SQL"], 1, "Details help attackers."),
  ("Outdated dependencies are risky because:", ["They have known flaws", "They are small", "They are free"], 0, "Public bugs get exploited.")]),
}
