// Downloads the project file snapshot from Supabase build-files endpoint
// and writes them into ./template/, overwriting matching paths.
// Required env: FILES_URL, WEBHOOK_SECRET
const fs = require("fs");
const path = require("path");
const https = require("https");

const FILES_URL = process.env.FILES_URL;
const SECRET = process.env.WEBHOOK_SECRET;
if (!FILES_URL || !SECRET) {
  console.error("FILES_URL and WEBHOOK_SECRET required");
  process.exit(1);
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers: { "x-build-secret": SECRET } }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

(async () => {
  const payload = await fetchJson(FILES_URL);
  const files = payload.files || [];
  console.log(`Got ${files.length} files. Writing into ./template/`);

  const root = path.join(process.cwd(), "template");
  fs.mkdirSync(root, { recursive: true });

  for (const f of files) {
    const rel = (f.path || "").replace(/^\/+/, "");
    if (!rel) continue;
    // Block path traversal
    if (rel.includes("..")) { console.warn("skip", rel); continue; }
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, f.content ?? "", "utf8");
  }

  // Persist metadata for patch-android.js
  fs.writeFileSync(
    path.join(process.cwd(), ".build-meta.json"),
    JSON.stringify({
      app_name: payload.app_name,
      package_id: payload.package_id,
      version_name: payload.version_name,
      version_code: payload.version_code,
    }),
  );
  console.log("Done. App:", payload.app_name, payload.package_id);
})().catch((e) => {
  console.error("inject-files failed:", e);
  process.exit(1);
});
