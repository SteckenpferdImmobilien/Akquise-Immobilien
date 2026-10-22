(() => {
  const raw = document.querySelector('meta[name="akquise-build"]')?.content;
  const build = raw && !raw.startsWith("__") ? raw : "2026.10.22-update-1";
  let registration = null,
    reloading = false,
    target = null,
    lastCheck = 0;
  const $u = (s) => document.querySelector(s);
  function say(text) {
    $u("#app-update-status").textContent = text;
  }
  function offer(worker) {
    target = worker;
    $u("#app-update-banner").hidden = false;
    say("Neue Version bereit – Logo, Gold-Design und Straßenakquise laden.");
  }
  async function activeBuild() {
    const worker = navigator.serviceWorker?.controller;
    if (!worker) return null;
    return new Promise((resolve) => {
      const channel = new MessageChannel(),
        timer = setTimeout(() => {
          channel.port1.close();
          resolve(null);
        }, 1500);
      channel.port1.onmessage = (e) => {
        clearTimeout(timer);
        channel.port1.close();
        resolve(e.data?.build || null);
      };
      worker.postMessage({ type: "GET_VERSION" }, [channel.port2]);
    });
  }
  function watch(reg) {
    if (reg.waiting) offer(reg.waiting);
    const seen = new WeakSet();
    function observe(worker) {
      if (!worker || seen.has(worker)) return;
      seen.add(worker);
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller)
          offer(reg.waiting || worker);
      });
    }
    observe(reg.installing);
    reg.addEventListener("updatefound", () => observe(reg.installing));
  }
  async function check(manual = false) {
    if (!navigator.onLine) {
      if (manual)
        say(
          "Du bist offline. Bitte mit dem Internet verbinden und erneut prüfen.",
        );
      return;
    }
    if (!manual && Date.now() - lastCheck < 60000) return;
    lastCheck = Date.now();
    const button = $u("#check-app-update");
    if (manual) {
      button.disabled = true;
      say("Update wird geprüft …");
    }
    try {
      if (!("serviceWorker" in navigator)) {
        if (manual)
          say("Updates bitte durch erneutes Öffnen der App in Safari laden.");
        return;
      }
      if (!registration) {
        registration = await navigator.serviceWorker.register("./sw.js", {
          updateViaCache: "none",
        });
        watch(registration);
      }
      await registration.update();
      const current = await activeBuild();
      if (registration.waiting) offer(registration.waiting);
      else if (current && current !== build) offer(null);
      else if (manual)
        say(
          registration.installing
            ? "Die neue Version wird geladen. Bitte kurz warten."
            : "Update-Prüfung abgeschlossen. Sobald eine neue Version bereit ist, erscheint ein Hinweis.",
        );
    } catch {
      if (manual)
        say(
          "Update derzeit nicht erreichbar. Deine gespeicherten Einträge bleiben verfügbar. Bitte später erneut prüfen.",
        );
    } finally {
      button.disabled = false;
    }
  }
  async function apply() {
    if (document.querySelector("dialog[open]")) {
      say("Bitte offene Eingaben zuerst speichern oder schließen.");
      return;
    }
    reloading = true;
    $u("#apply-app-update").disabled = true;
    say("App wird aktualisiert …");
    if (target) target.postMessage({ type: "ACTIVATE_UPDATE" });
    else location.reload();
  }
  function setup() {
    $u("#app-version").textContent = "Version " + build;
    $u("#check-app-update").onclick = () => check(true);
    $u("#apply-app-update").onclick = apply;
    $u("#dismiss-app-update").onclick = () => {
      $u("#app-update-banner").hidden = true;
    };
    if (!deviceMode) {
      say("Serverversion · die Oberfläche wird vom Mac geladen.");
      $u("#check-app-update").onclick = () => {
        if (document.querySelector("dialog[open]")) {
          say("Bitte offene Eingaben zuerst speichern oder schließen.");
          return;
        }
        location.reload();
      };
      return;
    }
    navigator.serviceWorker?.addEventListener("controllerchange", () => {
      if (reloading) location.reload();
    });
    window.addEventListener("online", () => check());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") check();
    });
    check();
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", setup);
  else setup();
})();
