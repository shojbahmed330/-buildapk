// Patches package id, app name and version into the generated Android project.
const fs = require("fs");
const path = require("path");

const meta = JSON.parse(fs.readFileSync(".build-meta.json", "utf8"));
const ANDROID = path.join("template", "android");

// 1. Update capacitor.config.ts in template/ if present
const capCfg = path.join("template", "capacitor.config.ts");
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
`,
  );
}

// 2. Patch android/app/build.gradle applicationId + versionName + versionCode
const buildGradle = path.join(ANDROID, "app", "build.gradle");
if (fs.existsSync(buildGradle)) {
  let g = fs.readFileSync(buildGradle, "utf8");
  g = g.replace(/applicationId\s+["'][^"']+["']/, `applicationId "${meta.package_id}"`);
  g = g.replace(/versionName\s+["'][^"']+["']/, `versionName "${meta.version_name}"`);
  g = g.replace(/versionCode\s+\d+/, `versionCode ${meta.version_code}`);
  fs.writeFileSync(buildGradle, g);
}

// 3. Patch app name in strings.xml
const strings = path.join(ANDROID, "app", "src", "main", "res", "values", "strings.xml");
if (fs.existsSync(strings)) {
  let x = fs.readFileSync(strings, "utf8");
  x = x.replace(/(<string name="app_name">)[^<]*(<\/string>)/, `$1${meta.app_name}$2`);
  x = x.replace(/(<string name="title_activity_main">)[^<]*(<\/string>)/, `$1${meta.app_name}$2`);
  fs.writeFileSync(strings, x);
}

console.log("Patched android project for", meta.package_id);
