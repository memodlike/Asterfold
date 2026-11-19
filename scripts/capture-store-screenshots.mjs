#!/usr/bin/env node
/*
 * Captures the Chrome Web Store screenshots from the real, unpacked production build.
 *
 *   npm run build
 *   node scripts/capture-store-screenshots.mjs
 *
 * 1. Builds a neutral demo workspace with Asterfold's own repository code (tests/storeDemoSeed.test.ts).
 * 2. Loads .output/chrome-mv3 into a fresh Chromium profile and moves the demo in through the
 *    regular welcome screen, exactly as a person restoring a backup would.
 * 3. Captures each scene at 2x and sets it under a short caption on a 1280×800 canvas.
 *    The product area is an unedited capture of the running extension; only the caption band is added.
 *
 * Set ASTERFOLD_CHROMIUM_PATH to a Chromium or Chrome for Testing binary: branded Google Chrome
 * ignores --load-extension. Site icons are loaded from the demo sites, so run it online.
 */
/* global document, Image -- these run inside the captured pages */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";

const root = resolve(".");
const extensionPath = resolve(process.env.ASTERFOLD_EXTENSION_PATH ?? ".output/chrome-mv3");
const outDir = resolve(process.env.STORE_SCREENSHOT_DIR ?? "store-assets/screenshots");
const promoDir = resolve(process.env.STORE_PROMO_DIR ?? "store-assets/promo");
const rawDir = process.env.STORE_RAW_DIR ? resolve(process.env.STORE_RAW_DIR) : null;
const size = { width: 1280, height: 800 };

const SCENES = [
  { file: "01-workspace-1280x800.png", title: "Your bookmarks, one glance away", body: "Every new tab opens on Pages and Boards of the sites you use most." },
  { file: "02-search-1280x800.png", title: "Find any link in a keystroke", body: "Press Ctrl+K and type a few letters. Open it in a tab, a window or right here." },
  { file: "03-welcome-1280x800.png", title: "Move in within a minute", body: "Start with a ready workspace, or bring your Chrome bookmarks from the file Chrome exports." },
  { file: "04-appearance-1280x800.png", title: "Make it yours", body: "Themes, wallpapers and frosted glass, with a lightweight mode for older laptops." },
  { file: "05-privacy-1280x800.png", title: "Private by design", body: "No account, no tracking and no permissions. Privacy Mode hides titles from onlookers." },
];

function browserPath() {
  const candidates = [process.env.ASTERFOLD_CHROMIUM_PATH, chromium.executablePath()].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chromium is missing. Set ASTERFOLD_CHROMIUM_PATH to Chromium or Chrome for Testing.");
  return found;
}

async function extensionWorker(context) {
  return context.serviceWorkers().find((worker) => worker.url().startsWith("chrome-extension://"))
    ?? context.waitForEvent("serviceworker", { predicate: (worker) => worker.url().startsWith("chrome-extension://"), timeout: 20_000 });
}

async function settle(page, ms = 600) {
  await page.evaluate(() => document.fonts?.ready);
  await page.waitForTimeout(ms);
}

