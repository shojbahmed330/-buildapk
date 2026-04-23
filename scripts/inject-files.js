// Build-time injector with template + AI overlay
const fs = require("fs");
const path = require("path");
const https = require("https");

const FILES_URL = process.env.FILES_URL;
const SECRET = process.env.WEBHOOK_SECRET;

if (!FILES_URL || !SECRET) {
  console.error("FILES_URL and WEBHOOK_SECRET required");
  process.exit(1);
}

const ROOT = process.cwd();
const REPO_TEMPLATE = path.join(ROOT, "template");
const BUILD_DIR = path.join(ROOT, "build-template");

const PROTECTED_FILES = new Set([
  "index.html", "package.json", "package-lock.json",
  "vite.config.ts", "vite.config.js", "tsconfig.json",
  "tailwind.config.js", "tailwind.config.ts", "postcss.config.js",
  "capacitor.config.ts", "src/main.tsx", "src/index.tsx", "src/index.css",
]);

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

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

(async () => {
  if (!fs.existsSync(path.join(REPO_TEMPLATE, "package.json"))) {
    console.error("FATAL: ./template/package.json missing in repo.");
    process.exit(1);
  }

  // Build into a temp dir, then swap into ./template/
  if (fs.existsSync(BUILD_DIR)) fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  copyDir(REPO_TEMPLATE, BUILD_DIR);
  console.log("✓ Copied repo template/ -> build-template/");

  const payload = await fetchJson(FILES_URL);
  const files = payload.files || [];
  console.log(`Got ${files.length} AI files from snapshot.`);

  let written = 0, skipped = 0;
  for (const f of files) {
    const rel = (f.path || "").replace(/^\/+/, "");
    if (!rel) continue;
    if (rel.includes("..")) { console.warn("skip traversal:", rel); continue; }
    if (PROTECTED_FILES.has(rel)) {
      console.log(`⏭  Skipped protected: ${rel}`);
      skipped++;
      continue;
    }
    writeFile(BUILD_DIR, rel, f.content ?? "");
    written++;
  }
  console.log(`✓ Overlaid ${written} AI files (${skipped} protected kept)`);

  const appName = payload.app_name || "My App";
  const pkgId = payload.package_id || "app.lovable.generated";
  const versionName = payload.version_name || "1.0.0";
  const versionCode = payload.version_code || 1;

  // Patch capacitor.config.ts in build dir
  const capPath = path.join(BUILD_DIR, "capacitor.config.ts");
  if (fs.existsSync(capPath)) {
    let cap = fs.readFileSync(capPath, "utf8");
    cap = cap.replace(/appId:\s*'[^']*'/, `appId: '${pkgId}'`);
    cap = cap.replace(/appName:\s*'[^']*'/, `appName: '${appName.replace(/'/g, "\\'")}'`);
    fs.writeFileSync(capPath, cap);
  }

  // Patch index.html title
  const htmlPath = path.join(BUILD_DIR, "index.html");
  if (fs.existsSync(htmlPath)) {
    let html = fs.readFileSync(htmlPath, "utf8");
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${appName}</title>`);
    fs.writeFileSync(htmlPath, html);
  }

  // Patch package.json version
  const pkgPath = path.join(BUILD_DIR, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    pkg.version = versionName;
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
  }

  // Swap build-template -> template (replace original)
  const TEMP_BACKUP = path.join(ROOT, ".template-original");
  if (fs.existsSync(TEMP_BACKUP)) fs.rmSync(TEMP_BACKUP, { recursive: true, force: true });
  fs.renameSync(REPO_TEMPLATE, TEMP_BACKUP);
  fs.renameSync(BUILD_DIR, REPO_TEMPLATE);
  console.log("✓ Activated build-template at ./template/");

  // CRITICAL: Write .build-meta.json to repo ROOT (patch-android.js reads from cwd)
  const meta = JSON.stringify({
    app_name: appName,
    package_id: pkgId,
    version_name: versionName,
    version_code: versionCode,
  }, null, 2);

  fs.writeFileSync(path.join(ROOT, ".build-meta.json"), meta);
  console.log(`✓ Wrote .build-meta.json to repo root`);
  console.log(`✓ Done. App: "${appName}" (${pkgId}) v${versionName} [code ${versionCode}]`);
})().catch((e) => {
  console.error("inject-files failed:", e);
  process.exit(1);
});
