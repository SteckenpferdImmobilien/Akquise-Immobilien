let editingStreet = null,
  streetSearch = "",
  streetStatus = "";
const streetStatuses = [
  "Geplant",
  "In Bearbeitung",
  "Abgeschlossen",
  "Erneut besuchen",
];
async function streetsApi(path = "", options = {}) {
  if (deviceMode) return deviceCollection("streets", path, options);
  const r = await fetch("/api/streets" + path, options),
    data = await r.json();
  if (!r.ok)
    throw Error(data.error || "Straßen konnten nicht gespeichert werden");
  return data;
}
function fillStreetSelect(id = "") {
  const select = $("#property-street");
  select.innerHTML =
    '<option value="">Keine Straße zugeordnet</option>' +
    streets
      .map(
        (s) =>
          `<option value="${s.id}">${escape(s.name)} · ${escape(s.city)}</option>`,
      )
      .join("");
  if (id && !streets.some((s) => s.id === id)) {
    select.add(
      new Option("Straße wurde gelöscht – Zuordnung kann entfernt werden", id),
    );
  }
  select.value = id;
}
function streetAddress(s) {
  return `${s.name}, ${s.city}`;
}
function streetRange(s) {
  return s.houseFrom || s.houseTo
    ? `Hausnummern ${s.houseFrom || "Anfang"} bis ${s.houseTo || "Ende"} · ${s.side}`
    : `Ganze Straße · ${s.side}`;
}
function streetRouteItems() {
  return streets.map((s) => ({
    id: "street:" + s.id,
    title: "Straße: " + s.name,
    address: streetAddress(s),
    lat: s.lat,
    lng: s.lng,
    priority: s.priority,
    status: s.status === "Abgeschlossen" ? "Gewonnen" : "Neu",
    visitStatus:
      s.status === "Geplant"
        ? "Nicht besucht"
        : s.status === "Erneut besuchen"
          ? "Erneut besuchen"
          : "Besucht",
  }));
}
function renderStreets(panel) {
  panel.innerHTML = `<div class="street-summary"><article><span>Straßen gesamt</span><strong>${streets.length}</strong></article><article><span>In Bearbeitung</span><strong>${streets.filter((s) => s.status === "In Bearbeitung").length}</strong></article><article><span>Abgeschlossen</span><strong>${streets.filter((s) => s.status === "Abgeschlossen").length}</strong></article><article><span>Wiedervorlagen fällig</span><strong>${streets.filter((s) => s.status !== "Abgeschlossen" && s.dueDate && s.dueDate <= today()).length}</strong></article></div><div class="panel-heading"><div><h2>Straßenzüge statt einzelner Adressen</h2><p class="map-info">Eine ganze Straße planen oder einen Abschnitt mit Hausnummern festlegen.</p></div><button class="primary" id="new-street">＋ Straße hinzufügen</button></div><div class="filters"><label class="search"><input id="street-search" type="search" placeholder="Straße, Ort oder Notizen suchen …" aria-label="Straßen durchsuchen" value="${escape(streetSearch)}"></label><select id="street-status-filter" aria-label="Straßenstatus filtern"><option value="">Alle Straßenstatus</option>${streetStatuses.map((s) => `<option>${s}</option>`).join("")}</select></div><div id="street-list" class="street-list"></div>`;
  $("#street-status-filter").value = streetStatus;
  $("#new-street").onclick = () => editStreet();
  $("#street-search").oninput = (e) => {
    streetSearch = e.target.value;
    renderStreetList();
  };
  $("#street-status-filter").onchange = (e) => {
    streetStatus = e.target.value;
    renderStreetList();
  };
  renderStreetList();
}
function renderStreetList() {
  const list = streets
    .filter(
      (s) =>
        (!streetStatus || s.status === streetStatus) &&
        [s.name, s.city, s.district, s.notes, s.nextAction]
          .join(" ")
          .toLocaleLowerCase("de")
          .includes(streetSearch.toLocaleLowerCase("de")),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
  $("#street-list").innerHTML =
    list
      .map((s) => {
        const total = Number(s.totalCount),
          visited = Number(s.visitedCount || 0),
          linked = properties.filter((p) => p.streetId === s.id).length;
        return `<article class="panel street-card"><div class="panel-heading"><div><span class="street-state">${escape(s.status)} · ${escape(s.priority)}</span><h3>${escape(s.name)}</h3><p>${escape(s.city)}${s.district ? " · " + escape(s.district) : ""}</p></div><button class="secondary" data-street-edit="${s.id}">Bearbeiten</button></div><p>${escape(streetRange(s))}</p><div class="street-progress"><strong>${visited}${total ? " / " + total : ""}</strong><span>Häuser besucht · manuell erfasst</span></div>${total ? `<progress value="${visited}" max="${total}" aria-label="Besuchsfortschritt ${escape(s.name)}"></progress>` : ""}<p class="street-note">${escape(s.notes) || "Noch keine Straßennotiz."}</p><div class="street-followup"><span>${escape(s.nextAction) || "Nächsten Schritt planen"}</span><span class="${s.dueDate && s.dueDate <= today() && s.status !== "Abgeschlossen" ? "overdue" : ""}">${s.dueDate ? date(s.dueDate) : "Kein Termin"}</span></div><div class="street-actions"><button class="secondary" data-street-plus="${s.id}" ${total && visited >= total ? "disabled" : ""}>＋ Haus besucht</button><button class="secondary" data-street-object="${s.id}">＋ Objekt zuordnen</button><button class="text-button" data-street-linked="${s.id}">${linked} verknüpfte Objekte</button></div></article>`;
      })
      .join("") ||
    '<div class="empty-small">Noch keine passenden Straßen. Lege deinen ersten Straßenzug an.</div>';
  $("#street-list").onclick = async (e) => {
    const editButton = e.target.closest("[data-street-edit]"),
      plus = e.target.closest("[data-street-plus]"),
      obj = e.target.closest("[data-street-object]"),
      linked = e.target.closest("[data-street-linked]");
    if (editButton)
      editStreet(streets.find((s) => s.id === editButton.dataset.streetEdit));
    if (plus) {
      plus.disabled = true;
      try {
        const s = structuredClone(
          streets.find((s) => s.id === plus.dataset.streetPlus),
        );
        s.visitedCount = String(Number(s.visitedCount || 0) + 1);
        s.visitDate = today();
        if (s.status === "Geplant") s.status = "In Bearbeitung";
        await saveStreet(s);
        toast("Ein weiterer Hausbesuch erfasst.");
      } catch (err) {
        plus.disabled = false;
        toast(err.message);
      }
    }
    if (obj) {
      const s = streets.find((s) => s.id === obj.dataset.streetObject);
      edit();
      const f = $("#property-form").elements;
      f.streetId.value = s.id;
      f.address.value = streetAddress(s);
      f.district.value = s.district;
      updateRoute();
    }
    if (linked) showStreetObjects(linked.dataset.streetLinked);
  };
}
async function saveStreet(s) {
  const saved = await streetsApi("/" + s.id, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(s),
  });
  streets = streets.map((x) => (x.id === saved.id ? saved : x));
  render();
  return saved;
}
const streetDialog = document.createElement("dialog");
streetDialog.id = "street-editor";
streetDialog.innerHTML = `<form id="street-form"><div class="dialog-head"><div><span class="eyebrow">STRAßENAKQUISE</span><h2 id="street-editor-title">Neue Straße</h2></div><button type="button" class="icon-button" id="street-close" aria-label="Straßendialog schließen">×</button></div><div class="form-body"><div class="form-grid"><label class="full">Straßenname *<input name="name" required maxlength="200" placeholder="z. B. Podbielskistraße"></label><label>Ort / PLZ *<input name="city" required maxlength="200" placeholder="z. B. 30163 Hannover"></label><label>Gebiet / Stadtteil<input name="district" maxlength="200" placeholder="z. B. List"></label><label>Hausnummer von (optional)<input name="houseFrom" maxlength="30" placeholder="z. B. 1"></label><label>Hausnummer bis (optional)<input name="houseTo" maxlength="30" placeholder="z. B. 85a"></label><label>Straßenseite<select name="side"><option>Beide Seiten</option><option>Gerade Hausnummern</option><option>Ungerade Hausnummern</option></select></label><label>Status<select name="status">${streetStatuses.map((s) => `<option>${s}</option>`).join("")}</select></label><label>Priorität<select name="priority">${AkquiseModel.priorities.map((s) => `<option>${s}</option>`).join("")}</select></label><label>Letzter Rundgang<input name="visitDate" type="date"></label><label>Häuser gesamt (optional)<input name="totalCount" type="number" min="0" max="10000" step="1"></label><label>Davon besucht<input name="visitedCount" type="number" min="0" max="10000" step="1" value="0"></label><label>Nächste Aktion<input name="nextAction" maxlength="500" placeholder="z. B. Hausnummern 20–40 ablaufen"></label><label>Wiedervorlage<input name="dueDate" type="date"></label><label class="full">Notizen & Informationen<textarea name="notes" rows="4" maxlength="20000" placeholder="Wo warst du schon? Was hast du von Nachbarn erfahren?"></textarea></label></div><p class="map-info">Ohne Hausnummern gilt die ganze Straße. Die Hausanzahl wird nicht automatisch aus dem Nummernbereich berechnet. Verknüpfte Objekte werden separat gezählt.</p><h3>Startpunkt auf der Karte (optional)</h3><div class="form-grid"><label>Breitengrad<input name="lat" inputmode="decimal"></label><label>Längengrad<input name="lng" inputmode="decimal"></label></div><button type="button" class="secondary" id="street-locate">Straße suchen</button><p class="map-info">Die Suche sendet Straßenname und Ort an OpenStreetMap/Nominatim. Die Markierung ist ein Startpunkt, keine Darstellung der gesamten Straßenlänge.</p><div id="street-geo-results" role="status"></div><p id="street-error" role="alert"></p></div><div class="dialog-footer"><button type="button" id="street-delete" class="danger" hidden>Straße löschen</button><button type="button" id="street-cancel" class="secondary">Abbrechen</button><button class="primary" id="street-save">Straße speichern</button></div></form>`;
document.body.append(streetDialog);
function editStreet(s = null) {
  editingStreet = s?.id || null;
  $("#street-form").reset();
  $("#street-error").textContent = "";
  $("#street-geo-results").textContent = "";
  $("#street-delete").hidden = !s;
  $("#street-editor-title").textContent = s
    ? "Straße bearbeiten"
    : "Neue Straße";
  if (s)
    for (const key of Object.keys(AkquiseModel.street(s)))
      $("#street-form").elements[key].value = s[key] || "";
  streetDialog.showModal();
}
$("#street-close").onclick = $("#street-cancel").onclick = () =>
  streetDialog.close();
