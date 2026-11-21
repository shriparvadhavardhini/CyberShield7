/* pages.js - Dashboard, Academy, Lesson, Achievements, Progress, About */
(function () {
  "use strict";
  const { api, h, toast, reward, onState, animateBars, fmtDate, loader, showError } = window.CS;
  const root = document.getElementById("view");
  const view = root.dataset.view;
  // replaceChildren() only accepts single nodes. Arrays (from .map()) and null would be
  // printed as text like "[object HTMLDivElement]" or "null", so flatten and drop empties first.
  const show = (...items) => root.replaceChildren(...items.flat(Infinity).filter((x) => x !== null && x !== undefined && x !== false));
  const bar = (p) => h("div", { class: "progress" }, h("span", { "data-progress": p }));
  const head = (t, s) => h("div", { class: "page-head" }, h("h1", { text: t }), h("p", { text: s }));
  const stat = (l, v) => h("div", { class: "panel" }, h("div", { class: "label", text: l }), h("div", { class: "stat", text: v }));
  const sev = (d) => ({ Beginner: "badge-success", Intermediate: "badge-warning", Advanced: "badge-danger" }[d] || "badge-muted");
  const modCard = (m) => h("a", { class: "panel mod-card", href: "/academy/" + m.slug, style: "color:inherit;text-decoration:none" },
    h("div", { class: "row" }, h("span", { class: "badge " + sev(m.difficulty), text: m.difficulty }), h("span", { class: "label", text: `${m.minutes} min · ${m.xp} XP` })),
    h("h3", { text: m.title }), h("p", { class: "muted", text: m.summary }),
    h("span", { class: "badge " + (m.status === "completed" ? "badge-green" : "badge-muted"), text: m.status.replace("_", " ") }));

  function dashboard(s) {
    const d = s.daily, st = s.stats;
    const claim = h("button", { class: "btn btn-sm", disabled: d.completed || !d.ready, onclick: async () => {
      try { reward(await api("/api/daily/complete", { method: "POST", body: {} })); } catch (e) { toast(e.message, "error"); } } }, d.completed ? "Done" : "Claim reward");
    show(head(`Welcome, ${s.profile.nickname || "Operative"}`, `Rank ${s.level.name} · ${s.profile.xp} XP`),
      h("div", { class: "grid cards" }, stat("XP", st.xp), stat("Streak (days)", st.streak), stat("Modules", `${st.modules_done}/${st.modules_total}`),
        stat("Labs", `${st.labs_done}/${st.labs_total}`), stat("Quiz average", st.quiz_avg === null ? "-" : st.quiz_avg + "%"), stat("Completion", st.completion + "%")),
      h("div", { class: "panel", style: "margin-top:1.5rem" }, h("div", { class: "panel-title", text: "Next rank" }), bar(s.level.percent),
        h("p", { class: "muted", text: s.level.next_name ? `${s.level.xp_to_next} XP to ${s.level.next_name}` : "Max level reached" })),
      h("div", { class: "panel", style: "margin-top:1.5rem" }, h("div", { class: "panel-title", text: "Daily mission" }), h("h3", { text: d.title }),
        h("p", { class: "muted", text: `${d.desc} (+${d.xp} XP)` }), claim),
      s.continue ? h("p", { style: "margin-top:1.5rem" }, h("a", { class: "btn", href: "/academy/" + s.continue.slug }, "Continue: " + s.continue.title)) : null,
      h("div", { class: "panel", style: "margin-top:1.5rem" }, h("div", { class: "panel-title", text: "Recent activity" }),
        s.recent.length ? h("ul", { class: "activity-list" }, s.recent.map((r) => h("li", {}, h("div", {}, r.title, h("time", { text: fmtDate(r.created_at) })), r.xp ? h("span", { class: "badge badge-green", text: "+" + r.xp }) : null)))
          : h("p", { class: "muted", text: "Nothing yet. Start a module in the Academy." })));
    animateBars(root);
  }

  function academy(s) {
    const cats = [...new Set(s.modules.map((m) => m.category))];
    const grid = h("div", { class: "grid cards" });
    const draw = (cat) => grid.replaceChildren(...s.modules.filter((m) => !cat || m.category === cat).map(modCard));
    const sel = h("select", { id: "cat", "aria-label": "Filter by category", onchange: (e) => draw(e.target.value) }, h("option", { value: "", text: "All categories" }), cats.map((c) => h("option", { value: c, text: c })));
    show(head("Security Academy", "12 lessons. Pass each quiz (60%+) to earn XP."), h("div", { class: "field", style: "max-width:300px" }, sel), grid);
    draw("");
  }

  async function lesson() {
    show(loader());
    const slug = root.dataset.slug;
    let data;
    try { data = await api("/api/modules/" + slug); api("/api/modules/" + slug + "/open", { method: "POST", body: {} }).catch(() => {}); }
    catch (e) { return showError(root, e.message); }
    const m = data.module, les = data.lesson;
    if (!les) return show(head(m.title, m.summary), h("div", { class: "state-box", text: "Lesson text is not available yet." }));
    const qs = Array.isArray(les.quiz) ? les.quiz : [];
    if (!qs.length) {
      return show(head(m.title, m.summary),
        les.sections.map((x) => h("div", { class: "panel", style: "margin-bottom:1rem" }, h("h3", { text: x.h }), h("p", { text: x.p }))),
        h("div", { class: "state-box", text: "Quiz is unavailable for this lesson." }));
    }
    const answers = new Array(qs.length).fill(null);
    const result = h("div", { class: "field-error" });
    const quiz = qs.map((q, i) => {
      const box = h("div", { class: "panel", style: "margin:1rem 0" }, h("h3", { text: `${i + 1}. ${q.q}` }));
      const opts = q.options.map((o, j) => h("button", { type: "button", class: "opt", text: o, onclick: () => {
        answers[i] = j; opts.forEach((b, k) => { b.classList.toggle("good", k === q.answer && j !== null); b.classList.toggle("bad", k === j && j !== q.answer); b.disabled = true; });
        box.append(h("p", { class: "muted", text: (j === q.answer ? "Correct. " : "Not quite. ") + q.why })); } }));
      box.append(...opts); return box; });
    const submit = h("button", { class: "btn", onclick: async () => {
      if (answers.includes(null)) { result.textContent = "Answer every question first."; return; }
      const correct = answers.filter((a, i) => a === qs[i].answer).length;
      try { const res = await api(`/api/modules/${slug}/complete`, { method: "POST", body: { correct, total: qs.length } });
        reward(res); result.textContent = ""; toast(`Score ${correct}/${qs.length}. Module complete.`, "success"); }
      catch (e) { result.textContent = `Score ${correct}/${qs.length}. ` + e.message + " Reload to retry."; } } }, "Submit quiz");
    show(h("a", { href: "/academy" }, "< Academy"), head(m.title, `${m.category} · ${m.minutes} min · ${m.xp} XP`),
      les.sections.map((x) => h("div", { class: "panel", style: "margin-bottom:1rem" }, h("h3", { text: x.h }), h("p", { text: x.p }))),
      h("h2", { text: `Quiz // ${qs.length} Questions` }), quiz, submit, result,
      h("div", { class: "row", style: "margin-top:1.5rem" }, data.prev ? h("a", { class: "btn btn-ghost btn-sm", href: "/academy/" + data.prev.slug }, "Prev") : null,
        data.next ? h("a", { class: "btn btn-ghost btn-sm", href: "/academy/" + data.next.slug }, "Next") : null));
  }

  function achievements(s) {
    show(head("Achievements", `${s.stats.achievements}/${s.stats.achievements_total} unlocked · each badge gives bonus XP`),
      h("div", { class: "grid cards" }, s.achievements.map((a) => h("div", { class: "panel" + (a.unlocked ? "" : " locked") },
        h("h3", { text: a.name }), h("p", { class: "muted", text: a.desc }), bar(Math.round(a.current / a.target * 100)),
        h("div", { class: "label", text: a.unlocked ? "UNLOCKED" : `${a.current}/${a.target}` })))),
      h("h2", { style: "margin-top:2rem", text: "Ranks" }),
      h("div", { class: "row" }, s.levels.map((l) => h("span", { class: "badge " + (s.profile.xp >= l.xp ? "badge-green" : "badge-muted"), text: `${l.name} ${l.xp}` }))));
    animateBars(root);
  }

  async function progress() {
    show(loader());
    let d; try { d = await api("/api/progress"); } catch (e) { return showError(root, e.message, progress); }
    const max = Math.max(1, ...d.xp_per_day.map((x) => x.xp));
    show(head("Progress", `${d.state.stats.completion}% of the learning path complete`),
      h("div", { class: "panel" }, h("div", { class: "panel-title", text: "XP, last 14 days" }),
        h("div", { class: "bars", role: "img", "aria-label": "XP per day" }, d.xp_per_day.map((x) => h("span", { title: `${x.date}: ${x.xp} XP`, style: `height:${x.xp / max * 100}%` })))),
      h("div", { class: "panel", style: "margin-top:1.5rem" }, h("div", { class: "panel-title", text: "By category" }),
        Object.entries(d.categories).map(([c, v]) => h("div", { style: "margin:.6rem 0" }, h("div", { class: "label", text: `${c}  ${v.done}/${v.total}` }), bar(v.done / v.total * 100)))),
      h("div", { class: "panel", style: "margin-top:1.5rem" }, h("div", { class: "panel-title", text: "Activity" }),
        d.activity.length ? h("ul", { class: "activity-list" }, d.activity.map((r) => h("li", {}, h("div", {}, r.title, h("time", { text: fmtDate(r.created_at) })), r.xp ? h("span", { class: "badge badge-green", text: "+" + r.xp }) : null)))
          : h("p", { class: "muted", text: "No activity yet." })));
    animateBars(root);
  }

  function about() {
    show(head("About CyberShield", "Learn. Exploit. Defend."),
      h("div", { class: "panel" }, h("p", { text: "CyberShield is a local learning platform for web application security. Everything runs on your computer with Flask and SQLite; progress is stored in a local file." }),
        h("p", { text: "Nothing here attacks, scans or contacts real systems. Practise security testing only on systems you own or have written permission to test." })));
  }

  const views = { dashboard: () => onState(dashboard), academy: () => onState(academy), achievements: () => onState(achievements), lesson, progress, about };
  show(loader());
  (views[view] || about)();
  if (["about"].includes(view)) about();
})();
