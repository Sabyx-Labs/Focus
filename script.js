(() => {
const NOEL = { hidden: true, setAttribute() {}, addEventListener() {}, querySelector() { return null; }, showModal() {}, close() {}, scrollTo() {} };
const $ = s => document.querySelector(s) || Object.assign({}, NOEL, { style: {}, dataset: {} }), DAY = 864e5, FIXED = ["school", "tuition"];
const F = new Intl.DateTimeFormat("en-CA", { timeZone: PF.tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const D2 = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "short" });
const D = new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" });
const iso = ms => new Date(ms).toISOString().slice(0, 10);
const sec = t => { const [h, m] = t.split(":"); return h * 3600 + m * 60; };
const pad = n => String(n).padStart(2, "0");
const hm = s => { const h = Math.floor(s / 3600) % 24; return `${h % 12 || 12}:${pad(Math.floor(s % 3600 / 60))} ${h < 12 ? "AM" : "PM"}`; };
const hms = s => [s / 3600 | 0, s % 3600 / 60 | 0, s % 60].map(pad).join(":");
const dur = s => { const m = Math.round(s / 60); return m >= 60 ? `${m / 60 | 0}h${m % 60 ? " " + m % 60 + "m" : ""}` : `${m}m`; };

function nowIST() {
  const p = {}; F.formatToParts(new Date()).forEach(x => p[x.type] = x.value);
  return { day: Date.UTC(+p.year, p.month - 1, +p.day), t: p.hour * 3600 + p.minute * 60 + +p.second };
}
function satMode(k) { try { return localStorage.getItem("pf-sat-" + k) || (PF.saturdaySchool ? "school" : "holiday"); } catch (_) { return PF.saturdaySchool ? "school" : "holiday"; } }

function build(ms) {
  const dow = new Date(ms).getUTCDay(), wk = Math.floor(ms / DAY / 7), mode = satMode(iso(ms));
  const ev = PF.days[dow].events
    .filter(e => dow !== 6 || !(e[4] && e[4].only) || e[4].only === mode)
    .map(e => ({ s: sec(e[0]), e: e[1] ? sec(e[1]) : null, point: !e[1], title: Array.isArray(e[2]) ? e[2][wk % 2] : e[2], type: e[3], fixed: FIXED.includes(e[3]), flag: e[4] && e[4].flag, notes: [] }))
    .sort((a, b) => a.s - b.s);
  ev.forEach((e, i) => { e.id = i; if (e.e == null) e.e = ev[i + 1] ? ev[i + 1].s : e.s + 1800; });
  return validate(ev);
}
// Overlap detection: flags both events; never moves or edits any event.
function validate(ev) {
  for (let i = 0; i < ev.length; i++) for (let j = i + 1; j < ev.length && ev[j].s < ev[i].e; j++) {
    const a = ev[i], b = ev[j];
    a.notes.push(`Conflict: overlaps "${b.title}" (${hm(b.s)}–${hm(b.e)})`);
    b.notes.push(`Conflict: overlaps "${a.title}" (${hm(a.s)}–${hm(a.e)})`);
    if (!a.fixed && b.fixed) a.notes.push("Flexible activity – adjust it; fixed commitments take priority.");
    if (a.fixed && !b.fixed) b.notes.push("Flexible activity – adjust it; fixed commitments take priority.");
  }
  ev.forEach(e => { if (e.flag) e.notes.push(e.flag); });
  return ev;
}
const pick = (ev, t) => { const c = ev.filter(e => e.s <= t && t < e.e); return c.find(e => e.fixed) || c[0] || null; };
const inRange = ms => iso(ms) >= PF.period.start && iso(ms) <= PF.period.end;

// Register the service worker first so a later error can never block installation.
if ("serviceWorker" in navigator) { const reg = () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}); document.readyState === "complete" ? reg() : addEventListener("load", reg); }