$("#street-form").onsubmit = async (e) => {
  e.preventDefault();
  $("#street-save").disabled = true;
  try {
    const saved = await streetsApi(editingStreet ? "/" + editingStreet : "", {
      method: editingStreet ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(e.target))),
    });
    streets = streets.filter((s) => s.id !== saved.id);
    streets.unshift(saved);
    render();
    streetDialog.close();
    toast("Straße gespeichert.");
  } catch (err) {
    $("#street-error").textContent = err.message;
  } finally {
    $("#street-save").disabled = false;
  }
};
$("#street-delete").onclick = async () => {
  if (
    !confirm(
      "Diese Straßenplanung löschen? Einzelne zugeordnete Immobilien bleiben erhalten.",
    )
  )
    return;
  try {
    await streetsApi("/" + editingStreet, { method: "DELETE" });
    streets = streets.filter((s) => s.id !== editingStreet);
    streetDialog.close();
    render();
    toast("Straßenplanung gelöscht. Die Immobilien bleiben erhalten.");
  } catch (err) {
    $("#street-error").textContent = err.message;
  }
};
$("#street-locate").onclick = async () => {
  const f = $("#street-form").elements;
  if (!f.name.value.trim() || !f.city.value.trim()) {
    $("#street-geo-results").textContent = "Bitte Straße und Ort eingeben.";
    return;
  }
  $("#street-locate").disabled = true;
  try {
    const q = f.name.value + ", " + f.city.value;
    const url = deviceMode
      ? "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=de&q=" +
        encodeURIComponent(q)
      : "/api/geocode?q=" + encodeURIComponent(q);
    const r = await fetch(url, {
      headers: { "Accept-Language": "de" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok)
      throw Error(
        "Straßensuche derzeit nicht erreichbar. Du kannst die Position auch direkt als Koordinaten eintragen.",
      );
    let rows = await r.json();
    if (deviceMode)
      rows = rows.map((x) => ({
        lat: x.lat,
        lng: x.lon,
        label: x.display_name,
      }));
    $("#street-geo-results").textContent = rows.length
      ? "Treffer auswählen:"
      : "Kein Treffer gefunden.";
    for (const row of rows) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "geo-result";
      b.textContent = row.label;
      b.onclick = () => {
        f.lat.value = row.lat;
        f.lng.value = row.lng;
        $("#street-geo-results").textContent =
          "Startpunkt übernommen. Bitte Straße speichern.";
      };
      $("#street-geo-results").append(b);
    }
  } catch (err) {
    $("#street-geo-results").textContent = err.message;
  } finally {
    $("#street-locate").disabled = false;
  }
};
function renderStreetMarkers() {
  const q = $("#search").value.toLocaleLowerCase("de"),
    district = $("#district-filter").value,
    priority = $("#priority-filter").value;
  for (const s of streets) {
    if (
      ![s.name, s.city, s.district, s.notes]
        .join(" ")
        .toLocaleLowerCase("de")
        .includes(q) ||
      (priority && s.priority !== priority) ||
      (district &&
        (district === "__none__" ? !!s.district : s.district !== district))
    )
      continue;
    const visit =
      s.status === "Geplant"
        ? "Nicht besucht"
        : s.status === "Erneut besuchen"
          ? "Erneut besuchen"
          : "Besucht";
    if ($("#visit-filter").value && $("#visit-filter").value !== visit)
      continue;
    if (!s.lat || !s.lng) continue;
    const popup = document.createElement("div"),
      title = document.createElement("strong"),
      detail = document.createElement("p"),
      b = document.createElement("button");
    title.textContent = "Straßenakquise: " + s.name;
    detail.textContent = s.status + " · " + streetRange(s) + " · Startpunkt";
    b.type = "button";
    b.className = "secondary";
    b.textContent = "Straße bearbeiten";
    b.onclick = () => editStreet(s);
    popup.append(title, detail, b);
    L.circleMarker([Number(s.lat), Number(s.lng)], {
      radius: 14,
      color: "#78613a",
      weight: 3,
      dashArray: "5 3",
      fillColor: s.status === "Abgeschlossen" ? "#d1b980" : "#fffdf7",
      fillOpacity: 1,
    })
      .addTo(markers)
      .bindPopup(popup);
  }
}
const linkedDialog = document.createElement("dialog");
linkedDialog.id = "street-objects";
document.body.append(linkedDialog);
function showStreetObjects(id) {
  const s = streets.find((s) => s.id === id),
    list = properties.filter((p) => p.streetId === id);
  linkedDialog.innerHTML = `<div class="dialog-head"><h2>Objekte · ${escape(s.name)}</h2><button class="icon-button" id="linked-close" aria-label="Objektliste schließen">×</button></div><div class="form-body">${list.map((p) => `<button class="agenda-item" data-linked-object="${p.id}"><strong>${escape(p.title)}</strong><small>${escape(p.address)}</small></button>`).join("") || '<p class="map-info">Noch keine einzelnen Objekte zugeordnet. Die Straße lässt sich trotzdem als Ganzes bearbeiten.</p>'}</div>`;
  $("#linked-close").onclick = () => linkedDialog.close();
  linkedDialog.querySelectorAll("[data-linked-object]").forEach(
    (b) =>
      (b.onclick = () => {
        linkedDialog.close();
        edit(properties.find((p) => p.id === b.dataset.linkedObject));
      }),
  );
  linkedDialog.showModal();
}
function renderStreetReminders() {
  const planned = streets
    .filter((s) => s.status !== "Abgeschlossen" && s.dueDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const container = $("#street-reminders");
  container.hidden = view !== "tasks" || !planned.length;
  $("#task-count").textContent =
    properties.filter(due).length +
    planned.filter((s) => s.dueDate <= today()).length;
  $("#due").textContent =
    properties.filter(due).length +
    planned.filter((s) => s.dueDate <= today()).length;
  if (container.hidden) return;
  container.innerHTML =
    '<section class="panel"><h3>Straßen-Wiedervorlagen</h3>' +
    planned
      .map(
        (s) =>
          `<button class="agenda-item" data-street-reminder="${s.id}"><span class="${s.dueDate <= today() ? "overdue" : ""}">${date(s.dueDate)}</span><span><strong>${escape(s.name)}</strong><small>${escape(s.nextAction) || "Rundgang planen"}</small></span></button>`,
      )
      .join("") +
    "</section>";
  container
    .querySelectorAll("[data-street-reminder]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          editStreet(streets.find((s) => s.id === b.dataset.streetReminder))),
    );
}
init();
