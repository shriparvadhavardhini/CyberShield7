/* hacklab.js - six local simulations + a fictional surface scan. Nothing touches a network. */
(function () {
  "use strict";
  const { api, h, toast, reward, onState } = window.CS;
  const root = document.getElementById("view");
  const out = (t, c) => h("div", { class: "terminal-body " + (c || ""), text: t, style: "min-height:0;margin-top:.6rem" });
  const sel = (opts, fn) => { const s = h("select", { onchange: () => fn(s.value) }, opts.map(([v, t]) => h("option", { value: v, text: t }))); return s; };
  const seen = {};
  const need = (lab, flag, goal, done) => { seen[lab] = seen[lab] || new Set(); seen[lab].add(flag); if (goal.every((g) => seen[lab].has(g))) done(); };

  const LABS = {
    sqli(box, done) {
      let safe = false; const u = h("input", { type: "text", value: "alice", "aria-label": "Username" }), p = h("input", { type: "text", value: "wrong", "aria-label": "Password" }), res = h("div");
      const run = () => {
        const bad = /'\s*or\s*'?1'?\s*=\s*'?1/i.test(u.value + p.value) || /--/.test(u.value);
        const q = safe ? "SELECT * FROM users WHERE name = ? AND pass_hash = ?  [values sent separately]" : `SELECT * FROM users WHERE name='${u.value}' AND pass='${p.value}'`;
        const ok = !safe && bad;
        res.replaceChildren(out("Query built: " + q, "t-info"), out(ok ? "SIMULATED RESULT: login logic altered by the input. This is the flaw." : safe && bad ? "SIMULATED RESULT: input treated as plain data. Login rejected. Defence works." : "SIMULATED RESULT: login rejected (wrong credentials).", ok ? "t-err" : "t-ok"));
        if (ok) need("sqli", "broke", ["broke", "fixed"], done); if (safe && bad) need("sqli", "fixed", ["broke", "fixed"], done);
      };
      box.append(h("p", { class: "muted", text: "Try typing a quote-based trick such as ' OR '1'='1 in the username with the unsafe query, then switch to parameterized." }),
        h("div", { class: "field" }, h("label", { text: "Username" }), u), h("div", { class: "field" }, h("label", { text: "Password" }), p),
        h("div", { class: "row" }, sel([["u", "Unsafe: string concatenation"], ["s", "Safe: parameterized"]], (v) => { safe = v === "s"; }), h("button", { class: "btn btn-sm", onclick: run }, "Simulate login")), res);
    },
    xss(box, done) {
      let safe = false; const t = h("textarea", { "aria-label": "Comment" }); t.value = "Nice post! <script>alert(1)</script>"; const res = h("div");
      const run = () => {
        const tag = /<\s*(script|img|svg|iframe)[^>]*>/i.test(t.value);
        res.replaceChildren(h("div", { class: "panel" }, h("div", { class: "label", text: "Rendered comment (always shown as safe text here)" }), h("div", { text: t.value })),
          out(safe ? "Output encoded: < and > become &lt; and &gt;, so the browser shows text, never runs it." : tag ? "SIMULATED: the browser would parse this as live HTML/script and run it for every visitor. That is the flaw." : "No markup found; both modes look the same.", tag && !safe ? "t-err" : "t-ok"));
        if (tag) need("xss", safe ? "fixed" : "broke", ["broke", "fixed"], done);
      };
      box.append(h("div", { class: "field" }, h("label", { text: "Comment" }), t), h("div", { class: "row" }, sel([["u", "Unsafe: render as HTML"], ["s", "Safe: encode output"]], (v) => { safe = v === "s"; }), h("button", { class: "btn btn-sm", onclick: run }, "Post comment")), res);
    },
    phishing(box, done) {
      const mails = [
        ["IT-Support <helpdesk@c0mpany-security.biz>", "URGENT: password expires in 1 hour", "Click http://login.c0mpany-verify.biz now or lose access.", true],
        ["HR <hr@yourcompany.example>", "Team lunch Friday", "Menu attached in the shared calendar invite. Reply if you have allergies.", false],
        ["Bank Alert <alert@secure-bank.example.ru>", "Unusual sign-in. Confirm your PIN", "Reply with your PIN and card number to avoid suspension.", true],
        ["Manager <manager@yourcompany.example>", "Weekly report", "Please review the report on the intranet when you have time.", false]];
      const ans = new Array(mails.length).fill(null), res = h("div");
      box.append(...mails.map((m, i) => h("div", { class: "panel", style: "margin:.6rem 0" }, h("div", { class: "label", text: "From: " + m[0] }), h("h3", { text: m[1] }), h("p", { text: m[2] }),
        h("div", { class: "row" }, [["Phishing", true], ["Legitimate", false]].map(([l, v]) => h("button", { class: "btn btn-sm btn-ghost", onclick: (e) => { ans[i] = v; e.target.parentNode.querySelectorAll("button").forEach((b) => b.classList.add("btn-ghost")); e.target.classList.remove("btn-ghost"); } }, l))))),
        h("button", { class: "btn", onclick: () => { const c = ans.filter((a, i) => a === mails[i][3]).length; res.replaceChildren(out(`Score ${c}/${mails.length}. Clues: look-alike domains, urgency, requests for secrets.`, c === 4 ? "t-ok" : "t-warn")); if (c >= 3) done(Math.round(c / 4 * 100)); } }, "Submit verdicts"), res);
    },
    password(box, done) {
      const i = h("input", { type: "text", "aria-label": "Test password", autocomplete: "off" }), r = h("div"); let hit = false;
      i.addEventListener("input", () => {
        const v = i.value; let pool = 0; if (/[a-z]/.test(v)) pool += 26; if (/[A-Z]/.test(v)) pool += 26; if (/\d/.test(v)) pool += 10; if (/[^A-Za-z0-9]/.test(v)) pool += 32;
        const bits = Math.round(v.length * Math.log2(pool || 1)); const lbl = bits < 40 ? "WEAK" : bits < 60 ? "FAIR" : "STRONG";
        r.replaceChildren(out(`Estimated entropy: ${bits} bits (${lbl}). Real systems store only a salted slow hash, never this text. Add MFA on top.`, bits >= 60 ? "t-ok" : "t-warn"));
        if (bits >= 60 && !hit) { hit = true; done(); } });
      box.append(h("p", { class: "muted", text: "Type a test password (nothing is sent or saved). Reach 60+ bits, e.g. a long passphrase." }), h("div", { class: "field" }, h("label", { text: "Test password" }), i), r);
    },
    access(box, done) {
      let enforce = false, role = "user"; const res = h("div");
      const acts = [["View own profile", "user"], ["View all users", "admin"], ["Delete a user", "admin"]];
      box.append(h("div", { class: "row" }, sel([["user", "Role: user"], ["admin", "Role: admin"]], (v) => { role = v; }), sel([["n", "Server check: OFF (UI hiding only)"], ["y", "Server check: ON"]], (v) => { enforce = v === "y"; })),
        ...acts.map(([a, need_]) => h("button", { class: "btn btn-sm btn-ghost", style: "margin:.4rem .4rem 0 0", onclick: () => {
          const allowed = role === need_ || role === "admin"; const blocked = enforce && !allowed;
          res.replaceChildren(out(blocked ? `403 FORBIDDEN: server refused "${a}" for ${role}.` : !allowed ? `SIMULATED FLAW: "${a}" succeeded for a ${role} because only the button was hidden.` : `200 OK: "${a}" allowed.`, blocked ? "t-ok" : !allowed ? "t-err" : "t-info"));
          if (!allowed) need("access", enforce ? "fixed" : "broke", ["broke", "fixed"], done); } }, a)), res);
    },
    headers(box, done) {
      const H = ["Content-Security-Policy", "Strict-Transport-Security", "X-Content-Type-Options: nosniff", "Referrer-Policy", "frame-ancestors / X-Frame-Options"], on = new Set(), r = h("div");
      const draw = () => { const n = on.size, g = ["F", "D", "C", "B", "A-", "A+"][n]; r.replaceChildren(out(`Simulated rating: ${g}  (${n}/5 headers enabled)`, n === 5 ? "t-ok" : "t-warn")); if (n === 5) done(); };
      box.append(...H.map((x) => { const c = h("input", { type: "checkbox", id: "hd-" + x, onchange: () => { c.checked ? on.add(x) : on.delete(x); draw(); } }); return h("label", { class: "switch", for: "hd-" + x }, h("span", { class: "text", text: x }), c, h("span", { class: "track" })); }), r); draw();
    },
  };

  function build(s) {
    const cards = s.labs.map((lab) => {
      const box = h("div", { hidden: true, style: "margin-top:1rem" });
      const done = async (score) => { try { reward(await api(`/api/labs/${lab.id}/complete`, { method: "POST", body: { score: score || 100 } })); } catch (e) { toast(e.message, "error"); } };
      let started = false;
      const btn = h("button", { class: "btn btn-sm", onclick: () => { box.hidden = !box.hidden; if (!started) { started = true; LABS[lab.id](box, done); } } }, lab.completed ? "Replay" : "Launch");
      return h("div", { class: "panel", id: lab.id }, h("div", { class: "row" }, h("span", { class: "label", text: lab.codename }), h("span", { class: "badge " + (lab.completed ? "badge-green" : "badge-muted"), text: lab.completed ? "COMPLETE" : lab.xp + " XP" })),
        h("h3", { text: lab.title }), h("p", { class: "muted", text: lab.summary }), btn, h("a", { class: "btn btn-sm btn-ghost", href: "/academy/" + lab.module, style: "margin-left:.5rem" }, "Lesson"), box);
    });
    const scan = h("div", { class: "panel", id: "scan", style: "margin-top:1.5rem" }, h("div", { class: "panel-title", text: "Surface Scan Simulator (fictional target)" }),
      h("button", { class: "btn btn-sm btn-cyan", onclick: (e) => { const t = scan.querySelector(".t"); const L = ["[sim] target: demo.invalid (fictional, no network used)", "[sim] HIGH   missing Content-Security-Policy", "[sim] MEDIUM cookie without Secure flag", "[sim] MEDIUM HTTP not redirected to HTTPS", "[sim] LOW    server version disclosed in headers", "[sim] Fixes: add headers, set cookie flags, redirect to HTTPS, hide banner."]; t.textContent = ""; L.forEach((l, i) => setTimeout(() => { t.textContent += l + "\n"; }, i * 400)); } }, "Run simulated scan"),
      h("div", { class: "terminal-body t", style: "margin-top:.6rem", "aria-live": "polite" }));
    root.replaceChildren(h("div", { class: "page-head" }, h("h1", { text: "HackLab" }), h("p", { text: "Local simulations. No real systems are ever contacted." })), h("div", { class: "grid cards" }, cards), scan);
    if (location.hash) { const el = document.getElementById(location.hash.slice(1)); if (el) el.scrollIntoView(); }
  }
  let drawn = false; onState((s) => { if (!drawn) { drawn = true; build(s); } });
})();
