import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function parseArgs(argv) {
  const args = {
    baseUrl: "http://localhost:3000",
    config: "skills/design-review/templates/routes.example.json",
    outDir: "artifacts/design-review",
    help: false,
    initAuth: false,
  };

  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--help" || token === "-h") args.help = true;
    else if (token === "--initAuth") args.initAuth = true;
    else if (token === "--baseUrl") args.baseUrl = argv[++i];
    else if (token === "--config") args.config = argv[++i];
    else if (token === "--outDir") args.outDir = argv[++i];
    else throw new Error(`Unknown argument: ${token}`);
  }
  return args;
}

function printHelp() {
  // Keep this short; it’s a helper for the skill.
  console.log(`design-review screenshot capture

Usage:
  node skills/design-review/scripts/capture.mjs --baseUrl http://localhost:3000 --config skills/design-review/templates/routes.example.json --outDir artifacts/design-review

Auth (optional):
  node skills/design-review/scripts/capture.mjs --initAuth
  - Starts an interactive Chromium session at /login and saves storage state to artifacts/design-review/auth.storageState.json
`);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function safeFilename(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[^\w.-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function joinUrl(baseUrl, route) {
  const base = new URL(baseUrl);
  const url = new URL(route, base);
  return url.toString();
}

async function loadPlaywright() {
  try {
    const mod = await import("playwright");
    return mod;
  } catch (err) {
    const msg =
      "Playwright is not installed. Run: npm i -D playwright && npx playwright install";
    const e = new Error(msg);
    e.cause = err;
    throw e;
  }
}

async function captureFromConfig({ baseUrl, configPath, outDir }) {
  const { chromium } = await loadPlaywright();

  const configRaw = fs.readFileSync(configPath, "utf8");
  const config = JSON.parse(configRaw);

  const viewports = config.viewports ?? [
    { name: "desktop", width: 1440, height: 900 },
    { name: "tablet", width: 768, height: 1024 },
    { name: "mobile", width: 390, height: 844, isMobile: true, hasTouch: true },
  ];

  const routes = config.routes ?? [];
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error(
      `No routes found in config. Expected { \"routes\": [...] } in ${configPath}`
    );
  }

  const storageState = config.storageState ? path.resolve(config.storageState) : null;

  ensureDir(outDir);
  const manifest = {
    baseUrl,
    createdAt: new Date().toISOString(),
    configPath: path.resolve(configPath),
    outDir: path.resolve(outDir),
    storageState,
    screenshots: [],
  };

  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        isMobile: viewport.isMobile ?? false,
        hasTouch: viewport.hasTouch ?? false,
        deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
        storageState: storageState ?? undefined,
      });

      const page = await context.newPage();

      for (const route of routes) {
        const routePath = route.path ?? route;
        const name = route.name ?? routePath;
        const url = joinUrl(baseUrl, routePath);

        await page.goto(url, { waitUntil: "networkidle" });

        if (route.waitForSelector) {
          await page.waitForSelector(route.waitForSelector, {
            state: "visible",
            timeout: route.timeoutMs ?? 15000,
          });
        } else {
          // Give client-side transitions a beat; keep it short.
          await page.waitForTimeout(350);
        }

        if (route.prep === "scroll") {
          await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
          await page.waitForTimeout(200);
        }

        const filename = `${safeFilename(name)}__${viewport.name}.png`;
        const filePath = path.join(outDir, filename);

        await page.screenshot({
          path: filePath,
          fullPage: route.fullPage ?? true,
        });

        manifest.screenshots.push({
          name,
          path: filePath,
          url,
          viewport,
        });
      }

      await context.close();
    }
  } finally {
    await browser.close();
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf8"
  );
}

async function initAuth({ baseUrl, outDir }) {
  const { chromium } = await loadPlaywright();
  ensureDir(outDir);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const loginUrl = joinUrl(baseUrl, "/login");
  console.log(`Open login page: ${loginUrl}`);
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });

  console.log("Complete login in the opened browser, then press Enter here to save auth state...");
  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => resolve());
  });

  const storagePath = path.join(outDir, "auth.storageState.json");
  await context.storageState({ path: storagePath });
  console.log(`Saved storage state: ${storagePath}`);

  await browser.close();
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const outDir = path.resolve(args.outDir);
  const configPath = path.resolve(args.config);
  const baseUrl = args.baseUrl;

  if (args.initAuth) {
    await initAuth({ baseUrl, outDir });
    return;
  }

  if (!fs.existsSync(configPath)) {
    throw new Error(`Config not found: ${configPath}`);
  }

  await captureFromConfig({ baseUrl, configPath, outDir });
  console.log(`Screenshots saved to: ${outDir}`);
}

main().catch((err) => {
  console.error(err?.message ?? err);
  process.exitCode = 1;
});

