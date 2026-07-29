from pathlib import Path


def replace_exact(path: Path, old: str, new: str, label: str) -> None:
    text = path.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    path.write_text(text.replace(old, new, 1))


settings_path = Path("tests/settingsDialogBehavior.test.ts")
settings_text = settings_path.read_text()
old_label = 'screen.getByRole("button", { name: "Russian" })'
new_label = 'screen.getByRole("button", { name: "Русский" })'
if old_label in settings_text:
    replace_exact(settings_path, old_label, new_label, "localized Settings label")
elif new_label not in settings_text:
    raise SystemExit("Localized Settings language assertion is missing")

repository_path = Path("tests/repositoryBranchCoverage.test.ts")
replace_exact(
    repository_path,
    '''    await expect(getWorkspaceData(database, false)).rejects.toThrow("Application settings are unavailable");
    await expect(purgeTrash(null, database)).resolves.toBe(0);
    expect(await auditInvariants(database)).toEqual(expect.arrayContaining([
      "No active Page exists",
      "Exactly one active default Page is required",
      "App settings are missing",
    ]));''',
    '''    await expect(getWorkspaceData(database, false)).rejects.toThrow("Application settings are unavailable");
    expect(await auditInvariants(database)).toEqual(expect.arrayContaining([
      "No active Page exists",
      "Exactly one active default Page is required",
      "App settings are missing",
    ]));
    const settings = createDefaultSettings();
    await database.settings.add(settings);
    await expect(getWorkspaceData(database, false)).resolves.toEqual({ pages: [], boards: [], bookmarks: [], settings });
    await expect(purgeTrash(null, database)).resolves.toBe(0);
    expect(await auditInvariants(database)).toEqual(expect.arrayContaining([
      "No active Page exists",
      "Exactly one active default Page is required",
      "Quick Save default Page points to a missing Page",
      "Quick Save last Page points to a missing Page",
    ]));''',
    "missing settings branches",
)
replace_exact(
    repository_path,
    '''    await expect(duplicatePage("missing", database)).rejects.toThrow("Page not found");

    await database.pages.update(configured.id, { deletedAt: timestamp });''',
    '''    await expect(duplicatePage("missing", database)).rejects.toThrow("Page not found");

    const detached = await createPage("Detached", {}, database);
    await softDeletePage(detached.id, database);
    await database.pages.update(detached.id, { deletedBatchId: null });
    await restorePage(detached.id, database);
    expect(await database.pages.get(detached.id)).toMatchObject({ deletedAt: null, deletedBatchId: null });

    await database.pages.update(configured.id, { deletedAt: timestamp });''',
    "Page restore branch",
)
replace_exact(
    repository_path,
    '''    expect(await database.boards.get(third.id)).toMatchObject({ version: thirdBefore?.version });''',
    '''    expect(await database.boards.get(third.id)).toMatchObject({ version: (thirdBefore?.version ?? 0) + 1 });''',
    "third Board reorder metadata",
)
