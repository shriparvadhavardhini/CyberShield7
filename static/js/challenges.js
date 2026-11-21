/* challenges.js - Challenge Zone. XP amounts are decided by the server. */
(function () {
  "use strict";
  const { api, h, toast, reward, onState } = window.CS;
  const root = document.getElementById("view");
  const SQ = "query = \"SELECT * FROM users WHERE id=\" + request.args['id']";
  const B = {
    quiz_easy: [["What does HTTPS add to HTTP?", ["Encryption", "Colours", "Speed only"], 0], ["A strong password is mostly:", ["Long and unique", "A pet's name", "Short with one symbol"], 0], ["Safest place to enforce permissions?", ["Server", "Button colour", "URL text"], 0], ["MFA means:", ["Two or more proofs of identity", "Many files", "Mixed fonts"], 0]],
    quiz_medium: [["SameSite cookies mainly help against:", ["CSRF", "SQL injection", "Weak hashing"], 0], ["Why salt password hashes?", ["Make identical passwords hash differently", "Shrink the hash", "Skip hashing"], 0], ["Which is output encoding?", ["Turning < into &lt;", "Deleting the field", "Hiding the form"], 0], ["HSTS does what?", ["Forces browsers to use HTTPS", "Blocks images", "Encrypts the DB"], 0]],
    quiz_hard: [["Session fixation is prevented by:", ["Issuing a new session ID after login", "Longer usernames", "Hiding cookies in HTML"], 0], ["Most robust upload check combines:", ["Allow-list, content check, safe storage", "Trusting the filename", "Client-side check only"], 0], ["A CSP with 'unsafe-inline' for scripts:", ["Weakens XSS protection", "Strengthens it", "Is required"], 0]],
    spot: [["Which line is the SQL injection risk?  " + SQ, ["The concatenated query", "The variable name", "Nothing"], 0], ["A page does el.innerHTML = comment. The flaw is:", ["XSS", "CSRF", "Weak TLS"], 0], ["/invoice?id=7 shows any id to any user. The flaw is:", ["Broken access control", "Missing HTTPS", "Weak font"], 0]],
    code_review: [["db.execute(\"SELECT * FROM t WHERE n='%s'\" % name)\nHow to fix?", ["Use a parameterized query", "Strip spaces", "Rename the table"], 0], ["API_KEY = 'sk-live-123' in source control.\nBest fix?", ["Move to environment/secret store and rotate it", "Rename variable", "Comment it out"], 0], ["hashlib.md5(password).hexdigest() stored.\nBest fix?", ["Use bcrypt/Argon2 with salt", "Use md5 twice", "Base64 it"], 0]],
    rapid: [["Email demands action in 10 minutes and a login link. First step?", ["Do not click; report it", "Click quickly", "Forward to all"], 0], ["Login page gets 500 guesses a minute. Add:", ["Rate limiting / lockout", "Bigger logo", "More cookies"], 0], ["Leaked admin key found. First step?", ["Revoke and rotate it", "Wait", "Tell no one"], 0]],
    case: [["Case: a shop's order page lets customers change the order number in the URL and see strangers' orders. Root cause?", ["Missing ownership check on the server", "Slow database", "Old browser"], 0], ["Case: a forum shows member posts with raw HTML and visitors' sessions get stolen. Best fix?", ["Encode output and add CSP, HttpOnly cookies", "Ban long posts", "Hide the forum"], 0]],
  };
  function run(key, ch, box, redraw) {
    const qs = B[key], ans = []; let i = 0;
    const next = () => {
      if (i >= qs.length) return finish();
      const [q, o, a] = qs[i]; const opts = o.map((t, j) => ({ t, j }));
      box.replaceChildren(h("div", { class: "label", text: `Question ${i + 1}/${qs.length}` }), h("pre", { class: "terminal-body", style: "white-space:pre-wrap;min-height:0", text: q }),
        ...opts.map(({ t, j }) => h("button", { class: "opt", text: t, onclick: (e) => { ans.push(j === a); e.target.classList.add(j === a ? "good" : "bad"); box.querySelectorAll(".opt").forEach((b) => (b.disabled = true)); setTimeout(() => { i++; next(); }, 700); } })));
    };
    async function finish() {
      const correct = ans.filter(Boolean).length;
      try { const res = await api("/api/quiz/result", { method: "POST", body: { quiz_key: key, correct, total: qs.length } }); reward(res); }
      catch (e) { toast(e.message, "error"); }
      box.replaceChildren(h("h3", { text: `Result: ${correct}/${qs.length}` }), h("p", { class: "muted", text: "XP counts best score only, so replays cannot farm XP." }), h("button", { class: "btn btn-sm", onclick: redraw }, "Back"));
    }
    next();
  }
  function build(s) {
    const box = h("div", { class: "panel" });
    const menu = () => box.replaceChildren(h("div", { class: "grid cards" }, s.challenges.map((c) => h("div", { class: "panel", id: c.key }, h("h3", { text: c.title }), h("p", { class: "muted", text: `${B[c.key].length} questions · ${c.unit} XP per correct answer` }),
      h("button", { class: "btn btn-sm", onclick: () => run(c.key, c, box, menu) }, "Start")))));
    root.replaceChildren(h("div", { class: "page-head" }, h("h1", { text: "Challenge Zone" }), h("p", { text: "Quizzes, code review, rapid response and case files." })), box); menu();
  }
  let drawn = false; onState((s) => { if (!drawn) { drawn = true; build(s); } });
})();
