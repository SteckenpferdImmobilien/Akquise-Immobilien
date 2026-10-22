/* Shared validation for the server and the offline device version. */
(() => {
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
  const activityTypes = [
    "Eigentümer getroffen",
    "Nachbar getroffen",
    "Information erhalten",
    "Niemand angetroffen",
    "Telefonat",
    "E-Mail",
    "Besichtigung",
    "Sonstiges",
  ];
  const visitStatuses = [
    "Nicht besucht",
    "Niemand angetroffen",
    "Besucht",
    "Erneut besuchen",
  ];
  const priorities = [
    "Normal",
    "Heißer Kontakt",
    "Später interessant",
    "Kein Potenzial",
  ];
  const eventTypes = [
    "Termin",
    "Besichtigung",
    "Telefonat",
    "Aufgabe",
    "Privat",
  ];
  function fail(message) {
    throw Error(message);
  }
  function string(input, key, max = 1000, fallback = "") {
    if (input[key] === undefined) return fallback;
    if (typeof input[key] !== "string") fail("Ungültiges Feld: " + key);
    const v = input[key].trim();
    if (v.length > max) fail("Eingabe zu lang: " + key);
    return v;
  }
  function validDate(value) {
    return (
      typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(value) &&
      !Number.isNaN(Date.parse(value)) &&
      new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value
    );
  }
  function image(value) {
    return (
      typeof value === "string" &&
      (!value ||
        (/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value) &&
          value.length <= 5000000))
    );
  }
  function property(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      fail("Ungültiges Objekt");
    const p = {};
    for (const key of [
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
      "image",
      "visitStatus",
      "visitDate",
      "lat",
      "lng",
      "district",
      "priority",
    ])
      p[key] = string(
        input,
        key,
        key === "notes" ? 20000 : key === "image" ? 5000000 : 1000,
      );
    if (!p.title) fail("Bitte eine Objektbezeichnung eingeben.");
    if (!statuses.includes(p.status) || !types.includes(p.type))
      fail("Ungültiger Objektstatus oder Objekttyp");
    p.visitStatus ||= "Nicht besucht";
    p.priority ||= "Normal";
    if (
      !visitStatuses.includes(p.visitStatus) ||
      !priorities.includes(p.priority)
    )
      fail("Ungültiger Besuchsstatus oder Priorität");
    if (
      Boolean(p.lat) !== Boolean(p.lng) ||
      (p.lat &&
        (!Number.isFinite(Number(p.lat)) ||
          !Number.isFinite(Number(p.lng)) ||
          Math.abs(Number(p.lat)) > 90 ||
          Math.abs(Number(p.lng)) > 180))
    )
      fail("Ungültige Koordinaten");
    if (p.url && !/^https?:\/\//i.test(p.url))
      fail("Der Link muss mit https:// oder http:// beginnen.");
    for (const key of ["visitDate", "dueDate"])
      if (p[key] && !validDate(p[key])) fail("Ungültiges Datum");
    if (!image(p.image)) fail("Bitte JPG, PNG oder WebP bis 5 MB verwenden.");
    if (input.activities !== undefined && !Array.isArray(input.activities))
      fail("Ungültige Aktivitäten");
    p.activities = (input.activities || []).map((a) => {
      if (!a || !activityTypes.includes(a.type) || !validDate(a.date))
        fail("Ungültige Aktivität");
      return { type: a.type, date: a.date, note: string(a, "note", 10000) };
    });
    if (p.activities.length > 500) fail("Maximal 500 Aktivitäten pro Objekt");
    if (input.history !== undefined && !Array.isArray(input.history))
      fail("Ungültiger Statusverlauf");
    p.history = (input.history || []).map((h) => {
      if (
        !h ||
        !statuses.includes(h.status) ||
        typeof h.at !== "string" ||
        Number.isNaN(Date.parse(h.at))
      )
        fail("Ungültiger Statusverlauf");
      return { status: h.status, at: h.at };
    });
    if (p.history.length > 2000) fail("Statusverlauf zu lang");
    if (input.attachments !== undefined && !Array.isArray(input.attachments))
      fail("Ungültige Anhänge");
    p.attachments = (input.attachments || []).map((a) => {
      if (
        !a ||
        typeof a.data !== "string" ||
        a.data.length > 7000000 ||
        !/^data:(image\/(jpeg|png|webp)|application\/pdf|text\/plain|audio\/(webm|mp4|ogg|mpeg|wav))(;codecs=[A-Za-z0-9.,-]+)?;base64,[A-Za-z0-9+/]+=*$/.test(
          a.data,
        )
      )
        fail("Ungültiger Anhang. Erlaubt: Fotos, PDF, Text und Audio.");
      return {
        id: string(a, "id", 100) || crypto.randomUUID(),
        name: string(a, "name", 200) || "Anhang",
        data: a.data,
      };
    });
    if (p.attachments.length > 30 || JSON.stringify(p).length > 24000000)
      fail("Maximal 30 Anhänge und 24 MB pro Objekt.");
    return p;
  }
  function event(input) {
    if (!input || typeof input !== "object" || Array.isArray(input))
      fail("Ungültiger Termin");
    const e = {};
    for (const key of [
      "title",
      "date",
      "time",
      "endTime",
      "type",
      "objectId",
      "notes",
    ])
      e[key] = string(input, key, key === "notes" ? 10000 : 1000);
    if (!e.title || !validDate(e.date))
      fail("Titel und gültiges Datum sind erforderlich.");
    e.type ||= "Termin";
    if (!eventTypes.includes(e.type)) fail("Ungültige Terminart");
    for (const key of ["time", "endTime"])
      if (e[key] && !/^([01]\d|2[0-3]):[0-5]\d$/.test(e[key]))
        fail("Ungültige Uhrzeit");
    if (e.endTime && (!e.time || e.endTime <= e.time))
      fail("Die Endzeit muss nach der Startzeit liegen.");
    if (input.done !== undefined && typeof input.done !== "boolean")
      fail("Ungültiger Aufgabenstatus");
    e.done = !!input.done;
    return e;
  }
  globalThis.AkquiseModel = {
    property,
    event,
    validDate,
    priorities,
    activityTypes,
    eventTypes,
  };
})();
