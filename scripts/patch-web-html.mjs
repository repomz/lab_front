import { readFileSync, writeFileSync } from "node:fs";

const indexPath = new URL("../dist/index.html", import.meta.url);
let html = readFileSync(indexPath, "utf8");

html = html.replace(
  /(<meta\s+name="viewport"\s+content=")([^"]*)("\s*\/?>)/i,
  (_match, prefix, content, suffix) => {
    const next = content.includes("viewport-fit=cover")
      ? content
      : `${content}, viewport-fit=cover`;
    return `${prefix}${next}${suffix}`;
  },
);

const appleMeta = [
  '    <meta name="apple-mobile-web-app-capable" content="yes" />',
  '    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />',
  '    <style id="lab-system-canvas">html, body { position: fixed; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; background-color: #17214B; } #root { position: absolute; inset: 0; width: 100%; height: auto; min-height: 0; overflow: hidden; background-color: #17214B; }</style>',
  '    <script>if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(items){items.forEach(function(item){item.unregister()})})}if("caches" in window){caches.keys().then(function(keys){keys.forEach(function(key){caches.delete(key)})})}</script>',
].join("\n");

if (!html.includes('name="apple-mobile-web-app-capable"')) {
  html = html.replace("</head>", `${appleMeta}\n  </head>`);
}

writeFileSync(indexPath, html);