let off = 0, last = "", ctx = { ev: [], cur: null, live: false, t: 0 }, hcLi = null;
const hc = $("#hc");
const tl = $("#timeline");
function renderTimeline(ev, t, cur, live) {
  hc.classList.remove("on"); hcLi = null;
  tl.innerHTML = ev.map((e, i) => {
    const st = !live ? "up" : e === cur ? "cur" : e.e <= t ? "done" : e.s <= t ? "clash" : "up";
    return `<li class="ev ${st}${e.notes.length ? " bad" : ""}" data-type="${e.type}" data-i="${i}" tabindex="0"><time>${hm(e.s)}</time><i class="dot"></i><span class="t">${e.title}</span>${e.notes.length ? '<em class="wn">!</em>' : st === "cur" ? '<em class="nw">Now</em>' : "<span></span>"}</li>`;
  }).join("");
  const c = tl.querySelector(".cur") || tl.querySelector(".up");
  tl.scrollTo({ top: live && c ? Math.max(0, c.offsetTop - tl.clientHeight / 3) : 0, behavior: "auto" });
}

function tick() {
  const n = nowIST(), view = n.day + off * DAY, live = off === 0 && inRange(n.day), t = n.t;
  const h = n.t / 3600 | 0;
  $("#clock").textContent = `${pad(h % 12 || 12)}:${pad(n.t % 3600 / 60 | 0)}:${pad(n.t % 60)}`;
  $("#ampm").textContent = h < 12 ? "AM" : "PM";
  $("#today").textContent = D.format(n.day);
  $("#viewDate").textContent = D2.format(view);
  $("#viewTheme").textContent = PF.days[new Date(view).getUTCDay()].name + (inRange(view) ? "" : " · outside timetable period");
  $("#backToday").hidden = off === 0;
  $("#range").hidden = inRange(n.day);
  $("#range").textContent = "Outside the timetable period (12 Oct 2026 – 11 Jan 2027) · live tracking paused";

  const ev = build(view), cur = live ? pick(ev, t) : null, done = live ? ev.filter(e => e.e <= t).length : 0;
  ctx = { ev, cur, live, t };
  const sig = [view, cur && cur.id, done, live].join();
  if (sig !== last) {
    last = sig; renderTimeline(ev, t, cur, live);
    const flagged = ev.filter(e => e.notes.length).length;
    $("#flags").hidden = !flagged; $("#flags").textContent = `${flagged} flagged · hover or tap an item for details`;
    const sat = new Date(view).getUTCDay() === 6; $("#sat").hidden = !sat;
    if (sat) $("#satBtn").textContent = satMode(iso(view)) === "school" ? "School day – switch to holiday" : "Holiday – switch to school day";
  }
  const first = ev[0].s, end = ev[ev.length - 1].e;
  $("#cur").dataset.type = cur ? cur.type : "";
  if (!live) {
    $("#curLabel").textContent = "Preview"; $("#curTitle").textContent = `${PF.days[new Date(view).getUTCDay()].name}`;
    $("#curTime").textContent = off ? "Live tracking applies to today only." : "Outside the timetable period."; $("#curBar").style.width = "0";
    $("#nextTitle").textContent = "—"; $("#count").textContent = "--:--:--"; $("#nextList").innerHTML = "";
    $("#elapsed").style.width = "0"; $("#doneBar").style.width = "0"; $("#doneTxt").textContent = `${ev.length} activities`; $("#elTxt").textContent = `${hm(first)} – ${hm(end)}`;
    return;
  }
  if (cur) {
    $("#curLabel").textContent = "Happening now"; $("#curTitle").textContent = cur.title;
    $("#curTime").textContent = `${hm(cur.s)} – ${hm(cur.e)} · ${hms(cur.e - t)} left`;
    $("#curBar").style.width = Math.min(100, (t - cur.s) / (cur.e - cur.s) * 100) + "%";
  } else {
    $("#curLabel").textContent = t < first ? "Before the day starts" : t >= end ? "Day complete" : "Between activities";
    $("#curTitle").textContent = "Nothing scheduled"; $("#curTime").textContent = ""; $("#curBar").style.width = "0";
  }
  const up = ev.filter(e => e.s > t).map(e => ({ ...e, tom: false }));
  const tom = build(view + DAY).map(e => ({ ...e, tom: true }));
  const all = up.concat(tom), nx = all[0];
  if (nx) {
    $("#nextTitle").textContent = nx.title + (nx.tom ? " (tomorrow)" : "");
    $("#count").textContent = hms(nx.tom ? 86400 - t + nx.s : nx.s - t);
  }
  $("#nextList").innerHTML = all.slice(0, 3).map(e => `<li data-type="${e.type}"><span>${hm(e.s)}${e.tom ? " tmrw" : ""}</span>${e.title}</li>`).join("");
  $("#elapsed").style.width = Math.max(0, Math.min(100, (t - first) / (end - first) * 100)) + "%";
  $("#elTxt").textContent = t < first ? "Not started" : t >= end ? "Finished" : `${dur(t - first)} / ${dur(end - first)}`;
  $("#doneTxt").textContent = `${done} / ${ev.length}`;
  $("#doneBar").style.width = done / ev.length * 100 + "%";
}

