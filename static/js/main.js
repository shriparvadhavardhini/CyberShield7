/* ==========================================================================
   main.js  -  shared code loaded on EVERY page
   Exposes one global object, CS, that the other scripts use:
     CS.api()        talk to Flask          CS.toast()     small notifications
     CS.openModal()  dialogs                CS.loadState() learner data
     CS.reward()     show XP / badges / level-up after an API call
   No user text is ever inserted with innerHTML (that would be an XSS bug!);
   we build elements with the h() helper and textContent instead.
   ========================================================================== */
(function () {
  "use strict";

  const CS = { state: null, _listeners: [] };
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const prefersReduced = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches || document.body.classList.contains("reduce-motion");

  /* ---------- tiny DOM builder: h("div", {class: "x", onclick: fn}, "text", child) ---------- */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
      else el.setAttribute(key, value === true ? "" : value);
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.append(child.nodeType ? child : document.createTextNode(String(child)));
    }
    return el;
  }

  /* ---------- talking to Flask ---------- */
  async function api(path, options = {}) {
    let res;
    try {
      res = await fetch(path, {
        method: options.method || "GET",
        headers: { "Content-Type": "application/json" },
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (_e) {
      const err = new Error("Cannot reach the CyberShield server. Make sure `python app.py` is still running, then try again.");
      err.network = true;
      throw err;
    }
    let data = null;
    try { data = await res.json(); } catch (_e) { /* not JSON */ }
    if (!res.ok || !data || data.ok === false) {
      throw new Error((data && data.error) || `The server answered with status ${res.status}.`);
    }
    return data;
  }

  /* ---------- toasts ---------- */
  function toast(message, type = "info", title) {
    const root = $("#toast-root");
    if (!root) return;
    const titles = { error: "ERROR", xp: "XP GAINED", badge: "ACHIEVEMENT", info: "SYSTEM", success: "SUCCESS" };
    const el = h("div", { class: `toast ${type}`, role: type === "error" ? "alert" : "status" },
      h("div", {}, h("strong", { text: title || titles[type] || "SYSTEM" }), h("span", { text: message })));
    root.append(el);
    setTimeout(() => { el.classList.add("leaving"); setTimeout(() => el.remove(), 320); }, type === "error" ? 6500 : 4200);
  }

  /* ---------- modals ---------- */
  function openModal({ title, content, actions = [], dismissible = true }) {
    const previouslyFocused = document.activeElement;
    const close = () => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
    const buttons = actions.map((a) =>
      h("button", {
        type: "button", class: `btn btn-sm ${a.kind === "ghost" ? "btn-ghost" : ""} ${a.kind === "danger" ? "btn-danger" : ""}`,
        onclick: async () => { if (a.onClick) { const keepOpen = await a.onClick(modalApi); if (keepOpen === true) return; } if (a.close !== false) close(); },
      }, a.label));
    const modal = h("div", { class: "modal", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("h2", { text: title }), content, buttons.length ? h("div", { class: "modal-actions" }, buttons) : null);
    const backdrop = h("div", { class: "modal-backdrop" }, modal);
    if (dismissible) backdrop.addEventListener("mousedown", (e) => { if (e.target === backdrop) close(); });
    function onKey(e) {
      if (e.key === "Escape" && dismissible) { close(); return; }
      if (e.key !== "Tab") return;                       // keep keyboard focus inside the dialog
      const f = $$("button, input, select, textarea, a[href]", modal).filter((x) => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", onKey);
    document.body.append(backdrop);
    const firstField = $("input, textarea, select", modal) || $("button", modal);
    if (firstField) firstField.focus();
    const modalApi = { close, el: modal };
    return modalApi;
  }

  function confirmDialog({ title, message, confirmLabel = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      openModal({
        title, content: h("p", { text: message }),
        actions: [
          { label: "Cancel", kind: "ghost", onClick: () => resolve(false) },
          { label: confirmLabel, kind: danger ? "danger" : "", onClick: () => resolve(true) },
        ],
      });
    });
  }

  /* ---------- helpers ---------- */
  function loader(text = "LOADING DATA") { return h("div", { class: "loader", role: "status" }, text); }
  function showError(container, message, retry) {
    container.replaceChildren(h("div", { class: "state-box error", role: "alert" },
      h("h3", { text: "CONNECTION FAULT" }), h("p", { text: message }),
      retry ? h("button", { type: "button", class: "btn btn-sm", onclick: retry }, "Retry") : null));
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  const initials = (name) => (name || "?").trim().slice(0, 2).toUpperCase();
  function countUp(el, target, duration = 1200, suffix = "") {
    if (prefersReduced()) { el.textContent = target + suffix; return; }
    const start = performance.now();
    const step = (now) => {
      const t = Math.min((now - start) / duration, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))) + suffix;
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function animateBars(root = document) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      $$("[data-progress]", root).forEach((el) => { el.style.width = Math.max(0, Math.min(100, Number(el.dataset.progress))) + "%"; });
    }));
  }

  /* ---------- learner state ---------- */
  function onState(fn) { CS._listeners.push(fn); if (CS.state) fn(CS.state); }
  function setState(state) {
    CS.state = state;
    applySettings(state.profile.settings);
    renderShell(state);
    CS._listeners.forEach((fn) => fn(state));
  }
  async function loadState() {
    const data = await api("/api/state");
    setState(data.state);
    return data.state;
  }

  function applySettings(s) {
    document.body.classList.toggle("no-scanlines", !s.scanlines);
    document.body.classList.toggle("no-particles", !s.particles);
    document.body.classList.toggle("reduce-motion", !!s.reduce_motion);
  }

  function renderShell(state) {
    const name = state.profile.nickname || "OPERATIVE";
    $$("[data-bind='nickname']").forEach((el) => (el.textContent = name));
    $$("[data-bind='avatar']").forEach((el) => (el.textContent = initials(name)));
    $$("[data-bind='level']").forEach((el) => (el.textContent = state.level.name));
    $$("[data-bind='xp']").forEach((el) => (el.textContent = state.profile.xp.toLocaleString() + " XP"));
    const bar = $("#mini-xp-bar");
    if (bar) bar.style.width = state.level.percent + "%";
    const next = $("#mini-xp-text");
    if (next) next.textContent = state.level.next_name ? `${state.level.xp_to_next} XP to ${state.level.next_name}` : "MAX LEVEL REACHED";
    const bell = $("#notif-btn");
    if (bell) {
      const seen = localStorage.getItem("cs_seen") || "";
      bell.dataset.count = state.recent.filter((r) => r.created_at > seen).length;
    }
  }

  /* ---------- XP / achievement / level-up feedback ---------- */
  function showLevelUp(level) {
    const overlay = h("div", { class: "levelup", role: "dialog", "aria-modal": "true", "aria-label": "Level up" },
      h("div", {},
        h("p", { class: "label glow-cyan", text: "RANK PROMOTION" }),
        h("h2", { class: "glow-green", text: level.name }),
        h("p", { class: "muted", text: "New clearance level unlocked. Keep going, operative." }),
        h("button", { type: "button", class: "btn", onclick: () => overlay.remove() }, "Continue")));
    document.body.append(overlay);
    $("button", overlay).focus();
  }
  function reward(res) {
    if (res.state) setState(res.state);
    if (res.xp_gained > 0) toast(`+${res.xp_gained} XP`, "xp");
    (res.new_achievements || []).forEach((a) => toast(`${a.name}: ${a.desc}`, "badge"));
    if (res.level_up) showLevelUp(res.level_up);
  }

  /* ---------- shell: sidebar drawer, search, modals ---------- */
  function setupShell() {
    const menu = $("#menu-btn"), scrim = $(".sidebar-scrim");
    const toggle = (open) => {
      document.body.classList.toggle("sidebar-open", open);
      if (menu) menu.setAttribute("aria-expanded", String(open));
    };
    if (menu) menu.addEventListener("click", () => toggle(!document.body.classList.contains("sidebar-open")));
    if (scrim) scrim.addEventListener("click", () => toggle(false));
    $$(".sidebar a").forEach((a) => a.addEventListener("click", () => toggle(false)));
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") toggle(false); });

    const settingsBtn = $("#open-settings");
    if (settingsBtn) settingsBtn.addEventListener("click", () => { toggle(false); openSettings(); });
    const profileBtn = $("#open-profile");
    if (profileBtn) profileBtn.addEventListener("click", openProfile);
    const bell = $("#notif-btn");
    if (bell) bell.addEventListener("click", openNotifications);

    setupSearch();
  }

  function setupSearch() {
    const input = $("#search-input"), box = $("#search-results");
    if (!input || !box) return;
    let timer = null;
    const hide = () => { box.hidden = true; box.replaceChildren(); };
    input.addEventListener("input", () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { hide(); return; }
      timer = setTimeout(async () => {
        try {
          const { results } = await api("/api/search?q=" + encodeURIComponent(q));
          box.replaceChildren(...(results.length
            ? results.map((r) => h("a", { href: r.url }, h("span", { text: r.title }), h("span", { class: "label", text: r.type })))
            : [h("div", { class: "empty", text: `No lessons, labs or challenges match "${q}".` })]));
          box.hidden = false;
        } catch (err) { box.replaceChildren(h("div", { class: "empty", text: err.message })); box.hidden = false; }
      }, 200);
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { const first = $("a", box); if (first) { e.preventDefault(); first.focus(); } }
      if (e.key === "Escape") { hide(); input.blur(); }
    });
    box.addEventListener("keydown", (e) => {
      const links = $$("a", box), i = links.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && links[i + 1]) { e.preventDefault(); links[i + 1].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (links[i - 1] || input).focus(); }
      if (e.key === "Escape") { hide(); input.focus(); }
    });
    document.addEventListener("click", (e) => { if (!e.target.closest(".search")) hide(); });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
    });
  }

  const NICK_RE = /^[A-Za-z0-9_\- ]{2,20}$/;
  const CALLSIGN_KEY = "cs_callsign";
  function nicknameForm(initial, onSaved, dismissible) {
    const input = h("input", { type: "text", id: "nick-input", maxlength: "20", autocomplete: "off", value: initial || "", placeholder: "e.g. GhostWriter" });
    const err = h("div", { class: "field-error", role: "alert" });
    const save = async (modal) => {
      const value = input.value.trim();
      if (!NICK_RE.test(value)) { err.textContent = "Use 2-20 characters: letters, numbers, spaces, - or _."; input.focus(); return true; }
      try {
        const res = await api("/api/profile", { method: "POST", body: { nickname: value } });
        localStorage.setItem(CALLSIGN_KEY, value);
        setState(res.state);
        toast(`Welcome, ${value}.`, "success");
        if (onSaved) onSaved();
      }
      catch (e) { err.textContent = e.message; return true; }
    };
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $(".modal-actions .btn:last-child").click(); } });
    return { content: h("div", {}, h("div", { class: "field" }, h("label", { for: "nick-input", text: "Operative callsign" }), input, err),
      h("p", { class: "muted", text: "This is a local learning profile. No password, email or personal data is needed." })), save };
  }

  function requireNickname() {
    if (document.querySelector(".modal-backdrop")) return;
    const { content, save } = nicknameForm("", null, false);
    openModal({ title: "Choose your callsign", content, dismissible: false, actions: [{ label: "Begin training", onClick: save }] });
  }
  function openProfile() {
    const s = CS.state; if (!s) return;
    const { content, save } = nicknameForm(s.profile.nickname, null, true);
    const info = h("div", { style: "display:flex;gap:1rem;align-items:center;margin-bottom:1.2rem" },
      h("div", { class: "avatar lg", text: initials(s.profile.nickname) }),
      h("div", {}, h("div", { class: "label", text: "Current rank" }), h("div", { class: "glow-green", style: "font-family:var(--font-head);font-size:1.4rem", text: s.level.name }),
        h("div", { class: "muted mono", text: `${s.profile.xp.toLocaleString()} XP` })));
    openModal({ title: "Operative profile", content: h("div", {}, info, content),
      actions: [{ label: "Close", kind: "ghost" }, { label: "Save callsign", onClick: save }] });
  }
  function openNotifications() {
    const s = CS.state; if (!s) return;
    localStorage.setItem("cs_seen", new Date().toISOString().slice(0, 19));
    renderShell(s);
    const list = s.recent.length
      ? h("ul", { class: "activity-list" }, s.recent.slice(0, 8).map((r) => h("li", {}, h("div", {}, h("span", { text: r.title }), h("time", { text: fmtDate(r.created_at) })), r.xp ? h("span", { class: "badge badge-green", text: `+${r.xp} XP` }) : null)))
      : h("div", { class: "state-box", text: "No activity yet. Complete a module or lab to see it here." });
    openModal({ title: "Notifications", content: list, actions: [{ label: "Close", kind: "ghost" }] });
  }
  function openSettings() {
    const s = CS.state; if (!s) return;
    const row = (key, text) => {
      const input = h("input", { type: "checkbox", id: "set-" + key });
      input.checked = !!s.profile.settings[key];
      input.addEventListener("change", async () => {
        try { const res = await api("/api/settings", { method: "POST", body: { [key]: input.checked } }); setState(res.state); }
        catch (e) { input.checked = !input.checked; toast(e.message, "error"); }
      });
      return h("label", { class: "switch", for: "set-" + key }, h("span", { class: "text", text }), input, h("span", { class: "track" }));
    };
    const reset = h("button", { type: "button", class: "btn btn-danger btn-sm", onclick: async () => {
      const ok = await confirmDialog({ title: "Reset all progress?", message: "This erases XP, completed modules, labs, quiz results and achievements. Your callsign is kept. This cannot be undone.", confirmLabel: "Erase progress", danger: true });
      if (!ok) return;
      try { const res = await api("/api/reset", { method: "POST", body: {} }); setState(res.state); toast("Progress erased. Fresh start.", "success"); setTimeout(() => location.reload(), 700); }
      catch (e) { toast(e.message, "error"); }
    } }, "Reset progress");
    openModal({ title: "Interface settings", actions: [{ label: "Done", kind: "ghost" }],
      content: h("div", {}, row("scanlines", "Scan-line overlay"), row("particles", "Background particles"), row("reduce_motion", "Reduce motion"),
        h("div", { style: "margin-top:1.2rem" }, h("div", { class: "label", style: "margin-bottom:.5rem", text: "Danger zone" }), reset)) });
  }

  /* ---------- animated particle background ---------- */
  function startParticles() {
    const canvas = $("#bg-particles");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h2, dots = [], raf = null;
    const resize = () => {
      w = canvas.width = window.innerWidth; h2 = canvas.height = window.innerHeight;
      const count = Math.min(70, Math.round((w * h2) / 26000));
      dots = Array.from({ length: count }, () => ({ x: Math.random() * w, y: Math.random() * h2, vx: (Math.random() - .5) * .25, vy: (Math.random() - .5) * .25, c: Math.random() > .6 ? "0,229,255" : "182,255,0" }));
    };
    const frame = () => {
      ctx.clearRect(0, 0, w, h2);
      for (const d of dots) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > w) d.vx *= -1; if (d.y < 0 || d.y > h2) d.vy *= -1;
        ctx.fillStyle = `rgba(${d.c},.55)`; ctx.fillRect(d.x, d.y, 2, 2);
      }
      for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
        const dx = dots[i].x - dots[j].x, dy = dots[i].y - dots[j].y, dist = dx * dx + dy * dy;
        if (dist < 12000) { ctx.strokeStyle = `rgba(${dots[i].c},${.12 * (1 - dist / 12000)})`; ctx.beginPath(); ctx.moveTo(dots[i].x, dots[i].y); ctx.lineTo(dots[j].x, dots[j].y); ctx.stroke(); }
      }
      raf = requestAnimationFrame(frame);
    };
    const run = () => { cancelAnimationFrame(raf); if (!prefersReduced() && !document.body.classList.contains("no-particles") && !document.hidden) frame(); else ctx && ctx.clearRect(0, 0, w, h2); };
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", run);
    new MutationObserver(run).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    resize(); run();
  }

  /* ---------- smooth page transition on internal links ---------- */
  function setupTransitions() {
    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[href]");
      if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || (url.pathname === location.pathname && url.hash) || prefersReduced()) return;
      e.preventDefault();
      document.body.classList.add("leaving");
      setTimeout(() => { location.href = a.href; }, 140);
    });
    window.addEventListener("pageshow", () => document.body.classList.remove("leaving"));
  }

  /* ---------- start-up ---------- */
  document.addEventListener("DOMContentLoaded", async () => {
    startParticles();
    setupTransitions();
    const isApp = document.body.dataset.shell === "app";
    if (isApp) setupShell();
    try {
      const state = await loadState();
      if (isApp && !state.profile.nickname) {
        const savedCallsign = localStorage.getItem(CALLSIGN_KEY);
        if (savedCallsign && NICK_RE.test(savedCallsign)) {
          try {
            const res = await api("/api/profile", { method: "POST", body: { nickname: savedCallsign } });
            setState(res.state);
          } catch (_err) {
            requireNickname();
          }
        } else {
          requireNickname();
        }
      }
    } catch (err) {
      if (isApp) toast(err.message, "error", "SERVER OFFLINE");
      CS.loadError = err;
    }
  });

  Object.assign(CS, { api, h, $, $$, toast, openModal, confirmDialog, loader, showError, fmtDate, initials, countUp, animateBars, onState, loadState, setState, reward, prefersReduced });
  window.CS = CS;
})();
