import { cpSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const destination = resolve(process.argv[2] || "/tmp/akquise-site");
const build = process.env.GITHUB_SHA || "2026.10.22-update-1";
if (!/^[a-zA-Z0-9.-]+$/.test(build)) throw Error("Invalid build ID");
mkdirSync(destination, { recursive: true });
cpSync("public", destination, { recursive: true });
for (const file of ["index.html", "phone.html"]) {
  let html = readFileSync("public/phone.html", "utf8").replaceAll(
    "__AKQUISE_BUILD__",
    build,
  );
  html = html.replace(
    /(src|href)="(\.\/[^"?]+)"/g,
    (_, attribute, path) => `${attribute}="${path}?build=${build}"`,
  );
  writeFileSync(resolve(destination, file), html);
}
writeFileSync(
  resolve(destination, "sw.js"),
  readFileSync("public/sw.js", "utf8").replaceAll("__AKQUISE_BUILD__", build),
);
for (const file of ["manifest.webmanifest", "phone.webmanifest"]) {
  const path = resolve(destination, file),
    manifest = JSON.parse(readFileSync(path, "utf8"));
  for (const icon of manifest.icons || []) icon.src += "?build=" + build;
  writeFileSync(path, JSON.stringify(manifest, null, 2));
}
writeFileSync(resolve(destination, "version.json"), JSON.stringify({ build }));
console.log("Built iPhone release " + build);
