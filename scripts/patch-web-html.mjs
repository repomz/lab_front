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
  '    <style id="lab-system-canvas">html, body, #root { width: 100%; height: 100%; height: 100dvh; min-height: 100dvh; margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; background: #17214B; } body { position: fixed; inset: 0; } #root { height: var(--lab-keyboard-height, 100dvh); } @media (max-width: 767px), (display-mode: standalone) { #mobile-navigation { position: fixed !important; left: 8px !important; right: 8px !important; bottom: calc(env(safe-area-inset-bottom, 0px) + 6px) !important; -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; touch-action: none !important; overscroll-behavior: contain !important; } #mobile-navigation * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; } } html.lab-keyboard #mobile-navigation { display: none !important; } html.lab-keyboard [data-testid="support-page"] { padding-bottom: 0 !important; }</style>',
  '    <script>(function(){var root=document.documentElement;function keyboardViewport(){if(!root.classList.contains("lab-keyboard"))return;var value=window.visualViewport?window.visualViewport.height:window.innerHeight;root.style.setProperty("--lab-keyboard-height",Math.round(value)+"px")}window.addEventListener("resize",keyboardViewport,{passive:true});if(window.visualViewport){window.visualViewport.addEventListener("resize",keyboardViewport,{passive:true});window.visualViewport.addEventListener("scroll",keyboardViewport,{passive:true})}document.addEventListener("focusin",function(event){if(event.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)){root.classList.add("lab-keyboard");keyboardViewport()}});document.addEventListener("focusout",function(){setTimeout(function(){if(!document.activeElement||!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){root.classList.remove("lab-keyboard");root.style.removeProperty("--lab-keyboard-height")}},0)});if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(items){items.forEach(function(item){item.unregister()})})}if("caches" in window){caches.keys().then(function(keys){keys.forEach(function(key){caches.delete(key)})})}})()</script>',
].join("\n");

if (!html.includes('name="apple-mobile-web-app-capable"')) {
  html = html.replace("</head>", `${appleMeta}\n  </head>`);
}

writeFileSync(indexPath, html);
