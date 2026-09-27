import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const version = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")).version;
const html = readFileSync(resolve(root, "dist/index.html"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "dist/manifest.webmanifest"), "utf8"));

function readSourceTree(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return readSourceTree(path);
      return /\.(?:ts|tsx)$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
    });
}

const source = [readFileSync(resolve(root, "App.tsx"), "utf8"), ...readSourceTree(resolve(root, "src"))].join("\n");
const webBundles = readdirSync(resolve(root, "dist/_expo/static/js/web"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => readFileSync(resolve(root, "dist/_expo/static/js/web", name), "utf8"))
  .join("\n");

const requirements = [
  [html.includes("viewport-fit=cover"), "viewport-fit=cover is missing"],
  [html.includes("safe-area-inset-bottom"), "bottom safe-area handling is missing"],
  [html.includes("height: 100lvh"), "standalone full-screen height is missing"],
  [!html.includes("caches.keys()"), "the application cache is deleted on every launch"],
  [manifest.start_url === "/" && manifest.scope === "/", "unified manifest route is invalid"],
  [html.includes(`manifest.webmanifest?v=${version}`), "HTML and package versions differ"],
  [html.includes('data-testid="ai-chat-page"') && html.includes("#keyboard-composer-dock"), "chat composer keyboard handling is missing"],
  [html.includes('data-testid="booking-page"') && html.includes("#booking-action-dock") && html.includes("--lab-visual-top"), "booking form keyboard handling is missing"],
  [html.includes("#patient-home-lower") && html.includes("background-attachment: fixed"), "patient home lower canvas is not continuous"],
  [html.includes("background-color: transparent !important; background-image: none !important"), "body/root can repaint the physical canvas"],
  [source.includes(`|| "${version}"`), "visible application version and package version differ"],
  [webBundles.includes(version), "compiled application version and package version differ"],
  [source.includes('mode==="research"') && source.includes('nativeID="analysis-upload-dock"'), "upload action is not limited to research mode"],
  [html.includes("#ai-action-dock") && html.includes("#booking-action-dock") && html.includes("+ 74px"), "mobile action docks are not separated from navigation"],
];

const failed = requirements.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) throw new Error(`Web build verification failed:\n- ${failed.join("\n- ")}`);
console.log(`Verified Lab web build v${version}: routes, version and iOS safe areas are consistent.`);
