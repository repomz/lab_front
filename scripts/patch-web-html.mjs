import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(projectRoot, "dist");
const assets = resolve(projectRoot, "assets");
const indexPath = resolve(dist, "index.html");
const version = JSON.parse(readFileSync(resolve(projectRoot, "package.json"), "utf8")).version;

const startupFiles = [
  "startup-320x568@2x.png", "startup-375x667@2x.png", "startup-375x812@3x.png",
  "startup-390x844@3x.png", "startup-393x852@3x.png", "startup-402x874@3x.png",
  "startup-414x736@3x.png", "startup-414x896@2x.png", "startup-414x896@3x.png",
  "startup-428x926@3x.png", "startup-430x932@3x.png", "startup-440x956@3x.png",
];
for (const filename of ["lab-icon-v2-512.png", ...startupFiles]) {
  copyFileSync(resolve(assets, filename), resolve(dist, filename));
}
copyFileSync(resolve(assets, "clinical-carotid-overview.svg"), resolve(dist, "clinical-carotid-overview.svg"));
copyFileSync(resolve(assets, "lab-icon-v2-512.png"), resolve(dist, "apple-touch-icon.png"));
const manifestBase = {
  name: "Lab",
  short_name: "Lab",
  description: "Анализы и показатели здоровья в одном месте",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#146E78",
  theme_color: "#17214B",
  icons: [{ src: "/lab-icon-v2-512.png", sizes: "512x512", type: "image/png", purpose: "any" }],
};
writeFileSync(resolve(dist, "manifest.webmanifest"), JSON.stringify({ ...manifestBase, id: "/patient", start_url: "/patient", scope: "/patient" }, null, 2));
writeFileSync(resolve(dist, "manifest-doctor.webmanifest"), JSON.stringify({ ...manifestBase, id: "/doc", start_url: "/doc", scope: "/doc" }, null, 2));

let html = readFileSync(indexPath, "utf8");

html = html.replace(
  /(<meta\s+name="viewport"\s+content=")([^"]*)("\s*\/?>)/i,
  (_match, prefix, _content, suffix) => `${prefix}width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover${suffix}`,
);

const appleMeta = [
  `    <link rel="manifest" href="/manifest.webmanifest?v=${version}" />`,
  `    <link rel="icon" type="image/png" sizes="512x512" href="/lab-icon-v2-512.png?v=${version}" />`,
  `    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${version}" />`,
  '    <meta name="apple-mobile-web-app-capable" content="yes" />',
  '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '    <style id="lab-system-canvas">html, body, #root { position: fixed; inset: 0; width: 100%; height: 100%; min-height: 100%; margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; background: #146E78; } @supports (height: 100dvh) { html, body, #root { height: 100dvh; min-height: 100dvh; } } @media (max-width: 767px), (display-mode: standalone) { #mobile-navigation { position: fixed !important; left: 8px !important; right: 8px !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 6px) !important; width: auto !important; height: 66px !important; margin: 0 !important; -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; touch-action: none !important; overscroll-behavior: contain !important; } #mobile-navigation * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; } } html.lab-keyboard #mobile-navigation { display: none !important; } html.lab-keyboard [data-testid="support-page"] { padding-bottom: 0 !important; }</style>',
  '    <script>(function(){var root=document.documentElement;document.addEventListener("focusin",function(event){if(event.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))root.classList.add("lab-keyboard")});document.addEventListener("focusout",function(){setTimeout(function(){if(!document.activeElement||!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))root.classList.remove("lab-keyboard")},0)});if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(items){items.forEach(function(item){item.unregister()})})}if("caches" in window){caches.keys().then(function(keys){keys.forEach(function(key){caches.delete(key)})})}})()</script>',
].join("\n");

if (!html.includes('name="apple-mobile-web-app-capable"')) {
  html = html.replace("</head>", `${appleMeta}\n  </head>`);
}

writeFileSync(indexPath, html);
writeFileSync(resolve(dist,"patient.html"), html.replace(/href="\/manifest(?:-doctor)?\.webmanifest[^\"]*"/, `href="/manifest.webmanifest?v=${version}"`));
writeFileSync(resolve(dist,"doc.html"), html.replace(/href="\/manifest(?:-doctor)?\.webmanifest[^\"]*"/, `href="/manifest-doctor.webmanifest?v=${version}"`));
