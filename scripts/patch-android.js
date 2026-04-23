const fs = require("fs");
const path = require("path");

// 🔍 Find .build-meta.json
const metaCandidates = [
  path.resolve(process.cwd(), ".build-meta.json"),
  path.resolve(process.cwd(), "template", ".build-meta.json"),
];

const metaPath = metaCandidates.find((p) => fs.existsSync(p));

if (!metaPath) {
  throw new Error(`Missing .build-meta.json. Checked: ${metaCandidates.join(", ")}`);
}

// 📦 Load meta
const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));

const ANDROID = path.join("template", "android");

// 1️⃣ Ensure + PATCH capacitor.config.ts
const capCfg = path.join("template", "capacitor.config.ts");

// 👉 যদি না থাকে → create
if (!fs.existsSync(capCfg)) {
  fs.writeFileSync(
    capCfg,
    `import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: '${meta.package_id}',
  appName: '${meta.app_name}',
  webDir: 'dist',
};

export default config;
`
  );
} else {
  // 👉 থাকলে → update (FIXED PART)
  let cap = fs.readFileSync(capCfg, "utf8");

  cap = cap.replace(/appId:\s*'[^']*'/, `appId: '${meta.package_id}'`);
  cap = cap.replace(
    /appName:\s*'[^']*'/,
    `appName: '${String(meta.app_name).replace(/'/g, "\\'")}'`
  );

  fs.writeFileSync(capCfg, cap);
}

// 2️⃣ Patch android/app/build.gradle
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
