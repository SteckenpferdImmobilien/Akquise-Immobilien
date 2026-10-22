const sectionNames = {
  all: "Deine Immobilien",
  streets: "Straßenakquise",
  tasks: "Wiedervorlagen",
  map: "Gebäude & Besuche",
  calendar: "Kalender",
  route: "Deine Tagesroute",
  activities: "Kontaktverlauf",
  districts: "Deine Gebiete",
  reports: "Akquise-Auswertung",
  backup: "Sicherung & Geräte",
};
let calendarMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ),
  selectedDay = today(),
  editingEvent = null,
  routeIds = [],
  routeOnlyUnvisited = false,
  recorder = null,
  recordStream = null,
  recordTimer = null,
  loadingAttachments = false;
try {
  routeIds = JSON.parse(localStorage.getItem("akquise-route") || "[]");
  if (!Array.isArray(routeIds)) routeIds = [];
} catch {}
function setMenu(show) {
  document.body.classList.toggle("menu-open", show);
  $("#menu-toggle").setAttribute("aria-expanded", String(show));
  $("#menu-scrim").hidden = !show;
}
$("#menu-toggle").onclick = () =>
  setMenu(!document.body.classList.contains("menu-open"));
$("#menu-scrim").onclick = () => setMenu(false);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setMenu(false);
});
function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function goView(name) {
  document.querySelector(`[data-view="${name}"]`)?.click();
}
function renderWorkspace() {
  const extra = !["all", "tasks", "map"].includes(view);
  $("#workspace-extra").hidden = !extra;
  $(".workspace").hidden = extra;
  $(".stats").hidden = !["all", "reports"].includes(view);
  $("#page-title").textContent = sectionNames[view] || "Deine Akquise";
  $("#list-title").textContent = sectionNames[view] || "Deine Immobilien";
  $("#add").textContent =
    view === "streets"
      ? "＋ Straße hinzufügen"
      : view === "calendar"
        ? "＋ Termin hinzufügen"
        : "＋ Objekt hinzufügen";
  $("#add").onclick = () =>
    view === "streets"
      ? editStreet()
      : view === "calendar"
        ? editEvent()
        : edit();
  $("#district-options").innerHTML = [
    ...new Set(properties.map((p) => p.district).filter(Boolean)),
  ]
    .sort()
    .map((d) => `<option value="${escape(d)}"></option>`)
    .join("");
  const districtFilter = $("#district-filter"),
    selectedDistrict = districtFilter.value;
  districtFilter.innerHTML =
    '<option value="">Alle Gebiete</option><option value="__none__">Nicht zugeordnet</option>' +
    [...new Set(properties.map((p) => p.district).filter(Boolean))]
      .sort()
      .map((d) => `<option value="${escape(d)}">${escape(d)}</option>`)
      .join("");
  districtFilter.value = selectedDistrict;
  renderStreetReminders();
  const panel = $("#workspace-extra");
  if (view === "streets") renderStreets(panel);
  if (view === "calendar") renderCalendar(panel);
  if (view === "route") renderRoute(panel);
  if (view === "activities") renderTimeline(panel);
  if (view === "districts") renderDistricts(panel);
  if (view === "reports") renderReports(panel);
  if (view === "backup") renderBackups(panel);
}
async function eventsApi(path = "", options = {}) {
  if (deviceMode) return deviceCollection("events", path, options);
  const r = await fetch("/api/events" + path, options);
  const data = await r.json();
  if (!r.ok) throw Error(data.error || "Kalender nicht erreichbar");
  return data;
}
async function deviceCollection(name, path = "", options = {}) {
  const db = await localDb(),
    method = options.method || "GET";
  let value;
  if (method === "POST" || method === "PUT") {
    const input = JSON.parse(options.body);
    const old =
      method === "PUT"
        ? (name === "events"
            ? events
            : name === "streets"
              ? streets
              : properties
          ).find((p) => p.id === path.slice(1))
        : null;
    if (method === "PUT" && !old) throw Error("Eintrag nicht gefunden.");
    const now = new Date().toISOString();
    value = {
      ...(name === "events"
        ? AkquiseModel.event(input)
        : name === "streets"
          ? AkquiseModel.street(input)
          : AkquiseModel.property(input)),
      id: old?.id || crypto.randomUUID(),
      createdAt: old?.createdAt || now,
      updatedAt: now,
    };
    if (name === "properties") {
      value.history = old?.history || value.history || [];
      if (
        old
          ? old.status !== value.status
          : value.history.at(-1)?.status !== value.status
      )
        value.history = [...value.history, { status: value.status, at: now }];
    }
  }
  const previous = method !== "GET" ? await readSnapshots() : [];
  return new Promise((resolve, reject) => {
    const tx = db.transaction(
        method === "GET" ? [name] : [name, "snapshots"],
        method === "GET" ? "readonly" : "readwrite",
      ),
      store = tx.objectStore(name);
    if (method !== "GET") {
      const snapshots = tx.objectStore("snapshots");
      for (const item of previous.slice(4)) snapshots.delete(item.id);
      snapshots.put({
        id: crypto.randomUUID(),
        exportedAt: new Date().toISOString(),
        properties: structuredClone(properties),
        events: structuredClone(events),
        streets: structuredClone(streets),
      });
    }
    const req =
      method === "GET"
        ? store.getAll()
        : method === "DELETE"
          ? store.delete(path.slice(1))
          : store.put(value);
    let result;
    req.onsuccess = () => (result = req.result);
    tx.oncomplete = () =>
      resolve(
        method === "GET" ? result : method === "DELETE" ? { ok: true } : value,
      );
    tx.onerror = () =>
      reject(
        Error("Speichern fehlgeschlagen. Gerätespeicher möglicherweise voll."),
      );
    tx.onabort = () =>
      reject(Error("Speichern abgebrochen. Bitte Speicherplatz prüfen."));
  });
}
async function readSnapshots() {
  if (!deviceMode) {
    const r = await fetch("/api/snapshots");
    if (!r.ok) throw Error("Sicherungen nicht erreichbar");
    return r.json();
  }
  const db = await localDb();
  return new Promise((resolve, reject) => {
    const req = db.transaction("snapshots").objectStore("snapshots").getAll();
    req.onsuccess = () =>
      resolve(
        req.result.sort((a, b) => b.exportedAt.localeCompare(a.exportedAt)),
      );
    req.onerror = () => reject(Error("Sicherungen nicht lesbar"));
  });
}
function downloadJson(value, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function importBackup(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 150 * 1024 * 1024)
      throw Error("Sicherung zu groß (max. 150 MB).");
    const data = JSON.parse(await file.text());
    if (
      !Array.isArray(data.properties) ||
      (data.events !== undefined && !Array.isArray(data.events)) ||
      (data.streets !== undefined && !Array.isArray(data.streets))
    )
      throw Error("Ungültige Akquise-Sicherung.");
    const objects = data.properties.map((p) => ({
      oldId: p.id,
      data: AkquiseModel.property(p),
    }));
    const streetEntries = (data.streets || []).map((s) => ({
      oldId: s.id,
      data: AkquiseModel.street(s),
    }));
    const appointments = (data.events || []).map((p) => AkquiseModel.event(p));
    if (
      !confirm(
        `${streetEntries.length} Straßen, ${objects.length} Objekte und ${appointments.length} Kalendereinträge zusätzlich importieren? Bestehende Daten bleiben erhalten.`,
      )
    )
      return;
    const ids = new Map();
    let count = 0;
    try {
      const streetIds = new Map();
      for (const s of streetEntries) {
        const saved = await streetsApi("", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(s.data),
        });
        streetIds.set(s.oldId, saved.id);
        streets.push(saved);
        count++;
      }
      for (const p of objects) {
        p.data.streetId = streetIds.get(p.data.streetId) || "";
        const saved = await api("", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(p.data),
        });
        ids.set(p.oldId, saved.id);
        properties.push(saved);
        count++;
      }
      for (const e of appointments) {
        e.objectId = ids.get(e.objectId) || "";
        const saved = await eventsApi("", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(e),
        });
        events.push(saved);
        count++;
      }
    } catch (err) {
      throw Error(
        `${count} Einträge importiert, danach Fehler: ${err.message}. Bitte nicht die ganze Datei erneut importieren, sonst entstehen Duplikate.`,
      );
    } finally {
      [properties, events, streets] = await Promise.all([
        api(),
        eventsApi(),
        streetsApi(),
      ]);
      render();
    }
    toast("Straßen, Objekte und Kalender importiert.");
  } catch (err) {
    toast(err.message);
  } finally {
    e.target.value = "";
  }
}
function dayEntries(day) {
  return [
    ...streets
      .filter((s) => s.status !== "Abgeschlossen" && s.dueDate === day)
      .map((s) => ({
        id: s.id,
        title: s.name + " · " + (s.nextAction || "Wiedervorlage"),
        date: s.dueDate,
        time: "",
        type: "Straßen-Wiedervorlage",
        kind: "street",
      })),
    ...events
      .filter((e) => e.date === day)
      .map((e) => ({ ...e, kind: "event" })),
    ...properties
      .filter((p) => open(p) && p.dueDate === day)
      .map((p) => ({
        id: p.id,
        title: p.nextAction || p.title,
        date: p.dueDate,
        time: "",
        type: "Wiedervorlage",
        objectId: p.id,
        kind: "property",
      })),
  ].sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));
}
function renderCalendar(panel) {
  const first = new Date(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      1,
    ),
    start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7));
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const key = isoDay(d),
      items = dayEntries(key);
    return `<button class="calendar-day ${d.getMonth() !== first.getMonth() ? "muted" : ""} ${key === selectedDay ? "selected" : ""} ${key === today() ? "is-today" : ""}" data-day="${key}" aria-label="${date(key)}, ${items.length} Einträge" aria-pressed="${key === selectedDay}"><strong>${d.getDate()}</strong>${items
      .slice(0, 2)
      .map(
        (e) =>
          `<span class="calendar-chip ${e.done ? "done" : ""}">${escape(e.time)} ${escape(e.title)}</span>`,
      )
      .join(
        "",
      )}${items.length > 2 ? `<small>+${items.length - 2} weitere</small>` : ""}</button>`;
  }).join("");
  const agenda = dayEntries(selectedDay);
  panel.innerHTML = `<div class="calendar-toolbar"><div class="button-group"><button class="secondary" data-month="-1" aria-label="Vorheriger Monat">‹</button><button class="secondary" id="calendar-today">Heute</button><button class="secondary" data-month="1" aria-label="Nächster Monat">›</button></div><h2>${first.toLocaleDateString("de-DE", { month: "long", year: "numeric" })}</h2><button class="primary" id="calendar-add">＋ Eintrag</button></div><div class="calendar-layout"><section class="calendar-board"><div class="calendar-weekdays">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => `<span>${d}</span>`).join("")}</div><div class="calendar-grid">${cells}</div></section><section class="agenda"><div class="panel-heading"><h3>${date(selectedDay)}</h3><button class="text-button" id="ics-export">Kalender exportieren</button></div><p class="map-info">Termine und offene Objekt-Wiedervorlagen</p>${agenda.length ? agenda.map((e) => `<button class="agenda-item ${e.done ? "done" : ""}" data-entry="${e.id}" data-kind="${e.kind}"><span class="agenda-time">${escape(e.time) || "Ganztägig"}</span><span><strong>${escape(e.title)}</strong><small>${escape(e.type)}${e.objectId ? " · " + escape(properties.find((p) => p.id === e.objectId)?.title || "Objekt entfernt") : ""}</small></span></button>`).join("") : '<div class="empty-small">Noch keine Einträge für diesen Tag.<br>Plane einen Termin oder eine Aufgabe.</div>'}</section></div>`;
  panel.querySelectorAll("[data-month]").forEach(
    (b) =>
      (b.onclick = () => {
        calendarMonth = new Date(
          first.getFullYear(),
          first.getMonth() + Number(b.dataset.month),
          1,
        );
        render();
      }),
  );
  $("#calendar-today").onclick = () => {
    selectedDay = today();
    calendarMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );
    render();
  };
  panel.querySelectorAll("[data-day]").forEach(
    (b) =>
      (b.onclick = () => {
        selectedDay = b.dataset.day;
        render();
      }),
  );
  $("#calendar-add").onclick = () => editEvent();
  panel
    .querySelectorAll("[data-entry]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          b.dataset.kind === "street"
            ? editStreet(streets.find((s) => s.id === b.dataset.entry))
            : b.dataset.kind === "property"
              ? edit(properties.find((p) => p.id === b.dataset.entry))
              : editEvent(events.find((e) => e.id === b.dataset.entry))),
    );
  $("#ics-export").onclick = exportIcs;
}
function editEvent(e = null) {
  editingEvent = e?.id || null;
  $("#event-form").reset();
  $("#event-error").textContent = "";
  $("#event-title").textContent = e
    ? "Kalendereintrag bearbeiten"
    : "Neuer Kalendereintrag";
  $("#event-delete").hidden = !e;
  $("#event-object").innerHTML =
    '<option value="">Ohne Objektbezug</option>' +
    properties
      .map((p) => `<option value="${p.id}">${escape(p.title)}</option>`)
      .join("");
  const f = $("#event-form").elements;
  for (const key of [
    "title",
    "date",
    "time",
    "endTime",
    "notes",
    "objectId",
    "type",
  ])
    f[key].value =
      e?.[key] ||
      (key === "date" ? selectedDay : key === "type" ? "Termin" : "");
  f.done.checked = !!e?.done;
  $("#event-editor").showModal();
}
$("#event-close").onclick = $("#event-cancel").onclick = () =>
  $("#event-editor").close();
