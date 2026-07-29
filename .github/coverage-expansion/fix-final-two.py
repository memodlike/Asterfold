from pathlib import Path


def replace_exact(path_str: str, old: str, new: str, expected: int = 1) -> None:
    path = Path(path_str)
    source = path.read_text()
    count = source.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:120]!r}")
    path.write_text(source.replace(old, new))


replace_exact(
    "tests/appLauncherCoverage.test.ts",
    '''      openPages();
      const secondary = await screen.findByRole("menuitem", { name: "Secondary" });''',
    '''      openPages();
      await act(async () => { await Promise.resolve(); });
      const secondary = screen.getByRole("menuitem", { name: "Secondary" });''',
)
replace_exact(
    "tests/appLauncherCoverage.test.ts",
    '''    openMenu();
    openPages();
    const tertiary = await screen.findByRole("menuitem", { name: "Tertiary" });''',
    '''    openMenu();
    openPages();
    await act(async () => { await Promise.resolve(); });
    const tertiary = screen.getByRole("menuitem", { name: "Tertiary" });''',
)
replace_exact(
    "tests/componentLifecycleCoverage.test.ts",
    '  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {',
    '  Object.defineProperty(Element.prototype, "getBoundingClientRect", {',
)
