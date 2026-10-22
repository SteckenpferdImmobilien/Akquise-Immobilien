import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
test("Kalender: Validierung, CRUD, Neustart und automatische Datenstände", async () => {
  const dir = mkdtempSync(join(tmpdir(), "akquise-calendar-")),
    port = String(42000 + Math.floor(Math.random() * 5000));
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
    if (server && server.exitCode === null)
      await new Promise((resolve) => {
        server.once("exit", resolve);
        server.kill();
      });
  };
  const request = async (path, method = "GET", data) => {
    const r = await fetch(`http://127.0.0.1:${port}/api/` + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: data ? JSON.stringify(data) : undefined,
    });
    return { status: r.status, body: await r.json() };
  };
  try {
    await start();
    assert.deepEqual((await request("events")).body, []);
    const event = {
      title: "Besichtigung",
      date: "2026-10-23",
      time: "14:30",
      endTime: "15:30",
      type: "Besichtigung",
      notes: "Klingeln bei Meyer",
      done: false,
    };
    assert.equal(
      (await request("events", "POST", { ...event, endTime: "13:30" })).status,
      400,
    );
    assert.equal(
      (await request("events", "POST", { ...event, date: "2026-02-31" }))
        .status,
      400,
    );
    assert.equal(
      (await request("events", "POST", { ...event, time: "25:00" })).status,
      400,
    );
    const created = await request("events", "POST", event);
    assert.equal(created.status, 201);
    const id = created.body.id;
    assert.equal(
      (
        await request("events/" + id, "PUT", {
          ...event,
          done: true,
          notes: "Termin erledigt",
        })
      ).status,
      200,
    );
    await stop();
    await start();
    const list = (await request("events")).body;
    assert.equal(list.length, 1);
    assert.equal(list[0].done, true);
    assert.equal(list[0].notes, "Termin erledigt");
    const snapshots = (await request("snapshots")).body;
    assert(
      snapshots.some((s) =>
        s.events.some((e) => e.id === id && e.done === false),
      ),
    );
    const property = {
      title: "Haus",
      status: "Kontaktiert",
      history: [
        { status: "Neu", at: "2026-10-21T10:00:00Z" },
        { status: "Kontaktiert", at: "2026-10-22T10:00:00Z" },
      ],
      type: "Einfamilienhaus",
      district: "List",
      priority: "Heißer Kontakt",
      attachments: [
        { name: "Notiz.txt", data: "data:text/plain;base64,SGFsbG8=" },
      ],
    };
    const p = await request("properties", "POST", property);
    assert.equal(p.status, 201);
    assert.equal(p.body.attachments.length, 1);
    assert.equal(p.body.district, "List");
    assert.equal(p.body.history.length, 2);
    assert.equal(
      (
        await request("properties", "POST", {
          ...property,
          attachments: [
            { name: "Test.html", data: "data:text/html;base64,SGFsbG8=" },
          ],
        })
      ).status,
      400,
    );
    for (let i = 0; i < 6; i++)
      assert.equal(
        (await request("events/" + id, "PUT", { ...event, notes: String(i) }))
          .status,
        200,
      );
    assert.equal((await request("snapshots")).body.length, 5);
    assert.equal((await request("events/" + id, "DELETE")).status, 200);
    assert.deepEqual((await request("events")).body, []);
    assert.equal((await request("events/" + id, "PUT", event)).status, 404);
  } finally {
    await stop();
    rmSync(dir, { recursive: true, force: true });
  }
});