$("#event-form").onsubmit = async (e) => {
  e.preventDefault();
  $("#event-save").disabled = true;
  try {
    const data = Object.fromEntries(new FormData(e.target));
    data.done = e.target.elements.done.checked;
    const saved = await eventsApi(editingEvent ? "/" + editingEvent : "", {
      method: editingEvent ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    events = events.filter((x) => x.id !== saved.id);
    events.push(saved);
    selectedDay = saved.date;
    calendarMonth = new Date(
      Number(saved.date.slice(0, 4)),
      Number(saved.date.slice(5, 7)) - 1,
      1,
    );
    render();
    $("#event-editor").close();
    toast("Kalendereintrag gespeichert.");
  } catch (err) {
    $("#event-error").textContent = err.message;
  } finally {
    $("#event-save").disabled = false;
  }
};
$("#event-delete").onclick = async () => {
  if (!confirm("Diesen Kalendereintrag löschen?")) return;
  try {
    await eventsApi("/" + editingEvent, { method: "DELETE" });
    events = events.filter((e) => e.id !== editingEvent);
    $("#event-editor").close();
    render();
    toast("Eintrag gelöscht.");
  } catch (err) {
    $("#event-error").textContent = err.message;
  }
};
function exportIcs() {
  const esc = (v) =>
    String(v || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const stamp = (d) => d.replaceAll("-", "");
  const out = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Akquise//Personal Calendar//DE",
    "CALSCALE:GREGORIAN",
  ];
  for (const e of events) {
    out.push(
      "BEGIN:VEVENT",
      "UID:" + e.id + "@akquise",
      "DTSTAMP:" +
        new Date()
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, ""),
      "SUMMARY:" + esc(e.title),
    );
    if (e.time) {
      out.push(
        "DTSTART:" + stamp(e.date) + "T" + e.time.replace(":", "") + "00",
      );
      if (e.endTime)
        out.push(
          "DTEND:" + stamp(e.date) + "T" + e.endTime.replace(":", "") + "00",
        );
    } else out.push("DTSTART;VALUE=DATE:" + stamp(e.date));
    out.push("DESCRIPTION:" + esc(e.notes), "END:VEVENT");
  }
  out.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(
    new Blob(
      [
        out
          .map((line) => {
            let result = "",
              length = 0;
            for (const character of line) {
              const size = new TextEncoder().encode(character).length;
              if (length + size > 75) {
                result += "\r\n ";
                length = 1;
              }
              result += character;
              length += size;
            }
            return result;
          })
          .join("\r\n") + "\r\n",
      ],
      {
        type: "text/calendar;charset=utf-8",
      },
    ),
  );
  a.download = "akquise-kalender.ics";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Kalenderdatei exportiert. Keine automatische Synchronisierung.");
}
async function saveProperty(p) {
  const result = await api("/" + p.id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(p),
  });
  properties = properties.map((x) => (x.id === p.id ? result : x));
  render();
  return result;
}
const quickDialog = document.createElement("dialog");
quickDialog.id = "quick-editor";
quickDialog.innerHTML = `<form id="quick-form"><div class="dialog-head"><h2>Schneller Besuchsabschluss</h2><button type="button" class="icon-button" id="quick-close" aria-label="Besuchsabschluss schließen">×</button></div><div class="form-body"><p id="quick-object"></p><div class="form-grid"><label>Ergebnis<select name="type">${AkquiseModel.activityTypes.map((t) => `<option>${t}</option>`).join("")}</select></label><label>Datum<input name="date" type="date" required></label><label class="full">Information / Gesprächsnotiz<textarea name="note" rows="4" maxlength="10000"></textarea></label><label>Nächste Aktion<input name="nextAction" maxlength="500"></label><label>Wiedervorlage<input name="dueDate" type="date"></label></div><p id="quick-error" role="alert"></p></div><div class="dialog-footer"><button class="primary" id="quick-save">Besuch speichern</button></div></form>`;
document.body.append(quickDialog);
let quickId;
function quickVisit(id, type) {
  const p = properties.find((x) => x.id === id);
  if (!p) return;
  quickId = id;
  $("#quick-form").reset();
  $("#quick-error").textContent = "";
  $("#quick-object").textContent = p.title + " · " + p.address;
  const f = $("#quick-form").elements;
  f.type.value = type;
  f.date.value = today();
  f.nextAction.value = p.nextAction || "";
  f.dueDate.value = p.dueDate || "";
  quickDialog.showModal();
}
$("#quick-close").onclick = () => quickDialog.close();
$("#quick-form").onsubmit = async (e) => {
  e.preventDefault();
  $("#quick-save").disabled = true;
  try {
    const p = structuredClone(properties.find((x) => x.id === quickId)),
      f = e.target.elements;
    const a = {
      type: f.type.value,
      date: f.date.value,
      note: f.note.value.trim(),
    };
    p.activities = [...(p.activities || []), a];
    p.visitDate = a.date;
    p.visitStatus =
      a.type === "Niemand angetroffen" ? "Niemand angetroffen" : "Besucht";
    if (a.type === "Eigentümer getroffen" && p.status === "Neu")
      p.status = "Kontaktiert";
    p.nextAction = f.nextAction.value;
    p.dueDate = f.dueDate.value;
    await saveProperty(p);
    quickDialog.close();
    toast("Besuch und nächster Schritt gespeichert.");
  } catch (err) {
    $("#quick-error").textContent = err.message;
  } finally {
    $("#quick-save").disabled = false;
  }
};
function renderRoute(panel) {
  const routeItems = [...properties, ...streetRouteItems()];
  routeIds = routeIds.filter((id) => routeItems.some((p) => p.id === id));
  const chosen = routeIds.map((id) => routeItems.find((p) => p.id === id));
  const candidates = routeItems.filter(
    (p) => open(p) && p.priority !== "Kein Potenzial",
  );
  panel.innerHTML = `<div class="panel-heading"><div><h2>Heute unterwegs</h2><p class="map-info">Straßen oder Objekte auswählen, Reihenfolge festlegen und zu Fuß navigieren.</p></div><button class="secondary" id="route-clear">Auswahl leeren</button></div><div class="route-layout"><section class="panel"><h3>Straßen & Objekte auswählen</h3><label class="check-label"><input type="checkbox" id="route-unvisited" ${routeOnlyUnvisited ? "checked" : ""}> Nur noch nicht besuchte Objekte</label><div id="route-candidates">${candidates.map((p) => `<label class="route-choice" ${routeOnlyUnvisited && p.visitStatus && p.visitStatus !== "Nicht besucht" ? "hidden" : ""} data-visited="${p.visitStatus && p.visitStatus !== "Nicht besucht"}"><input type="checkbox" data-route-id="${p.id}" ${routeIds.includes(p.id) ? "checked" : ""}><span><strong>${escape(p.title)}</strong><small>${escape(p.address) || "Adresse fehlt"} · ${escape(p.visitStatus || "Nicht besucht")}</small></span></label>`).join("") || '<p class="map-info">Zuerst Objekte erfassen.</p>'}</div></section><section class="panel"><h3>${chosen.length} Stationen ausgewählt</h3>${chosen.map((p, i) => `<div class="route-stop"><b>${i + 1}</b><div><strong>${escape(p.title)}</strong><small>${escape(p.address)}</small><button class="text-button" data-visit="${p.id}">Besuch erfassen</button></div><div class="stop-controls"><button data-move="${i}" data-direction="-1" ${i === 0 ? "disabled" : ""} aria-label="Station nach oben">↑</button><button data-move="${i}" data-direction="1" ${i === chosen.length - 1 ? "disabled" : ""} aria-label="Station nach unten">↓</button></div></div>`).join("")}<div id="route-links"></div><p class="map-info">Google Maps erhält beim Öffnen die ausgewählten Standorte. Reihenfolge manuell, keine automatische Straßenoptimierung. Routen werden in Abschnitte mit maximal vier Stationen geteilt.</p></section></div>`;
  $("#route-clear").onclick = () => {
    routeIds = [];
    saveRoute();
  };
  $("#route-unvisited").onchange = (e) => {
    routeOnlyUnvisited = e.target.checked;
    panel
      .querySelectorAll("[data-visited=true]")
      .forEach((x) => (x.hidden = e.target.checked));
  };
  panel.querySelectorAll("[data-route-id]").forEach(
    (b) =>
      (b.onchange = () => {
        if (b.checked) {
          if (routeIds.length >= 20) {
            b.checked = false;
            toast("Bitte maximal 20 Stationen auswählen.");
            return;
          }
          routeIds.push(b.dataset.routeId);
        } else routeIds = routeIds.filter((x) => x !== b.dataset.routeId);
        saveRoute();
      }),
  );
  panel.querySelectorAll("[data-move]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = Number(b.dataset.move),
          j = i + Number(b.dataset.direction);
        [routeIds[i], routeIds[j]] = [routeIds[j], routeIds[i]];
        saveRoute();
      }),
  );
  panel
    .querySelectorAll("[data-visit]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          b.dataset.visit.startsWith("street:")
            ? editStreet(streets.find((s) => s.id === b.dataset.visit.slice(7)))
            : quickVisit(b.dataset.visit, "Eigentümer getroffen")),
    );
  for (let i = 0; i < chosen.length; i += 4) {
    const segment = chosen.slice(i, i + 4);
    const locations = segment.map((p) =>
      p.lat && p.lng ? p.lat + "," + p.lng : p.address,
    );
    if (locations.some((x) => !x)) {
      const p = document.createElement("p");
      p.textContent = `Abschnitt ${i / 4 + 1}: Bitte fehlende Adressen oder Koordinaten ergänzen.`;
      $("#route-links").append(p);
      continue;
    }
    const params = new URLSearchParams({
      api: "1",
      destination: locations.at(-1),
      travelmode: "walking",
    });
    if (locations.length > 1)
      params.set("waypoints", locations.slice(0, -1).join("|"));
    const a = document.createElement("a");
    a.className = "primary route-link";
    a.textContent =
      chosen.length > 4
        ? `Abschnitt ${i / 4 + 1} in Google Maps öffnen ↗`
        : "Route in Google Maps öffnen ↗";
    a.href = "https://www.google.com/maps/dir/?" + params;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    $("#route-links").append(a);
  }
}
function saveRoute() {
  try {
    localStorage.setItem("akquise-route", JSON.stringify(routeIds));
  } catch {}
  render();
}
function renderTimeline(panel) {
  const log = properties
    .flatMap((p) =>
      (p.activities || []).map((a) => ({
        ...a,
        objectId: p.id,
        title: p.title,
        district: p.district,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  panel.innerHTML = `<div class="panel-heading"><h2>Alle Kontakte & Informationen</h2><select id="timeline-filter" aria-label="Aktivitätenart"><option value="">Alle Aktivitäten</option>${AkquiseModel.activityTypes.map((t) => `<option>${t}</option>`).join("")}</select></div><div id="timeline-rows">${log.map((a) => `<button class="timeline-row" data-log-id="${a.objectId}" data-type="${a.type}"><span class="timeline-dot"></span><div><small>${date(a.date)} · ${escape(a.title)}</small><h3>${escape(a.type)}</h3><p>${escape(a.note) || "Keine zusätzliche Notiz"}</p></div></button>`).join("") || '<div class="empty-small">Noch keine Aktivitäten. Nutze den schnellen Besuchsabschluss am Objekt.</div>'}</div>`;
  $("#timeline-filter").onchange = (e) =>
    panel
      .querySelectorAll("[data-type]")
      .forEach(
        (x) =>
          (x.hidden = !!e.target.value && x.dataset.type !== e.target.value),
      );
  panel.querySelectorAll("[data-log-id]").forEach(
    (b) =>
      (b.onclick = () => {
        edit(properties.find((p) => p.id === b.dataset.logId));
        selectTab("visits");
      }),
  );
}
function renderDistricts(panel) {
  const names = [
    ...new Set(properties.map((p) => p.district || "Nicht zugeordnet")),
  ].sort();
  panel.innerHTML = `<p class="map-info">Gebiete werden im Objekt gepflegt. Der Fortschritt bezieht sich nur auf deine erfassten Objekte.</p><div class="district-grid">${
    names
      .map((name) => {
        const list = properties.filter(
            (p) => (p.district || "Nicht zugeordnet") === name,
          ),
          visited = list.filter(
            (p) => p.visitStatus && p.visitStatus !== "Nicht besucht",
          ).length;
        return `<article class="panel"><h3>${escape(name)}</h3><strong class="big-number">${visited} / ${list.length}</strong><p>Objekte mit dokumentiertem Besuch</p><progress max="${list.length}" value="${visited}" aria-label="Besuchsfortschritt ${escape(name)}"></progress><button class="secondary" data-district="${escape(name)}">Objekte anzeigen</button></article>`;
      })
      .join("") ||
    '<div class="empty-small">Lege im Objekt zuerst ein Gebiet fest.</div>'
  }</div>`;
  panel.querySelectorAll("[data-district]").forEach(
    (b) =>
      (b.onclick = () => {
        goView("all");
        $("#search").value = "";
        $("#status-filter").value = "";
        $("#priority-filter").value = "";
        $("#district-filter").value =
          b.dataset.district === "Nicht zugeordnet"
            ? "__none__"
            : b.dataset.district;
        render();
      }),
  );
}
function renderReports(panel) {
  const all = properties.flatMap((p) => p.activities || []),
    visits = properties.filter(
      (p) => p.visitStatus && p.visitStatus !== "Nicht besucht",
    ).length,
    talks = all.filter((a) =>
      ["Eigentümer getroffen", "Nachbar getroffen", "Telefonat"].includes(
        a.type,
      ),
    ).length;
  panel.innerHTML = `<div class="report-grid"><article class="panel"><span>Besuchte Objekte</span><strong class="big-number">${visits}</strong><small>Mindestens ein Besuch dokumentiert</small></article><article class="panel"><span>Dokumentierte Gespräche</span><strong class="big-number">${talks}</strong><small>Eigentümer, Nachbarn & Telefonate</small></article><article class="panel"><span>Offene Besichtigungstermine</span><strong class="big-number">${events.filter((e) => e.type === "Besichtigung" && !e.done && e.date >= today()).length}</strong><small>Heute und künftig im Kalender</small></article><article class="panel"><span>Gewonnen / erfasste Objekte</span><strong class="big-number">${properties.length ? Math.round((properties.filter((p) => p.status === "Gewonnen").length / properties.length) * 100) : 0}%</strong><small>Anteil am gesamten Bestand</small></article></div><section class="panel"><h3>Akquise nach Status</h3>${statuses
    .map((status) => {
      const n = properties.filter((p) => p.status === status).length;
      return `<div class="report-row"><span>${status}</span><progress value="${n}" max="${Math.max(1, properties.length)}"></progress><strong>${n}</strong></div>`;
    })
    .join(
      "",
    )}</section><section class="panel"><h3>Deine Prioritäten</h3>${AkquiseModel.priorities.map((priority) => `<div class="report-row"><span>${priority}</span><strong>${properties.filter((p) => (p.priority || "Normal") === priority).length}</strong></div>`).join("")}</section>`;
}
let backupRender = 0;
async function renderBackups(panel) {
  const generation = ++backupRender;
  panel.innerHTML = `<section class="panel"><h2>Deine Daten schützen</h2><p>Vor jeder Änderung bleiben die letzten fünf Datenstände automatisch ${deviceMode ? "auf diesem Gerät" : "in der lokalen Datenbank"} erhalten. Diese Kopien schützen vor Änderungen, nicht vor Geräteverlust.</p><div class="button-group"><button class="primary" id="backup-now">Sicherung herunterladen</button><button class="secondary" id="backup-import">Sicherung importieren</button></div><p class="map-info">Sicherung in Dateien / iCloud Drive ablegen. Sie enthält Straßen, persönliche Kontakte, Fotos, Anhänge und den Kalender.</p></section><section class="panel"><h3>Automatische lokale Datenstände</h3><div id="snapshot-list">Wird geladen …</div></section><section class="panel"><h3>Mac & iPhone</h3><p>${deviceMode ? "Dieser Modus speichert auf diesem Gerät." : "Dieser Modus speichert auf dem Mac-Server."} Sicherung exportieren und auf dem anderen Gerät importieren, um Daten manuell zu übertragen.</p><p class="map-info">Automatische Cloud-Sicherung und geräteübergreifende Synchronisierung sind noch nicht verbunden. Dafür fehlt ein gemeinsam erreichbarer, geschützter Datenspeicher. Kalenderexport ist ein einmaliger Transfer, keine Apple-Kalender-Synchronisierung.</p></section>`;
  $("#backup-now").onclick = () => $("#export").click();
  $("#backup-import").onclick = () => $("#import-file").click();
  try {
    const copies = await readSnapshots();
    if (view !== "backup" || generation !== backupRender) return;
    $("#snapshot-list").innerHTML = copies.length
      ? copies
          .map(
            (b, i) =>
              `<div class="snapshot-row"><span>${new Date(b.exportedAt).toLocaleString("de-DE")}<small>${(b.streets || []).length} Straßen · ${b.properties.length} Objekte · ${(b.events || []).length} Kalendereinträge</small></span><button class="secondary" data-snapshot="${i}">Herunterladen</button></div>`,
          )
          .join("")
      : '<p class="map-info">Nach der nächsten gespeicherten Änderung erscheint hier der vorherige Datenstand.</p>';
    panel
      .querySelectorAll("[data-snapshot]")
      .forEach(
        (b) =>
          (b.onclick = () =>
            downloadJson(
              copies[Number(b.dataset.snapshot)],
              "akquise-datenstand.json",
            )),
      );
  } catch (e) {
    if (view === "backup" && generation === backupRender)
      $("#snapshot-list").textContent = e.message;
  }
}
function renderAttachments() {
  $("#attachment-list").innerHTML = attachments
    .map((a, i) => {
      const image = a.data.startsWith("data:image/"),
        audio = a.data.startsWith("data:audio/");
      return `<article class="attachment">${image ? `<img src="${a.data}" alt="${escape(a.name)}" loading="lazy">` : audio ? `<audio controls preload="metadata" src="${a.data}"></audio>` : '<span class="file-symbol">▤</span>'}<div><strong>${escape(a.name)}</strong><a href="${a.data}" download="${escape(a.name)}">Herunterladen</a></div><button type="button" class="icon-button" data-remove-attachment="${i}" aria-label="Anhang entfernen">×</button></article>`;
    })
    .join("");
}
$("#attachment-list").onclick = (e) => {
  const b = e.target.closest("[data-remove-attachment]");
  if (b) {
    attachments.splice(Number(b.dataset.removeAttachment), 1);
    renderAttachments();
  }
};
function readData(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(Error("Datei konnte nicht gelesen werden"));
    r.readAsDataURL(file);
  });
}
async function attachmentFromFile(file) {
  if (file.size > 5 * 1024 * 1024)
    throw Error(file.name + ": maximal 5 MB pro Datei.");
  let data;
  if (["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    const bitmap = await createImageBitmap(file),
      scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    data = canvas.toDataURL("image/jpeg", 0.82);
  } else data = await readData(file);
  return { id: crypto.randomUUID(), name: file.name, data };
}
let attachmentGeneration = 0;
$("#attachments-input").onchange = async (e) => {
  const files = Array.from(e.target.files),
    generation = attachmentGeneration;
  if (!files.length) return;
  loadingAttachments = true;
  $("#save").disabled = true;
  try {
    if (files.length + attachments.length > 30)
      throw Error("Maximal 30 Anhänge pro Objekt.");
    const added = [];
    for (const file of files) added.push(await attachmentFromFile(file));
    if (generation !== attachmentGeneration) return;
    const all = [...attachments, ...added];
    const draft = {
      ...Object.fromEntries(new FormData($("#property-form"))),
      title: $("#property-form").elements.title.value || "Neues Objekt",
      image,
      activities,
      attachments: all,
    };
    AkquiseModel.property(draft);
    attachments = all;
    renderAttachments();
    toast("Dateien vorgemerkt. Bitte Objekt speichern.");
  } catch (err) {
    $("#form-error").textContent = err.message;
  } finally {
    loadingAttachments = false;
    $("#save").disabled = false;
    e.target.value = "";
  }
};
$("#record-audio").onclick = async () => {
  if (recorder?.state === "recording") {
    recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    $("#record-status").textContent =
      "Sprachaufnahme benötigt einen unterstützten Browser und HTTPS. Du kannst eine vorhandene Audiodatei hochladen.";
    return;
  }
  if (attachments.length >= 30) {
    $("#record-status").textContent = "Maximal 30 Anhänge erreicht.";
    return;
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (!$("#editor").open) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    recordStream = stream;
    const mime = ["audio/mp4", "audio/webm", "audio/ogg"].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [],
      generation = attachmentGeneration;
    let size = 0;
    recorder.ondataavailable = (e) => {
      chunks.push(e.data);
      size += e.data.size;
      if (size > 4 * 1024 * 1024 && recorder.state === "recording")
        recorder.stop();
    };
    recorder.onstop = async () => {
      clearTimeout(recordTimer);
      stream.getTracks().forEach((t) => t.stop());
      recordStream = null;
      $("#record-audio").textContent = "● Sprachnotiz aufnehmen";
      try {
        if (generation !== attachmentGeneration) return;
        const blob = new Blob(chunks, { type: recorder.mimeType });
        if (blob.size > 5 * 1024 * 1024)
          throw Error("Aufnahme zu groß. Bitte kürzer aufnehmen.");
        const data = await readData(blob);
        const name =
          "Sprachnotiz " +
          today() +
          (data.startsWith("data:audio/mp4")
            ? ".m4a"
            : data.startsWith("data:audio/ogg")
              ? ".ogg"
              : ".webm");
        const candidate = { id: crypto.randomUUID(), name, data };
        const draft = {
          ...Object.fromEntries(new FormData($("#property-form"))),
          title: $("#property-form").elements.title.value || "Neues Objekt",
          image,
          activities,
          attachments: [...attachments, candidate],
        };
        AkquiseModel.property(draft);
        attachments.push(candidate);
        renderAttachments();
        $("#record-status").textContent =
          "Aufnahme vorgemerkt. Bitte Objekt speichern.";
      } catch (err) {
        $("#record-status").textContent = err.message;
      } finally {
        $("#save").disabled = false;
      }
    };
    recorder.onerror = () => {
      $("#record-status").textContent = "Aufnahme fehlgeschlagen.";
      stream.getTracks().forEach((t) => t.stop());
      $("#save").disabled = false;
    };
    recorder.start(1000);
    $("#save").disabled = true;
    $("#record-audio").textContent = "■ Aufnahme beenden";
    $("#record-status").textContent =
      "Aufnahme läuft, maximal 2 Minuten. Das Mikrofon wird nur für diese Aufnahme verwendet.";
    recordTimer = setTimeout(() => {
      if (recorder?.state === "recording") recorder.stop();
    }, 120000);
  } catch (err) {
    stream?.getTracks().forEach((t) => t.stop());
    $("#record-status").textContent =
      "Mikrofon nicht verfügbar oder Freigabe abgelehnt.";
    $("#save").disabled = false;
  }
};
$("#editor").addEventListener("close", () => {
  attachmentGeneration++;
  if (recorder?.state === "recording") recorder.stop();
  recordStream?.getTracks().forEach((t) => t.stop());
  clearTimeout(recordTimer);
  $("#save").disabled = false;
});
