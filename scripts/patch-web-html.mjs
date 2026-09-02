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
writeFileSync(resolve(dist, "manifest.webmanifest"), JSON.stringify({ ...manifestBase, id: "/patient", start_url: "/patient" }, null, 2));
writeFileSync(resolve(dist, "manifest-doctor.webmanifest"), JSON.stringify({ ...manifestBase, id: "/doc", start_url: "/doc" }, null, 2));

let html = readFileSync(indexPath, "utf8");

html = html.replace(
  /(<meta\s+name="viewport"\s+content=")([^"]*)("\s*\/?>)/i,
  (_match, prefix, _content, suffix) => `${prefix}width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover${suffix}`,
);

const appleMeta = [
  `    <link rel="manifest" href="/manifest.webmanifest?v=${version}" />`,
  `    <link rel="icon" type="image/png" sizes="512x512" href="/lab-icon-v2-512.png?v=${version}" />`,
  `    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2)" href="/startup-320x568@2x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)" href="/startup-375x667@2x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)" href="/startup-375x812@3x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)" href="/startup-390x844@3x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3)" href="/startup-393x852@3x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3)" href="/startup-402x874@3x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)" href="/startup-414x736@3x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2)" href="/startup-414x896@2x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)" href="/startup-414x896@3x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)" href="/startup-428x926@3x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)" href="/startup-430x932@3x.png?v=${version}" />`,
  `    <link rel="apple-touch-startup-image" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3)" href="/startup-440x956@3x.png?v=${version}" />`,
  '    <meta name="apple-mobile-web-app-capable" content="yes" />',
  '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '    <style id="lab-system-canvas">html, body, #root { width: 100%; height: 100%; height: 100dvh; min-height: 100dvh; margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; background: #F6F4FA; } @media (max-width: 767px), (display-mode: standalone) { #mobile-navigation { position: fixed !important; left: 8px !important; right: 8px !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 6px) !important; -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; touch-action: none !important; overscroll-behavior: contain !important; } #mobile-navigation * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; } } html.lab-keyboard #root { bottom: auto !important; height: var(--lab-keyboard-height, 100%) !important; } html.lab-keyboard #mobile-navigation { display: none !important; } html.lab-keyboard [data-testid="support-page"] { padding-bottom: 0 !important; }</style>',
  '    <script>(function(){var root=document.documentElement;function keyboardViewport(){if(!root.classList.contains("lab-keyboard"))return;var value=window.visualViewport?window.visualViewport.height:window.innerHeight;root.style.setProperty("--lab-keyboard-height",Math.round(value)+"px")}window.addEventListener("resize",keyboardViewport,{passive:true});if(window.visualViewport){window.visualViewport.addEventListener("resize",keyboardViewport,{passive:true});window.visualViewport.addEventListener("scroll",keyboardViewport,{passive:true})}document.addEventListener("focusin",function(event){if(event.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)){root.classList.add("lab-keyboard");keyboardViewport()}});document.addEventListener("focusout",function(){setTimeout(function(){if(!document.activeElement||!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){root.classList.remove("lab-keyboard");root.style.removeProperty("--lab-keyboard-height")}},0)});if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(items){items.forEach(function(item){item.unregister()})})}if("caches" in window){caches.keys().then(function(keys){keys.forEach(function(key){caches.delete(key)})})}})()</script>',
].join("\n");

if (!html.includes('name="apple-mobile-web-app-capable"')) {
  html = html.replace("</head>", `${appleMeta}\n  </head>`);
}

writeFileSync(indexPath, html);
