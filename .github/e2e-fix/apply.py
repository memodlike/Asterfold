from pathlib import Path

path = Path("e2e/extension.spec.ts")
source = path.read_text()
old = '''    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    const hint = page.locator(".launcher-discovery");'''
new = '''    await page.goto(`chrome-extension://${extensionId}/newtab.html`);
    await setWorkspaceLocale(page, "ru");
    await page.reload();
    const hint = page.locator(".launcher-discovery");'''
count = source.count(old)
if count != 1:
    raise SystemExit(f"Expected one first-use flow match, found {count}")
path.write_text(source.replace(old, new, 1))
