const $ = (s) => document.querySelector(s);
const statuses = [
  "Neu",
  "Kontaktiert",
  "Termin vereinbart",
  "In Verhandlung",
  "Gewonnen",
  "Abgesagt",
];
const types = [
  "Wohnung",
  "Einfamilienhaus",
  "Mehrfamilienhaus",
  "Grundstück",
  "Gewerbe",
  "Sonstiges",
];
let properties = [],
  editing = null,
  image = "",
  view = "all",
  loadingPhoto = false,
  activities = [],
  attachments = [],
  events = [],
  map,
  markers,
  deviceMode = document.body.dataset.storage === "device";
const escape = (s) =>
  String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const open = (p) => !["Gewonnen", "Abgesagt"].includes(p.status);
const due = (p) => open(p) && p.dueDate && p.dueDate <= today();
const date = (s) =>
  s
    ? new Date(s + "T12:00:00").toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "";
$("#today").textContent = new Date().toLocaleDateString("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
for (const s of statuses) {
  $("#status").add(new Option(s, s));
  $("#status-filter").add(new Option(s, s));
}
for (const t of types) $("#type").add(new Option(t, t));
async function api(path = "", options = {}) {
  if (deviceMode) return deviceApi(path, options);
  const res = await fetch("/api/properties" + path, options);
  const body = await res.json();
  if (!res.ok) throw Error(body.error || "Anfrage fehlgeschlagen");
  return body;
}
function toast(message) {
  $("#toast").textContent = message;
  $("#toast").hidden = false;
  setTimeout(() => ($("#toast").hidden = true), 3500);
}
function render() {
  $("#total").textContent = properties.length;
  $("#active").textContent = properties.filter(open).length;
  $("#due").textContent = properties.filter(due).length;
  $("#won").textContent = properties.filter(
    (p) => p.status === "Gewonnen",
  ).length;
  $("#task-count").textContent = properties.filter(due).length;
  const q = $("#search").value.toLocaleLowerCase("de");
  const status = $("#status-filter").value;
  const priority = $("#priority-filter").value;
  const district = $("#district-filter").value;
  let list = properties.filter(
    (p) =>
      (view !== "tasks" || (open(p) && p.dueDate)) &&
      (!status || p.status === status) &&
      (!priority || (p.priority || "Normal") === priority) &&
      (!district ||
        (district === "__none__" ? !p.district : p.district === district)) &&
      [
        p.title,
        p.address,
        p.owner,
        p.notes,
        p.nextAction,
        p.district,
        p.priority,
        ...(p.activities || []).map((a) => a.note),
      ]
        .join(" ")
        .toLocaleLowerCase("de")
        .includes(q),
  );
  list.sort((a, b) =>
    $("#sort").value === "name"
      ? a.title.localeCompare(b.title, "de")
      : $("#sort").value === "due" || view === "tasks"
        ? (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
        : b.createdAt.localeCompare(a.createdAt),
  );
  list = list.filter(
    (p) =>
      !$("#visit-filter").value ||
      (p.visitStatus || "Nicht besucht") === $("#visit-filter").value,
  );
  $("#map-panel").hidden = view !== "map";
  $("#cards").hidden = view === "map";
  if (view === "map") renderMap(list);
  renderWorkspace();
  $("#result-count").textContent =
    `${list.length} ${list.length === 1 ? "Objekt" : "Objekte"}`;
  $("#cards").innerHTML = list
    .map(
      (p) =>
        `<article class="card" tabindex="0" role="button" aria-label="${escape(p.title)} bearbeiten" data-id="${p.id}"><div class="photo">${p.image ? `<img src="${p.image}" alt="${escape(p.title)}" loading="lazy">` : '<div class="placeholder" aria-hidden="true">⌂</div>'}<span class="badge ${p.status === "Gewonnen" ? "won" : p.status === "Abgesagt" ? "lost" : ""}">${escape(p.status)}</span></div><div class="card-body"><div class="priority-line">${escape(p.priority || "Normal")} · ${escape(p.district || "Kein Gebiet")}</div><div class="visit-label">${escape(p.visitStatus || "Nicht besucht")}${p.visitDate ? " · " + date(p.visitDate) : ""}</div><div class="object-type">${escape(p.type)}${p.price ? " · " + escape(p.price) + " €" : ""}</div><h3>${escape(p.title)}</h3><div class="address">${escape(p.address) || "Adresse noch offen"}</div><div class="contact"><span class="avatar">${escape(
          (p.owner || "?")
            .split(" ")
            .map((x) => x[0])
            .slice(0, 2)
            .join(""),
        )}</span>${escape(p.owner) || "Noch kein Kontakt hinterlegt"}</div><div class="next"><span>${escape(p.nextAction) || "Nächsten Schritt planen"}</span><span class="${due(p) ? "overdue" : ""}">${p.dueDate ? (p.dueDate === today() ? "Heute" : date(p.dueDate)) : "Kein Termin"}</span></div><div class="quick-actions"><button type="button" data-quick="Niemand angetroffen" data-object="${p.id}">Niemand da</button><button type="button" data-quick="Nachbar getroffen" data-object="${p.id}">Nachbar</button><button type="button" data-quick="Eigentümer getroffen" data-object="${p.id}">Eigentümer</button></div></div></article>`,
    )
    .join("");
  $("#empty").hidden = list.length > 0 || view === "map";
  $("#empty h3").textContent = properties.length
    ? "Keine passenden Objekte."
    : "Platz für deine nächste Chance.";
  $("#empty p").textContent = properties.length
    ? "Passe deine Suche an oder lege ein neues Objekt an."
    : "Erfasse dein erstes Objekt mit Foto, Kontakt und nächstem Schritt.";
  $("#empty-add").textContent = properties.length
    ? "Objekt hinzufügen"
    : "Erstes Objekt hinzufügen";
}
function updatePhoto() {
  $("#photo-preview").hidden = !image;
  $("#photo-preview").src = image || "";
  $("#photo-text").hidden = !!image;
  $("#remove-photo").hidden = !image;
}
function edit(p = null) {
  editing = p?.id || null;
  image = p?.image || "";
  $("#property-form").reset();
  $("#form-error").textContent = "";
  $("#editor-title").textContent = p ? "Objekt bearbeiten" : "Neues Objekt";
  $("#delete").hidden = !p;
  for (const field of [
    "title",
    "address",
    "owner",
    "phone",
    "email",
    "url",
    "notes",
    "nextAction",
    "dueDate",
    "status",
    "type",
    "price",
    "visitStatus",
    "visitDate",
    "lat",
    "lng",
    "district",
    "priority",
  ])
    if (p) $("#property-form").elements[field].value = p[field] || "";
  $("#history").innerHTML = p
    ? "<strong>Statusverlauf</strong><br>" +
      p.history
        .map((h) => `${date(h.at.slice(0, 10))} · ${escape(h.status)}`)
        .join("<br>")
    : "";
  $("#record-status").textContent = "";
  attachments = structuredClone(p?.attachments || []);
  renderAttachments();
  activities = structuredClone(p?.activities || []);
  $("#activity-date").value = today();
  $("#activity-note").value = "";
  $("#geo-results").textContent = "";
  renderActivities();
  selectTab("object");
  updateRoute();
  updatePhoto();
  $("#editor").showModal();
}
$("#add").onclick = () => edit();
$("#empty-add").onclick = () => edit();
document
  .querySelectorAll(".close")
  .forEach((b) => (b.onclick = () => $("#editor").close()));
$("#cards").onclick = (e) => {
  const quick = e.target.closest("[data-quick]");
  if (quick) {
    quickVisit(quick.dataset.object, quick.dataset.quick);
    return;
  }
  const c = e.target.closest("[data-id]");
  if (c) edit(properties.find((p) => p.id === c.dataset.id));
};
$("#cards").onkeydown = (e) => {
  if ((e.key === "Enter" || e.key === " ") && e.target.matches("[data-id]")) {
    e.preventDefault();
    e.target.click();
  }
};
$("#search").oninput = render;
$("#status-filter").onchange = render;
$("#sort").onchange = render;
$("#priority-filter").onchange = render;
$("#district-filter").onchange = render;
document.querySelectorAll("[data-view]").forEach(
  (b) =>
    (b.onclick = () => {
      setMenu(false);
      view = b.dataset.view;
      document
        .querySelectorAll("[data-view]")
        .forEach((x) => x.classList.toggle("active", x === b));
      $("#page-title").textContent =
        view === "map"
          ? "Dein Akquisegebiet."
          : view === "tasks"
            ? "Dein nächster Schritt."
            : "Alles im Blick.";
      $("#list-title").textContent =
        view === "map"
          ? "Gebäude & Besuche"
          : view === "tasks"
            ? "Anstehende Wiedervorlagen"
            : "Deine Immobilien";
      render();
    }),
);
$("#remove-photo").onclick = () => {
  image = "";
  $("#photo").value = "";
  updatePhoto();
};
$("#photo").onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  $("#form-error").textContent = "";
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 10 * 1024 * 1024
  ) {
    $("#form-error").textContent =
      "Bitte JPG, PNG oder WebP mit maximal 10 MB auswählen.";
    e.target.value = "";
    return;
  }
  loadingPhoto = true;
  $("#save").disabled = true;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    image = canvas.toDataURL("image/jpeg", 0.82);
    bitmap.close();
    updatePhoto();
  } catch {
    $("#form-error").textContent = "Das Bild konnte nicht gelesen werden.";
  } finally {
    loadingPhoto = false;
    $("#save").disabled = false;
  }
};
$("#property-form").addEventListener(
  "invalid",
  (e) => {
    const pane = e.target.closest("[data-pane]");
    if (pane) selectTab(pane.dataset.pane);
  },
  true,
);
$("#property-form").onsubmit = async (e) => {
  e.preventDefault();
  if (loadingPhoto || loadingAttachments || recorder?.state === "recording")
    return;
  $("#save").disabled = true;
  $("#form-error").textContent = "";
  try {
    const data = Object.fromEntries(new FormData(e.target));
    data.image = image;
    data.activities = activities;
    data.attachments = attachments;
    const saved = await api(editing ? "/" + editing : "", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    properties = properties.filter((p) => p.id !== saved.id);
    properties.unshift(saved);
    render();
    $("#editor").close();
    toast("Objekt gespeichert.");
  } catch (err) {
    $("#form-error").textContent = err.message;
  } finally {
    $("#save").disabled = false;
  }
};
$("#delete").onclick = async () => {
  if (!confirm("Dieses Objekt mit Foto und Notizen endgültig löschen?")) return;
  try {
    await api("/" + editing, { method: "DELETE" });
    properties = properties.filter((p) => p.id !== editing);
    $("#editor").close();
    render();
    toast("Objekt gelöscht.");
  } catch (err) {
    $("#form-error").textContent = err.message;
  }
};
$("#export").onclick = () => {
  const blob = new Blob(
    [
      JSON.stringify(
        { exportedAt: new Date().toISOString(), properties, events },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `akquise-sicherung-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Sicherung mit Fotos heruntergeladen.");
};
async function init() {
  if (deviceMode) {
    $("#storage-info").hidden = false;
    if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("./sw.js").catch(() => {
        $("#storage-info").textContent =
          "Offline-Speicherung aktiv; Offline-Start konnte nicht eingerichtet werden. Bitte HTTPS verwenden.";
      });
  }
  try {
    [properties, events] = await Promise.all([api(), eventsApi()]);
    render();
  } catch (err) {
    $("#notice").textContent =
      "Verbindung fehlgeschlagen. Bitte Seite neu laden. " + err.message;
  }
}

function selectTab(name) {
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) =>
      b.setAttribute("aria-selected", String(b.dataset.tab === name)),
    );
  document
    .querySelectorAll("[data-pane]")
    .forEach((p) => (p.hidden = p.dataset.pane !== name));
}
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => (b.onclick = () => selectTab(b.dataset.tab)));
function renderActivities() {
  $("#activities").innerHTML = activities
    .map(
      (a, i) =>
        `<article class="activity"><div><strong>${escape(a.type)}</strong><small>${date(a.date)}</small><p>${escape(a.note)}</p></div><button type="button" class="icon-button" data-remove="${i}" aria-label="Aktivität entfernen">×</button></article>`,
    )
    .reverse()
    .join("");
}
$("#add-activity").onclick = () => {
  if (!$("#activity-date").value) {
    toast("Bitte ein Datum angeben.");
    return;
  }
  activities.push({
    type: $("#activity-type").value,
    date: $("#activity-date").value,
    note: $("#activity-note").value.trim(),
  });
  $("#activity-note").value = "";
  renderActivities();
};
$("#activities").onclick = (e) => {
  const b = e.target.closest("[data-remove]");
  if (b) {
    activities.splice(Number(b.dataset.remove), 1);
    renderActivities();
  }
};
function updateRoute() {
  const f = $("#property-form").elements;
  const query =
    f.lat.value && f.lng.value
      ? f.lat.value + "," + f.lng.value
      : f.address.value;
  $("#google-route").href =
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(query || "Hannover");
}
$("#property-form").elements.address.addEventListener("input", updateRoute);
$("#locate").onclick = async () => {
  const address = $("#property-form").elements.address.value.trim();
  if (address.length < 5) {
    $("#geo-results").textContent =
      "Bitte zuerst die vollständige Adresse eingeben.";
    return;
  }
  $("#locate").disabled = true;
  $("#geo-results").textContent = "Adresse wird gesucht …";
  try {
    let results;
    if (deviceMode) {
      const res = await fetch(
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=de&q=" +
          encodeURIComponent(address),
        { headers: { "Accept-Language": "de" } },
      );
      if (!res.ok)
        throw Error(
          "Adresssuche nicht verfügbar. Nutze stattdessen die Kartenposition.",
        );
      results = (await res.json()).map((x) => ({
        label: x.display_name,
        lat: x.lat,
        lng: x.lon,
      }));
    } else {
      const res = await fetch("./api/geocode?q=" + encodeURIComponent(address));
      results = await res.json();
      if (!res.ok) throw Error(results.error);
    }
    $("#geo-results").textContent = results.length
      ? "Bitte den passenden Treffer auswählen:"
      : "Keine Adresse gefunden. Position auf der Karte setzen.";
    for (const result of results) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "geo-result";
      button.textContent = result.label;
      button.onclick = () => {
        const f = $("#property-form").elements;
        f.lat.value = result.lat;
        f.lng.value = result.lng;
        updateRoute();
        $("#geo-results").textContent =
          "Position übernommen. Mit Objekt speichern bestätigen.";
      };
      $("#geo-results").append(button);
    }
  } catch (e) {
    $("#geo-results").textContent = e.message;
  } finally {
    $("#locate").disabled = false;
  }
};
$("#visit-filter").onchange = render;
$("#hannover").onclick = () => map?.setView([52.3759, 9.732], 14);
function renderMap(list) {
  if (!map) {
    map = L.map("map").setView([52.3759, 9.732], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markers = L.layerGroup().addTo(map);
    map.on("click", (e) => {
      edit();
      const f = $("#property-form").elements;
      f.lat.value = e.latlng.lat.toFixed(6);
      f.lng.value = e.latlng.lng.toFixed(6);
      updateRoute();
    });
  }
  setTimeout(() => map.invalidateSize(), 0);
  markers.clearLayers();
  let missing = 0;
  for (const p of list) {
    if (!p.lat || !p.lng) {
      missing++;
      continue;
    }
    const status = p.visitStatus || "Nicht besucht";
    const color =
      status === "Besucht"
        ? "#d1b980"
        : status === "Nicht besucht"
          ? "#1c1d18"
          : "#fffdf7";
    const marker = L.circleMarker([Number(p.lat), Number(p.lng)], {
      radius: 10,
      color: status === "Nicht besucht" ? "#d1b980" : "#78613a",
      dashArray: !["Besucht", "Nicht besucht"].includes(status)
        ? "3 3"
        : undefined,
      weight: 3,
      fillColor: color,
      fillOpacity: 1,
    }).addTo(markers);
    const box = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = p.title;
    box.append(heading);
    const detail = document.createElement("p");
    detail.textContent = status + " · " + p.address;
    box.append(detail);
    const button = document.createElement("button");
    button.className = "secondary";
    button.textContent = "Besuch / Objekt bearbeiten";
    button.onclick = () => edit(p);
    box.append(button);
    marker.bindPopup(box);
  }
  $("#unmapped").textContent = missing
    ? `${missing} Objekt(e) ohne Kartenposition. Im Objekt unter „Position auf der Karte“ die Adresse suchen.`
    : "";
}
let deviceDb;
async function localDb() {
  if (!deviceDb)
    deviceDb = new Promise((resolve, reject) => {
      const req = indexedDB.open("akquise-device", 2);
      req.onupgradeneeded = () => {
        for (const name of ["properties", "events", "snapshots"])
          if (!req.result.objectStoreNames.contains(name))
            req.result.createObjectStore(name, { keyPath: "id" });
      };
      req.onblocked = () =>
        toast(
          "Bitte andere geöffnete Akquise-Fenster schließen, damit das Update gespeichert werden kann.",
        );
      req.onsuccess = () => {
        req.result.onversionchange = () => {
          req.result.close();
          location.reload();
        };
        resolve(req.result);
      };
      req.onerror = () => reject(Error("Gerätespeicher nicht verfügbar."));
    });
  return deviceDb;
}
async function deviceApi(path, options) {
  return deviceCollection("properties", path, options);
}
$("#import").onclick = () => $("#import-file").click();
$("#import-file").onchange = (e) => importBackup(e);