async function compose(context, raw, scene) {
  const page = await context.newPage();
  await page.setViewportSize(size);
  const shot = `data:image/png;base64,${raw.toString("base64")}`;
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;width:1280px;height:800px;overflow:hidden}
    body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Segoe UI",sans-serif;color:#f4f5fb;
      background:radial-gradient(120% 90% at 18% 0%,#2a2f6b 0%,#141733 46%,#0b0d1f 100%);}
    header{position:absolute;left:96px;right:96px;top:34px}
    h1{margin:0;font-size:36px;line-height:1.15;font-weight:700;letter-spacing:-.02em}
    p{margin:8px 0 0;font-size:17px;line-height:1.4;color:#b9bdda}
    figure{position:absolute;left:96px;top:150px;margin:0;width:1088px;height:680px;border-radius:16px;overflow:hidden;
      box-shadow:0 30px 80px rgb(0 0 0 / .55),0 0 0 1px rgb(255 255 255 / .10)}
    figure img{display:block;width:1088px;height:680px}
  </style></head><body>
    <header><h1></h1><p></p></header>
    <figure><img alt=""></figure>
  </body></html>`);
  await page.evaluate(({ shot, title, body }) => {
    document.querySelector("h1").textContent = title;
    document.querySelector("p").textContent = body;
    document.querySelector("img").src = shot;
  }, { shot, title: scene.title, body: scene.body });
  await page.locator("img").evaluate((img) => img.decode());
  const output = join(outDir, scene.file);
  await page.screenshot({ path: output });
  await page.close();
  console.log(`wrote ${output}`);
}

const MARK = `<g fill="#ffffff"><path d="M32 3 41 24 35 29 28 24Z"/><path d="m61 32-21 9-5-6 5-7Z"/><path d="m32 61-9-21 6-5 7 5Z"/><path d="M3 32 24 23l5 6-5 7Z"/></g><path d="m32 28 4 4-4 4-4-4Z" fill="#141733"/>`;
const FONT = `-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', sans-serif`;

function escapeXml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Editable promo sources: vector text and mark over one embedded, unedited capture of the workspace. */
function marqueeSvg(capture) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
  <defs>
    <radialGradient id="bg" cx="18%" cy="0%" r="120%"><stop offset="0" stop-color="#2a2f6b"/><stop offset=".46" stop-color="#141733"/><stop offset="1" stop-color="#0b0d1f"/></radialGradient>
    <clipPath id="shot"><rect x="600" y="64" width="880" height="550" rx="18"/></clipPath>
  </defs>
  <rect width="1400" height="560" fill="url(#bg)"/>
  <rect x="600" y="64" width="880" height="550" rx="18" fill="#000" opacity=".45" transform="translate(0 18)"/>
  <image href="${capture}" x="600" y="64" width="880" height="550" preserveAspectRatio="xMinYMin slice" clip-path="url(#shot)"/>
  <rect x="600.5" y="64.5" width="879" height="549" rx="18" fill="none" stroke="#ffffff" stroke-opacity=".12"/>
  <g transform="translate(88 150) scale(1.05)">${MARK}</g>
  <text x="86" y="300" fill="#f4f5fb" font-family="${FONT}" font-size="66" font-weight="700" letter-spacing="-1.5">Asterfold</text>
  <text x="88" y="352" fill="#e4e6f6" font-family="${FONT}" font-size="27" font-weight="500">${escapeXml("Your bookmarks on every new tab")}</text>
  <text x="88" y="396" fill="#b9bdda" font-family="${FONT}" font-size="19">${escapeXml("No account. No tracking. No permissions.")}</text>
</svg>
`;
}

function smallPromoSvg(capture) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <defs>
    <radialGradient id="bg" cx="10%" cy="0%" r="130%"><stop offset="0" stop-color="#2a2f6b"/><stop offset=".5" stop-color="#141733"/><stop offset="1" stop-color="#0b0d1f"/></radialGradient>
    <clipPath id="shot"><rect x="226" y="40" width="260" height="270" rx="14"/></clipPath>
  </defs>
  <rect width="440" height="280" fill="url(#bg)"/>
  <image href="${capture}" x="200" y="12" width="704" height="440" preserveAspectRatio="xMinYMin slice" clip-path="url(#shot)"/>
  <rect x="226.5" y="40.5" width="259" height="269" rx="14" fill="none" stroke="#ffffff" stroke-opacity=".14"/>
  <g transform="translate(26 70) scale(.6)">${MARK}</g>
  <text x="24" y="150" fill="#f4f5fb" font-family="${FONT}" font-size="38" font-weight="700" letter-spacing="-.8">Asterfold</text>
  <text x="26" y="180" fill="#e4e6f6" font-family="${FONT}" font-size="16" font-weight="500">${escapeXml("Bookmarks on")}</text>
  <text x="26" y="201" fill="#e4e6f6" font-family="${FONT}" font-size="16" font-weight="500">${escapeXml("every new tab")}</text>
</svg>
`;
}

async function renderPromo(context, svg, sourcePath, pngPath, width, height) {
  await writeFile(sourcePath, svg, "utf8");
  const page = await context.newPage();
  await page.setViewportSize({ width, height });
  await page.setContent(`<!doctype html><html><body style="margin:0;background:#0b0d1f">${svg}</body></html>`);
  await page.locator("svg image").evaluateAll((images) => Promise.all(images.map((image) => new Promise((done) => {
    const probe = new Image();
    probe.onload = done;
    probe.onerror = done;
    probe.src = image.getAttribute("href");
  }))));
  await page.waitForTimeout(200);
  await page.screenshot({ path: pngPath, clip: { x: 0, y: 0, width, height } });
  await page.close();
  console.log(`wrote ${pngPath}`);
}

async function main() {
  if (!existsSync(join(extensionPath, "manifest.json"))) throw new Error(`Build the extension first: ${extensionPath} has no manifest.json`);
  const work = await mkdtemp(join(tmpdir(), "asterfold-store-"));
  const seed = join(work, "demo-backup.json");
  execFileSync("npx", ["vitest", "run", "tests/storeDemoSeed.test.ts"], { cwd: root, env: { ...process.env, STORE_SEED_OUT: seed }, stdio: "inherit" });
  if (!existsSync(seed)) throw new Error("Demo workspace was not generated");
  await mkdir(outDir, { recursive: true });
  if (rawDir) await mkdir(rawDir, { recursive: true });

  const context = await chromium.launchPersistentContext(join(work, "profile"), {
    executablePath: browserPath(),
    headless: false,
    viewport: size,
    deviceScaleFactor: 2,
    locale: "en-US",
    args: [
      "--headless=new",
      "--no-sandbox",
      "--disable-crash-reporter",
      "--hide-scrollbars",
      "--lang=en-US",
      "--disable-features=DisableLoadExtensionCommandLineSwitch",
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  const raws = new Map();
  const capture = async (page, file) => {
    const buffer = await page.screenshot();
    raws.set(file, buffer);
    if (rawDir) await writeFile(join(rawDir, file), buffer);
  };

  try {
    const worker = await extensionWorker(context);
    const extensionId = new URL(worker.url()).hostname;
    // Close the welcome tab Chrome opened on install; the capture drives its own tab.
    await delay(800);
    const page = await context.newPage();
    for (const other of context.pages()) if (other !== page) await other.close();
    await page.goto(`chrome-extension://${extensionId}/newtab.html`);

    // Welcome screen, as a new user sees it, with the appearance a person would pick there.
    await page.locator(".onboarding-tile").first().waitFor();
    await page.locator(".onboarding-walls").getByRole("radio", { name: /quiet aurora/iu }).click();
    await page.getByRole("button", { name: /^dark$/iu }).click();
    await settle(page, 900);
    await capture(page, SCENES[2].file);

    // Move the demo workspace in through the backup option of the same screen.
    await page.locator('input[type="file"][accept^=".json"]').setInputFiles(seed);
    await page.locator(".onboarding-status.is-ready").waitFor();
    await page.locator(".onboarding-open").click();
    await page.locator(".onboarding-modal").waitFor({ state: "detached" });
    const tour = page.getByTestId("guide-tour");
    // The first-run tips arrive a moment later; end them the way a person would.
    if (await tour.waitFor({ timeout: 6_000 }).then(() => true, () => false)) {
      await page.keyboard.press("Escape");
      await tour.waitFor({ state: "detached" });
    }
    await page.mouse.move(1270, 790);
    await page.waitForLoadState("networkidle").catch(() => undefined);
    await settle(page, 2500);
    await capture(page, SCENES[0].file);

    // Search.
    await page.keyboard.press("Control+k");
    await page.getByRole("dialog").first().waitFor();
    await page.keyboard.type("go", { delay: 60 });
    await settle(page, 900);
    await capture(page, SCENES[1].file);
    await page.keyboard.press("Escape");
    await settle(page, 400);

    // Appearance settings.
    await page.locator(".launcher-trigger").click();
    await page.getByRole("menuitem", { name: /settings/iu }).click();
    await page.locator(".settings-modal").waitFor();
    const appearance = page.locator(".settings-tile").first();
    if (await appearance.isVisible().catch(() => false)) await appearance.click();
    await settle(page, 1200);
    await capture(page, SCENES[3].file);
    await page.keyboard.press("Escape");
    await settle(page, 500);

    // Privacy Mode from the Asterfold menu, then the workspace with titles hidden.
    await page.locator(".launcher-trigger").click();
    await page.getByRole("menuitemcheckbox", { name: /privacy mode/iu }).click();
    await page.mouse.move(1270, 790);
    await page.locator(".toast").first().waitFor({ state: "detached", timeout: 15_000 }).catch(() => undefined);
    await settle(page, 900);
    await capture(page, SCENES[4].file);
  } finally {
    await context.close();
  }

  const composer = await chromium.launch({ executablePath: browserPath(), headless: true });
  const composeContext = await composer.newContext({ viewport: size, deviceScaleFactor: 1 });
  try {
    for (const scene of SCENES) {
      const raw = raws.get(scene.file);
      if (raw) await compose(composeContext, raw, scene);
      else console.warn(`skipped ${scene.file}: not captured`);
    }
    const workspace = raws.get(SCENES[0].file);
    if (workspace && promoDir) {
      // A 1920×1200 JPEG keeps the editable SVG sources small; the tiles show it at about 1×.
      const shrink = await composer.newContext({ viewport: size, deviceScaleFactor: 1.5 });
      const shrinkPage = await shrink.newPage();
      await shrinkPage.setContent(`<!doctype html><body style="margin:0"><img style="display:block;width:1280px;height:800px" src="data:image/png;base64,${workspace.toString("base64")}"></body>`);
      await shrinkPage.locator("img").evaluate((img) => img.decode());
      const jpeg = await shrinkPage.screenshot({ type: "jpeg", quality: 82 });
      await shrink.close();
      const capture = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      await mkdir(promoDir, { recursive: true });
      await renderPromo(composeContext, marqueeSvg(capture), join(promoDir, "marquee-source.svg"), join(promoDir, "marquee-1400x560.png"), 1400, 560);
      await renderPromo(composeContext, smallPromoSvg(capture), join(promoDir, "small-promo-source.svg"), join(promoDir, "small-promo-440x280.png"), 440, 280);
    }
  } finally {
    await composer.close();
    await rm(work, { recursive: true, force: true });
  }
}

await main();
