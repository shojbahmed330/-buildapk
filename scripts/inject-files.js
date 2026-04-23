// Downloads the project file snapshot from Supabase build-files endpoint
// and writes them into ./template/, scaffolding a base Vite+React+Capacitor
// project first so AI-generated files have something to build on.

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

function writeFile(root, rel, content) {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, "utf8");
}

function scaffoldBase(root, meta) {
  const appName = meta.app_name || "My App";
  const pkgId = meta.package_id || "app.lovable.generated";

  const files = {
    "package.json": JSON.stringify({
      name: "lovable-app",
      private: true,
      version: meta.version_name || "1.0.0",
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      dependencies: {
        react: "^18.3.1",
        "react-dom": "^18.3.1",
        "react-router-dom": "^6.26.2",
        "lucide-react": "^0.462.0",
      },
      devDependencies: {
        "@capacitor/cli": "^6.1.2",
        "@capacitor/core": "^6.1.2",
        "@capacitor/android": "^6.1.2",
        "@vitejs/plugin-react-swc": "^3.5.0",
        "@types/react": "^18.3.3",
        "@types/react-dom": "^18.3.0",
        autoprefixer: "^10.4.20",
        postcss: "^8.4.47",
        tailwindcss: "^3.4.11",
        typescript: "^5.5.3",
        vite: "^5.4.1",
      },
    }, null, 2),

    "vite.config.ts": `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  build: { outDir: "dist" },
});
`,

    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: false,
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src"],
    }, null, 2),

    "tailwind.config.js": `export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
`,
    "postcss.config.js": `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`,

    "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>${appName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,

    "src/main.tsx": `import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
`,

    "src/index.css": `@tailwind base;
@tailwind components;
@tailwind utilities;
html,body,#root{height:100%;margin:0;font-family:system-ui,-apple-system,sans-serif;}
`,

    "capacitor.config.ts": `import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: '${pkgId}',
  appName: ${JSON.stringify(appName)},
  webDir: 'dist',
};
export default config;
`,
  };

  for (const [rel, content] of Object.entries(files)) {
    writeFile(root, rel, content);
  }
  console.log(`✓ Scaffolded ${Object.keys(files).length} base files`);
}

(async () => {
  const payload = await fetchJson(FILES_URL);
  const files = payload.files || [];
  console.log(`Got ${files.length} project files from snapshot.`);

  const root = path.join(process.cwd(), "template");
  fs.mkdirSync(root, { recursive: true });

  scaffoldBase(root, payload);

  let written = 0;
  for (const f of files) {
    const rel = (f.path || "").replace(/^\/+/, "");
    if (!rel) continue;
    if (rel.includes("..")) { console.warn("skip", rel); continue; }
    writeFile(root, rel, f.content ?? "");
    written++;
  }
  console.log(`✓ Overlaid ${written} AI-generated files`);

  fs.writeFileSync(
    path.join(process.cwd(), ".build-meta.json"),
    JSON.stringify({
      app_name: payload.app_name,
      package_id: payload.package_id,
      version_name: payload.version_name,
      version_code: payload.version_code,
    }),
  );

  const pkgPath = path.join(root, "package.json");
  if (!fs.existsSync(pkgPath)) {
    console.error("FATAL: template/package.json missing!");
    process.exit(1);
  }
  console.log("✓ Done. App:", payload.app_name);
})().catch((e) => {
  console.error("inject-files failed:", e);
  process.exit(1);
});
