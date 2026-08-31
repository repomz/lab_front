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
  '    <style id="lab-system-canvas">html, body, #root { background-color: #17214B; }</style>',
].join("\n");

if (!html.includes('name="apple-mobile-web-app-capable"')) {
  html = html.replace("</head>", `${appleMeta}\n  </head>`);
}

writeFileSync(indexPath, html);
