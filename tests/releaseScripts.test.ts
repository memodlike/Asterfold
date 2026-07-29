import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readZipEntries, shouldIncludeSourceFile, writeDeterministicZip } from "../scripts/release-lib.mjs";
import { verifyRequiredWorkflowRuns } from "../scripts/verify-required-workflows.mjs";

const directories: string[] = [];
afterEach(async () => Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))));

describe("release supply-chain gates", () => {
  it("creates byte-identical ZIPs with sorted, fixed-metadata entries", async () => {
    const directory = await mkdtemp(join(tmpdir(), "asterfold-release-test-"));
    directories.push(directory);
    const a = join(directory, "a.txt");
    const b = join(directory, "b.txt");
    await writeFile(a, "alpha"); await writeFile(b, "beta");
    const first = join(directory, "first.zip"); const second = join(directory, "second.zip");
    await writeDeterministicZip(first, [{ path: b, name: "b.txt" }, { path: a, name: "a.txt" }], writeFile);
    await writeDeterministicZip(second, [{ path: a, name: "a.txt" }, { path: b, name: "b.txt" }], writeFile);
    const firstBytes = await readFile(first); const secondBytes = await readFile(second);
    expect(createHash("sha256").update(firstBytes).digest("hex")).toBe(createHash("sha256").update(secondBytes).digest("hex"));
    expect(readZipEntries(firstBytes).map((entry) => entry.name)).toEqual(["a.txt", "b.txt"]);
  });

  it("canonicalizes checkout line endings and generated HTML whitespace", async () => {
    const directory = await mkdtemp(join(tmpdir(), "asterfold-release-text-test-"));
    directories.push(directory);
    const linuxText = join(directory, "linux.txt");
    const windowsText = join(directory, "windows.txt");
    const linuxHtml = join(directory, "linux.html");
    const windowsHtml = join(directory, "windows.html");
    await writeFile(linuxText, "alpha\nbeta\n");
    await writeFile(windowsText, "alpha\r\nbeta\r\n");
    await writeFile(linuxHtml, "<body>\n  <div></div>\n</body>\n");
    await writeFile(windowsHtml, "<body>\r\n  <div></div>\r\n\r\n</body>\r\n");
    const linuxZip = join(directory, "linux.zip");
    const windowsZip = join(directory, "windows.zip");
    await writeDeterministicZip(linuxZip, [{ path: linuxText, name: ".editorconfig" }, { path: linuxHtml, name: "newtab.html" }], writeFile);
    await writeDeterministicZip(windowsZip, [{ path: windowsText, name: ".editorconfig" }, { path: windowsHtml, name: "newtab.html" }], writeFile);
    expect(await readFile(windowsZip)).toEqual(await readFile(linuxZip));
  });

  it("excludes transient CI evidence from the source archive", () => {
    const excludedRoots = new Set(["release", "coverage"]);
    expect(shouldIncludeSourceFile("src/index.ts", excludedRoots)).toBe(true);
    expect(shouldIncludeSourceFile("npm-audit.json", excludedRoots)).toBe(false);
    expect(shouldIncludeSourceFile("typecheck.log", excludedRoots)).toBe(false);
    expect(shouldIncludeSourceFile("release/Asterfold-Chrome.zip", excludedRoots)).toBe(false);
    expect(shouldIncludeSourceFile("src/.env.production", excludedRoots)).toBe(false);
  });

  it("rejects duplicate and traversal ZIP entries", async () => {
    const directory = await mkdtemp(join(tmpdir(), "asterfold-release-test-"));
    directories.push(directory);
    const file = join(directory, "file.txt"); await writeFile(file, "data");
    await expect(writeDeterministicZip(join(directory, "duplicate.zip"), [{ path: file, name: "x" }, { path: file, name: "x" }], writeFile)).rejects.toThrow("Duplicate ZIP entry");
    await expect(writeDeterministicZip(join(directory, "traversal.zip"), [{ path: file, name: "../x" }], writeFile)).rejects.toThrow("Unsafe ZIP entry");
  });

  it("requires successful push runs for the exact release SHA", () => {
    const sha = "a".repeat(40);
    expect(verifyRequiredWorkflowRuns([
      { name: "CI", head_sha: sha, event: "push", status: "completed", conclusion: "success" },
      { name: "CodeQL", head_sha: sha, event: "push", status: "completed", conclusion: "success" },
    ], ["CI", "CodeQL"], sha)).toBe(true);
    expect(() => verifyRequiredWorkflowRuns([
      { name: "CI", head_sha: sha, event: "pull_request", status: "completed", conclusion: "success" },
      { name: "CodeQL", head_sha: sha, event: "push", status: "completed", conclusion: "failure" },
    ], ["CI", "CodeQL"], sha)).toThrow("Required workflow verification failed");
  });
});
