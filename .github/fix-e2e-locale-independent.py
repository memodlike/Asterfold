from pathlib import Path

path = Path("e2e/extension.spec.ts")
text = path.read_text()

old_hint = '    await hint.getByRole("button", { name: "Скрыть подсказку" }).click();'
new_hint = '''    const dismissHint = hint.locator(".launcher-discovery__dismiss");
    await expect(dismissHint).toHaveAccessibleName(/\\S/u);
    await dismissHint.click();'''
if text.count(old_hint) != 1:
    raise SystemExit(f"Expected one first-use dismiss selector, found {text.count(old_hint)}")
text = text.replace(old_hint, new_hint, 1)

old_forced = '''    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.getByRole("button", { name: "Открыть меню Asterfold" })).toBeVisible();'''
new_forced = '''    await page.emulateMedia({ forcedColors: "active" });
    await expect(page.locator(".launcher-trigger")).toBeVisible();'''
if text.count(old_forced) != 1:
    raise SystemExit(f"Expected one forced-colors launcher selector, found {text.count(old_forced)}")

path.write_text(text.replace(old_forced, new_forced, 1))
