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
    '''function openPages(): void {
  if (!screen.queryByRole("menuitem", { name: "Pages" })) openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Pages" }));
}''',
    '''function openPages(): void {
  const launcherTrigger = screen.getByRole("button", { name: "Open Asterfold menu" });
  if (launcherTrigger.getAttribute("aria-expanded") !== "true") fireEvent.click(launcherTrigger);
  const pagesTrigger = screen.getByRole("menuitem", { name: "Pages" });
  if (pagesTrigger.getAttribute("aria-expanded") !== "true") fireEvent.click(pagesTrigger);
}''',
)
replace_exact(
    "tests/appLauncherCoverage.test.ts",
    '  it("opens page actions by pointer and keyboard and routes every enabled action", async () => {',
    '  it("opens page actions by pointer and keyboard and routes every enabled action", () => {',
)
replace_exact(
    "tests/appLauncherCoverage.test.ts",
    '    const actOnSecondary = async (name: string): Promise<void> => {',
    '    const actOnSecondary = (name: string): void => {',
)
replace_exact(
    "tests/appLauncherCoverage.test.ts",
    '''      openMenu();
      openPages();
      await act(async () => { await Promise.resolve(); });''',
    '''      openPages();''',
)
replace_exact(
    "tests/appLauncherCoverage.test.ts",
    '''    openMenu();
    openPages();
    await act(async () => { await Promise.resolve(); });''',
    '''    openPages();''',
)
replace_exact(
    "tests/appLauncherCoverage.test.ts",
    '    await actOnSecondary(',
    '    actOnSecondary(',
    expected=6,
)

replace_exact(
    "tests/componentLifecycleCoverage.test.ts",
    '''  it("constrains placement and assigns menuitem roles", async () => {
    menu();
    const context = screen.getByRole("menu", { name: "Actions" });
    await act(async () => { await Promise.resolve(); });
    expect(context).toHaveStyle({ left: "132px", top: "112px" });
    expect(screen.getByRole("menuitem", { name: "Alpha" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });''',
    '''  it("constrains placement and assigns menuitem roles", async () => {
    const { rerender, onClose } = menu();
    const context = screen.getByRole("menu", { name: "Actions" });
    Object.defineProperty(context, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({ x: 0, y: 0, top: 0, right: 180, bottom: 120, left: 0, width: 180, height: 120, toJSON: () => ({}) })),
    });
    rerender(createElement(FloatingContextMenu, {
      label: "Actions",
      point: { x: 301, y: 231 },
      onClose,
      children: createElement("div", null,
        createElement("button", null, "Alpha"),
        createElement("button", { disabled: true }, "Disabled"),
        createElement("button", null, "Beta"),
        createElement("button", null, "Bravo"),
      ),
    }));
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("menu", { name: "Actions" })).toHaveStyle({ left: "132px", top: "112px" });
    expect(screen.getByRole("menuitem", { name: "Alpha" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Disabled" })).toBeDisabled();
  });''',
)
