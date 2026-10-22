import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("Straßenakquise: Fortschritt, Validierung, Zuordnung, Persistenz und Sicherung", async () => {
  const dir = mkdtempSync(join(tmpdir(), "akquise-streets-")),
    port = String(48000 + Math.floor(Math.random() * 1000));
  let server;
  const start = async () => {
    server = spawn(process.execPath, ["server.js"], {
      env: { ...process.env, PORT: port, DATA_DIR: dir },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise((resolve, reject) => {
      server.stdout.once("data", resolve);
      server.once("error", reject);
      server.once("exit", (c) => reject(Error("Server exit " + c)));
    });
  };
  const stop = async () => {
    if (server?.exitCode === null)
      await new Promise((resolve) => {
        server.once("exit", resolve);
        server.kill();
      });
  };
  const api = async (path, method = "GET", body) => {
    const r = await fetch(`http://127.0.0.1:${port}/api/` + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };
  try {
    await start();
    assert.deepEqual((await api("streets")).body, []);
    const street = {
      name: "Podbielskistraße",
      city: "Hannover",
      totalCount: "20",
      visitedCount: "0",
      notes: "Ganze Straße",
      dueDate: "2026-10-23",
    };
    for (const bad of [
      { city: "" },
      { visitedCount: "21" },
      { totalCount: "-1" },
      { visitedCount: "1.5" },
      { dueDate: "2026-02-31" },
      { lat: "NaN", lng: "9.7" },
    ])
      assert.equal(
        (await api("streets", "POST", { ...street, ...bad })).status,
        400,
      );
    const created = await api("streets", "POST", street);
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal(
      (
        await api("streets/" + id, "PUT", {
          ...street,
          status: "In Bearbeitung",
          visitedCount: "3",
        })
      ).status,
      200,
    );
    const property = await api("properties", "POST", {
      title: "Haus Nr. 12",
      type: "Mehrfamilienhaus",
      status: "Neu",
      streetId: id,
    });
    assert.equal(property.status, 201);
    assert.equal(property.body.streetId, id);
    await stop();
    await start();
    const loaded = (await api("streets")).body;
    assert.equal(loaded[0].visitedCount, "3");
    assert.equal(loaded[0].status, "In Bearbeitung");
    assert(
      (await api("snapshots")).body.some((s) =>
        s.streets.some((x) => x.id === id),
      ),
    );
    assert.equal((await api("streets/" + id, "DELETE")).status, 200);
    assert.deepEqual((await api("streets")).body, []);
    assert.equal((await api("properties")).body.length, 1);
    assert.equal((await api("streets/" + id, "PUT", street)).status, 404);
  } finally {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
