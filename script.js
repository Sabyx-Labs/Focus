(() => {
const $ = s => document.querySelector(s), DAY = 864e5, FIXED = ["school", "tuition"];
const F = new Intl.DateTimeFormat("en-CA", { timeZone: PF.tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
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

let off = 0, last = "";
const tl = $("#timeline");
function renderTimeline(ev, t, cur, live) {
  tl.innerHTML = ev.map(e => {
    const st = !live ? "up" : e === cur ? "cur" : e.e <= t ? "done" : e.s <= t ? "clash" : "up";
    const bad = e.notes.length;
    return `<li class="ev ${st}${bad ? " bad" : ""}" data-type="${e.type}"><span class="tm">${e.point ? "from " + hm(e.s) : hm(e.s) + " – " + hm(e.e)}<small>${e.point ? "" : dur(e.e - e.s)}</small></span><div><b>${e.title}</b>${e.notes.map(n => `<p class="note">${n}</p>`).join("")}</div><span class="tag">${bad ? "Flagged" : st === "cur" ? "Now" : st === "done" ? "Done" : e.type}</span></li>`;
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
  $("#viewDate").textContent = D.format(view);
  $("#viewTheme").textContent = PF.days[new Date(view).getUTCDay()].name + (inRange(view) ? "" : " · outside timetable period");
  $("#backToday").hidden = off === 0;
  $("#range").hidden = inRange(n.day);
  $("#range").textContent = `Outside the configured timetable period (${D.format(Date.parse(PF.period.start))} – ${D.format(Date.parse(PF.period.end))}). Live tracking is paused; you can still browse the weekly schedule.`;

  const ev = build(view), cur = live ? pick(ev, t) : null, done = live ? ev.filter(e => e.e <= t).length : 0;
  const sig = [view, cur && cur.id, done, live].join();
  if (sig !== last) {
    last = sig; renderTimeline(ev, t, cur, live);
    const flagged = ev.filter(e => e.notes.length).length;
    $("#flags").hidden = !flagged; $("#flags").textContent = `${flagged} item${flagged > 1 ? "s" : ""} flagged for review in this schedule.`;
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
  $("#elTxt").textContent = t < first ? "Not started" : t >= end ? "Finished" : `${dur(t - first)} elapsed of ${dur(end - first)}`;
  $("#doneTxt").textContent = `${done} of ${ev.length} activities done`;
  $("#doneBar").style.width = done / ev.length * 100 + "%";
}

$("#prev").onclick = () => { off--; last = ""; tick(); };
$("#next").onclick = () => { off++; last = ""; tick(); };
$("#backToday").onclick = () => { off = 0; last = ""; tick(); };
$("#satBtn").onclick = () => { const k = iso(nowIST().day + off * DAY); try { localStorage.setItem("pf-sat-" + k, satMode(k) === "school" ? "holiday" : "school"); } catch (_) {} last = ""; tick(); };
tick(); setInterval(tick, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

let dp; const ib = $("#install");
addEventListener("beforeinstallprompt", e => { e.preventDefault(); dp = e; ib.hidden = false; });
ib.onclick = async () => { if (dp) { dp.prompt(); await dp.userChoice; dp = null; ib.hidden = true; } };
addEventListener("appinstalled", () => ib.hidden = true);
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
})();
