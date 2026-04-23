const fs = require("fs");
const path = require("path");

// 📌 Absolute root (scripts/ এর parent)
const ROOT = path.resolve(__dirname, "..");
const TEMPLATE = path.join(ROOT, "template");

// 🔍 Find .build-meta.json
const metaCandidates = [
  path.join(ROOT, ".build-meta.json"),
  path.join(TEMPLATE, ".build-meta.json"),
];

const metaPath = metaCandidates.find((p) => fs.existsSync(p));

if (!metaPath) {
  throw new Error(`Missing .build-meta.json. Checked: ${metaCandidates.join(", ")}`);
}

// 📦 Load meta
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

if (!meta.package_id || !meta.app_name) {
  throw new Error("Invalid .build-meta.json");
}

// 🔐 Escape app name
const safeAppName = String(meta.app_name).replace(/'/g, "\\'");

// 📁 Absolute paths
const ANDROID = path.join(TEMPLATE, "android");
const capCfg = path.join(TEMPLATE, "capacitor.config.ts");

// 1️⃣ Create বা update capacitor.config.ts
if (!fs.existsSync(capCfg)) {
  fs.writeFileSync(
    capCfg,
    `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${meta.package_id}',
  appName: '${safeAppName}',
  webDir: 'dist',
};

export default config;
`
  );
} else {
  let cap = fs.readFileSync(capCfg, "utf8");

  cap = cap.replace(/appId:\s*'[^']*'/, `appId: '${meta.package_id}'`);
  cap = cap.replace(/appName:\s*'[^']*'/, `appName: '${safeAppName}'`);

  fs.writeFileSync(capCfg, cap);
}

// 2️⃣ Patch build.gradle
const buildGradle = path.join(ANDROID, "app", "build.gradle");

if (fs.existsSync(buildGradle)) {
  let g = fs.readFileSync(buildGradle, "utf8");

  g = g.replace(/applicationId\s+["'][^"']+["']/, `applicationId "${meta.package_id}"`);
  g = g.replace(/versionName\s+["'][^"']+["']/, `versionName "${meta.version_name}"`);
  g = g.replace(/versionCode\s+\d+/, `versionCode ${meta.version_code}`);

  fs.writeFileSync(buildGradle, g);
}

// 3️⃣ Patch strings.xml
const strings = path.join(
  ANDROID,
  "app",
  "src",
  "main",
  "res",
  "values",
  "strings.xml"
);

if (fs.existsSync(strings)) {
  let x = fs.readFileSync(strings, "utf8");

  x = x.replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${meta.app_name}$2`);
  x = x.replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${meta.app_name}$2`);

  fs.writeFileSync(strings, x);
}

// ✅ Done
console.log("Patched android project for", meta.package_id);
