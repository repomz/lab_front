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
  '    <style id="lab-system-canvas">html, body { position: fixed; inset: 0; width: 100%; height: var(--lab-viewport-height, 100dvh); margin: 0; padding: 0; overflow: hidden; overscroll-behavior: none; background-color: #17214B; } #root { position: absolute; inset: 0; width: 100%; height: var(--lab-viewport-height, 100dvh); min-height: 0; overflow: hidden; background-color: #17214B; } html.lab-keyboard [data-testid="bottom-nav"] { display: none !important; } html.lab-keyboard [data-testid="support-page"] { padding-bottom: 0 !important; }</style>',
  '    <script>(function(){var root=document.documentElement;function viewport(){var value=window.visualViewport?window.visualViewport.height:window.innerHeight;root.style.setProperty("--lab-viewport-height",Math.round(value)+"px")}viewport();window.addEventListener("resize",viewport,{passive:true});if(window.visualViewport){window.visualViewport.addEventListener("resize",viewport,{passive:true});window.visualViewport.addEventListener("scroll",viewport,{passive:true})}document.addEventListener("focusin",function(event){if(event.target&&/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)){root.classList.add("lab-keyboard")}});document.addEventListener("focusout",function(){setTimeout(function(){if(!document.activeElement||!/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)){root.classList.remove("lab-keyboard")}},0)});if("serviceWorker" in navigator){navigator.serviceWorker.getRegistrations().then(function(items){items.forEach(function(item){item.unregister()})})}if("caches" in window){caches.keys().then(function(keys){keys.forEach(function(key){caches.delete(key)})})}})()</script>',
].join("\n");

if (!html.includes('name="apple-mobile-web-app-capable"')) {
  html = html.replace("</head>", `${appleMeta}\n  </head>`);
}

writeFileSync(indexPath, html);
