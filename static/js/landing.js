/* ==========================================================================
   landing.js  -  home page behaviour: boot terminal, counters, reveals,
   mobile menu and the roadmap progress (read from your saved XP).
   ========================================================================== */
(function () {
  "use strict";
  const { $, $$, countUp, prefersReduced } = window.CS;

  /* ---- mobile menu ---- */
  const toggle = $("#nav-toggle"), links = $("#nav-links");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  $$("a", links).forEach((a) => a.addEventListener("click", () => links.classList.remove("open")));

  /* ---- boot terminal: types character by character ---- */
  const log = $("#boot-log");
  const lines = [
    ["[INITIALIZING CYBERSHIELD]", "t-info"],
    ["[LOADING SECURITY PROTOCOLS...]", "t-dim"],
    ["[CONNECTING TO HACKLAB...]", "t-dim"],
    ["[ACCESS GRANTED]", "t-ok"],
    ["[SYSTEM ONLINE]", "t-ok"],
  ];
  function typeLines() {
    if (prefersReduced()) {
      lines.forEach(([text, cls]) => appendLine(text, cls));
      return;
    }
    let li = 0, ci = 0, current = null;
    const tick = () => {
      if (li >= lines.length) return;
      const [text, cls] = lines[li];
      if (ci === 0) current = appendLine("", cls);
      current.textContent = text.slice(0, ++ci);
      if (ci >= text.length) { li++; ci = 0; setTimeout(tick, 380); } else setTimeout(tick, 28);
    };
    tick();
  }
  function appendLine(text, cls) {
    const row = document.createElement("div");
    row.className = cls; row.textContent = text;
    log.append(row);
    return row;
  }
  typeLines();

  /* ---- count-up numbers and reveal-on-scroll (only when they enter the viewport) ---- */
  const seen = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      seen.unobserve(entry.target);
      entry.target.classList.add("in");
      $$(".count", entry.target).forEach((el) => {
        const target = Number(el.dataset.count), suffix = el.dataset.suffix || "";
        const pad = Number(el.dataset.pad || 0);
        if (pad) {
          if (prefersReduced()) { el.textContent = String(target).padStart(pad, "0"); return; }
          const start = performance.now();
          const step = (now) => {
            const t = Math.min((now - start) / 1200, 1);
            el.textContent = String(Math.round(target * t)).padStart(pad, "0");
            if (t < 1) requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        } else countUp(el, target, 1400, suffix);
      });
    });
  }, { threshold: 0.25 });
  $$(".band").forEach((el) => { if (!prefersReduced()) el.classList.add("reveal"); seen.observe(el); });

  /* ---- roadmap: highlight current rank from the saved profile (if the server answers) ---- */
  window.CS.onState((state) => {
    const xp = state.profile.xp;
    $$(".roadmap li").forEach((li, i) => {
      const lv = state.levels[i], next = state.levels[i + 1];
      const pct = !next ? 100 : Math.max(0, Math.min(100, ((xp - lv.xp) / (next.xp - lv.xp)) * 100));
      $("[data-fill]", li).style.width = Math.round(pct) + "%";
      li.classList.toggle("current", state.level.name === lv.name);
    });
  });
})();
