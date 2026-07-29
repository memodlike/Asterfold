import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { version as packageVersion } from "../package.json";

const execFileAsync = promisify(execFile);
const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

describe("Chrome Web Store manifest policy", () => {
  beforeAll(async () => {
    await execFileAsync(npmExecutable, ["run", "build"], { cwd: process.cwd() });
  }, 30_000);

  it("keeps package, WXT and release validation on one least-privilege version policy", async () => {
    const [config, releaseValidator, background] = await Promise.all([
      readFile(join(process.cwd(), "wxt.config.ts"), "utf8"),
      readFile(join(process.cwd(), "scripts/release.mjs"), "utf8"),
      readFile(join(process.cwd(), "entrypoints", "background.ts"), "utf8"),
    ]);

    expect(packageVersion).toBe("3.0.1");
    expect(config).toContain("version: packageVersion");
    expect(config).toMatch(/permissions:\s*\[[^\]]*["']storage["']/su);
    expect(releaseValidator).toContain("storage");
    expect(releaseValidator).toContain("new\\s+(?:Shared)?Worker");
    expect(releaseValidator).toContain("WebAssembly");
    expect(releaseValidator).toContain("<iframe");
    expect(await readFile(join(process.cwd(), "src", "services", "exportImport.ts"), "utf8")).not.toContain('appVersion: "2.1.3"');
    expect(background).toContain("const BADGE_CLEAR_DELAY_MINUTES = 0.5;");
    expect(background).toContain("delayInMinutes: BADGE_CLEAR_DELAY_MINUTES");
  });

  it("validates the built manifest as MV3 with the exact allowed permission set", async () => {
    const manifestPath = join(process.cwd(), ".output", "chrome-mv3", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      manifest_version: number;
      version: string;
      permissions?: string[];
      optional_permissions?: string[];
      host_permissions?: string[];
      content_security_policy?: { extension_pages?: string };
      content_scripts?: unknown[];
    };

    expect(manifest.manifest_version).toBe(3);
    expect(manifest.version).toBe(packageVersion);
    expect(new Set(manifest.permissions)).toEqual(new Set(["activeTab", "favicon", "alarms", "contextMenus", "storage"]));
    expect(manifest.permissions).not.toEqual(expect.arrayContaining(["identity", "tabs", "history", "scripting", "webRequest", "cookies"]));
    expect(manifest.optional_permissions).toEqual(["bookmarks"]);
    expect(manifest.host_permissions).toEqual([]);
    expect(manifest.content_security_policy?.extension_pages).toBe("script-src 'self'; object-src 'self'; base-uri 'self'");
    expect(manifest.content_scripts).toBeUndefined();
  });

  it("makes the release validator fail closed on a version mismatch", async () => {
    const manifestPath = join(process.cwd(), ".output", "chrome-mv3", "manifest.json");
    const original = await readFile(manifestPath, "utf8");
    const manifest = JSON.parse(original) as { version: string };
    try {
      await writeFile(manifestPath, JSON.stringify({ ...manifest, version: "0.0.0" }), "utf8");
      await expect(execFileAsync(process.execPath, ["scripts/release.mjs"], { cwd: process.cwd() }))
        .rejects.toThrow(/Package and manifest versions differ/u);
    } finally {
      await writeFile(manifestPath, original, "utf8");
    }
  });
});