$("#prev").onclick = () => { off--; last = ""; tick(); };
$("#next").onclick = () => { off++; last = ""; tick(); };
$("#backToday").onclick = () => { off = 0; last = ""; tick(); };
$("#satBtn").onclick = () => { const k = iso(nowIST().day + off * DAY); try { localStorage.setItem("pf-sat-" + k, satMode(k) === "school" ? "holiday" : "school"); } catch (_) {} last = ""; tick(); };
tick(); setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

// ---- Hover card ----
const TYPE = { school: "School", tuition: "Tuition", study: "Study", meal: "Meal", rest: "Rest", phone: "Phone", break: "Break", wake: "Wake up" };
function hideHC() { hc.classList.remove("on"); hcLi = null; }
function showHC(li) {
  const e = ctx.ev[li.dataset.i]; if (!e) return; hcLi = li;
  const { cur, live, t } = ctx;
  const st = !live ? "Scheduled" : e === cur ? "In progress" : e.e <= t ? "Completed" : e.s <= t ? "Overlapped" : "Upcoming";
  const ex = !live ? "" : e === cur ? hms(e.e - t) + " left" : e.s > t ? "in " + hms(e.s - t) : "";
  hc.dataset.type = e.type;
  hc.innerHTML = `<div class="hh"><b>${e.title}</b><span class="pill">${TYPE[e.type]}</span></div><div class="hr"><span>${e.point ? "From " + hm(e.s) : hm(e.s) + " – " + hm(e.e)}</span><span>${e.point ? "" : dur(e.e - e.s)}</span></div><div class="hr"><span>${st}</span><span>${ex}</span></div>${e.fixed ? '<p class="fx">Fixed commitment</p>' : ""}${e.notes.map(n => `<p class="note">${n}</p>`).join("")}`;
  hc.classList.add("on");
  const r = li.getBoundingClientRect(), w = hc.offsetWidth, h = hc.offsetHeight;
  let top = r.bottom + 8; if (top + h > innerHeight - 12) top = r.top - h - 8;
  hc.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left + 70)) + "px";
  hc.style.top = Math.max(12, top) + "px";
}
tl.addEventListener("pointerover", e => { if (e.pointerType !== "mouse") return; const li = e.target.closest(".ev"); li ? showHC(li) : hideHC(); });
tl.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") hideHC(); });
tl.addEventListener("click", e => { if (e.pointerType === "mouse" || e.detail === 0) return; const li = e.target.closest(".ev"); !li || li === hcLi ? hideHC() : showHC(li); });
tl.addEventListener("focusin", e => { const li = e.target.closest(".ev"); if (li) showHC(li); });
tl.addEventListener("focusout", hideHC);
tl.addEventListener("scroll", hideHC);
addEventListener("scroll", hideHC, { passive: true });
document.addEventListener("click", e => { if (!e.target.closest(".timeline")) hideHC(); });
$("#aboutBtn").onclick = () => $("#about").showModal();
$("#aboutClose").onclick = () => $("#about").close();

