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
  background_color: "#176E78",
  theme_color: "#17214B",
  icons: [{ src: "/lab-icon-v2-512.png", sizes: "512x512", type: "image/png", purpose: "any" }],
};
writeFileSync(resolve(dist, "manifest.webmanifest"), JSON.stringify({ ...manifestBase, id: "/", start_url: "/", scope: "/" }, null, 2));

let html = readFileSync(indexPath, "utf8");

html = html.replace(
  /(<meta\s+name="viewport"\s+content=")([^"]*)("\s*\/?>)/i,
  (_match, prefix, _content, suffix) => `${prefix}width=device-width, initial-scale=1, viewport-fit=cover${suffix}`,
);

const appleMeta = [
  `    <link rel="manifest" href="/manifest.webmanifest?v=${version}" />`,
  `    <link rel="icon" type="image/png" sizes="512x512" href="/lab-icon-v2-512.png?v=${version}" />`,
  `    <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${version}" />`,
  '    <meta name="apple-mobile-web-app-capable" content="yes" />',
  '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '    <style id="lab-system-canvas">html { width: 100%; height: 100%; min-height: 100%; margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; background-color: #F4EFF8; background-image: radial-gradient(circle at -10% 5%, rgba(188,167,238,.24), transparent 42%), radial-gradient(circle at 110% 95%, rgba(159,221,216,.24), transparent 44%), linear-gradient(90deg, #F4EFF8 0%, #F6F4FA 52%, #EEF7F6 100%); background-attachment: fixed; } body, #root { position: fixed; inset: 0; width: 100%; height: 100%; min-height: 100%; margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; background-color: transparent !important; background-image: none !important; } body { touch-action: pan-y; } #patient-home-lower { background-color: #F4EFF8; background-image: radial-gradient(circle at -10% 5%, rgba(188,167,238,.24), transparent 42%), radial-gradient(circle at 110% 95%, rgba(159,221,216,.24), transparent 44%), linear-gradient(90deg, #F4EFF8 0%, #F6F4FA 52%, #EEF7F6 100%); background-attachment: fixed; background-size: 100vw 100lvh; } input, textarea { font-size: 16px !important; } [role="button"] { -webkit-tap-highlight-color: transparent; transition: transform 120ms ease, opacity 120ms ease, background-color 160ms ease, border-color 160ms ease; } [role="button"]:active:not([data-testid^="pin-key-"]) { transform: translateY(1px) scale(.97); opacity: .88; } @media (display-mode: standalone) { html, body, #root { height: 100lvh !important; min-height: 100lvh !important; } } @media (max-width: 767px) { #mobile-navigation { position: fixed !important; left: 8px !important; right: 8px !important; bottom: max(4px, env(safe-area-inset-bottom, 0px)) !important; width: auto !important; height: 66px !important; margin: 0 !important; -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; touch-action: none !important; overscroll-behavior: contain !important; } #mobile-navigation * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; } #analysis-upload-dock, #consultation-action-dock, #doctor-patient-search-dock { bottom: calc(max(4px, env(safe-area-inset-bottom, 0px)) + 66px) !important; } } html.lab-keyboard #mobile-navigation { display: none !important; } html.lab-keyboard [data-testid="support-page"], html.lab-keyboard [data-testid="ai-chat-page"], html.lab-keyboard [data-testid="patient-record-page"], html.lab-keyboard [data-testid="booking-page"] { position: fixed !important; left: 0 !important; right: 0 !important; top: var(--lab-visual-top, 0px) !important; bottom: auto !important; height: var(--lab-visual-height, 100dvh) !important; min-height: 0 !important; padding-bottom: 0 !important; } html.lab-keyboard #keyboard-composer-dock, html.lab-keyboard #doctor-note-composer-dock { margin-bottom: 4px !important; flex-shrink: 0 !important; } html.lab-keyboard #booking-action-dock { bottom: 4px !important; }</style>',
  '    <style id="lab-keyboard-layout">@media (max-width: 767px) { html.lab-keyboard body, html.lab-keyboard #root { top: 0 !important; transform: none !important; } html.lab-keyboard [data-testid="support-page"], html.lab-keyboard [data-testid="ai-chat-page"], html.lab-keyboard [data-testid="patient-record-page"], html.lab-keyboard [data-testid="booking-page"], html.lab-keyboard [data-testid="auth-entry-page"] { position: fixed !important; inset: 0 0 auto 0 !important; top: 0 !important; height: var(--lab-visual-height, 100dvh) !important; max-height: var(--lab-visual-height, 100dvh) !important; min-height: 0 !important; transform: none !important; } html.lab-keyboard #auth-entry-content { justify-content: flex-start !important; overflow-y: auto !important; padding-top: max(18px, env(safe-area-inset-top, 0px)) !important; padding-bottom: 12px !important; } html.lab-keyboard input, html.lab-keyboard textarea { scroll-margin: 0 !important; } }</style>',
  '    <script>(function(){var root=document.documentElement;var baseline=Math.max(document.documentElement.clientHeight||0,window.innerHeight||0);function isField(node){return !!node&&/^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName)}function syncViewport(){var view=window.visualViewport;var height=Math.round(view?view.height:window.innerHeight);var top=Math.round(view?view.offsetTop:0);if(!isField(document.activeElement))baseline=Math.max(baseline,height,document.documentElement.clientHeight||0,window.innerHeight||0);root.style.setProperty("--lab-visual-height",height+"px");root.style.setProperty("--lab-visual-top",top+"px");root.classList.toggle("lab-keyboard",isField(document.activeElement)&&height<baseline-80)}function lockViewport(){syncViewport();window.scrollTo(0,0);document.body.scrollTop=0;document.documentElement.scrollTop=0}document.addEventListener("focusin",function(event){if(isField(event.target)){requestAnimationFrame(lockViewport);setTimeout(lockViewport,80)}});document.addEventListener("focusout",function(){setTimeout(function(){root.classList.remove("lab-keyboard");lockViewport()},0)});window.visualViewport&&window.visualViewport.addEventListener("resize",syncViewport);window.visualViewport&&window.visualViewport.addEventListener("scroll",syncViewport);window.addEventListener("orientationchange",function(){baseline=0;setTimeout(lockViewport,120)});syncViewport()})()</script>',
].join("\n");

if (!html.includes('name="apple-mobile-web-app-capable"')) {
  html = html.replace("</head>", `${appleMeta}\n  </head>`);
}

writeFileSync(indexPath, html);