// ---- Theme ----
const store = { get: (k, d) => { try { return localStorage.getItem(k) || d; } catch (_) { return d; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} } };
const TC = { navy: "#0a1628", midnight: "#000000", light: "#eef3fb" };
function applyTheme() {
  const t = store.get("pf-theme", "navy"), a = store.get("pf-accent", "blue"), r = document.documentElement;
  r.dataset.theme = t; r.dataset.accent = a;
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = TC[t] || TC.navy;
  document.querySelectorAll("[data-set-theme]").forEach(b => b.setAttribute("aria-pressed", b.dataset.setTheme === t));
  document.querySelectorAll("[data-set-accent]").forEach(b => b.setAttribute("aria-pressed", b.dataset.setAccent === a));
}
const tp = $("#themePanel"), tb = $("#themeBtn");
const closeTheme = () => { tp.hidden = true; tb.setAttribute("aria-expanded", "false"); };
tb.onclick = e => { e.stopPropagation(); tp.hidden = !tp.hidden; tb.setAttribute("aria-expanded", String(!tp.hidden)); };
tp.onclick = e => { e.stopPropagation(); const b = e.target.closest("button"); if (!b) return; if (b.dataset.setTheme) store.set("pf-theme", b.dataset.setTheme); if (b.dataset.setAccent) store.set("pf-accent", b.dataset.setAccent); applyTheme(); };
document.addEventListener("click", closeTheme);
document.addEventListener("keydown", e => { if (e.key === "Escape") closeTheme(); });
applyTheme();

// ---- Install ----
let dp; const ib = $("#install"), how = $("#howto");
const standalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const syncInstall = () => { ib.hidden = standalone(); };
async function diag() {
  const need = ["index.html", "style.css", "script.js", "timetable.js", "manifest.webmanifest", "service-worker.js"], bad = [];
  await Promise.all(need.map(f => fetch(f, { cache: "no-store" }).then(r => { if (!r.ok) bad.push(f); }).catch(() => bad.push(f))));
  let sw = "not supported";
  if (navigator.serviceWorker) { const r = await navigator.serviceWorker.getRegistration(); sw = r ? (r.active ? "active" : "installing") : "not registered"; }
  $("#howDiag").textContent = (bad.length ? "Missing on your site: " + bad.join(", ") + ". Upload them to the same folder as index.html. " : "All app files found. ") + "Service worker: " + sw + ".";
}
function showHow() {
  const ua = navigator.userAgent, warn = $("#howWarn");
  $("#howBody").textContent = /iPhone|iPad|iPod/.test(ua) ? "In Safari, tap the Share button, then choose Add to Home Screen."
    : /Android/.test(ua) ? "In Chrome, tap the ⋮ menu, then choose Install app (or Add to Home screen)."
    : "In Chrome or Edge, click the install icon at the right end of the address bar, or open the menu and choose Install Prime Focus.";
  warn.hidden = isSecureContext && location.protocol !== "file:";
  warn.textContent = location.protocol === "file:" ? "You opened this as a local file. Installing only works from the hosted HTTPS link (or localhost)." : "This page is not on HTTPS, so the browser will not offer installation. Open the HTTPS link instead.";
  how.showModal ? how.showModal() : alert($("#howBody").textContent);
  diag().catch(() => {});
}
addEventListener("beforeinstallprompt", e => { e.preventDefault(); dp = e; });
ib.onclick = async () => { if (dp) { dp.prompt(); await dp.userChoice; dp = null; } else showHow(); };
$("#howClose").onclick = () => how.close();
addEventListener("appinstalled", () => { ib.hidden = true; });
syncInstall();

// ---- Offline ----
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.ready.then(() => { $("#offline").hidden = false; }).catch(() => {});
}
})();
