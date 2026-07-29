from pathlib import Path
import re

files = [
    "tests/appLauncherCoverage.test.ts",
    "tests/bookmarkCardCoverage.test.ts",
    "tests/bookmarkEditorCoverage.test.ts",
    "tests/componentLifecycleCoverage.test.ts",
    "tests/searchPaletteCoverage.test.ts",
    "tests/settingsDialogCoverage.test.ts",
    "tests/trashDialogCoverage.test.ts",
]


def replace_exact(path_str: str, old: str, new: str, expected: int = 1) -> None:
    path = Path(path_str)
    source = path.read_text()
    count = source.count(old)
    if count != expected:
        raise SystemExit(f"{path}: expected {expected} matches, found {count}: {old[:120]!r}")
    path.write_text(source.replace(old, new))


for raw_path in files:
    path = Path(raw_path)
    source = path.read_text()
    source = source.replace(
        'Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get() { return this.parentElement; } });',
        'Object.defineProperty(HTMLElement.prototype, "offsetParent", { configurable: true, get: () => document.body });',
    )
    source = re.sub(
        r'act\(\(\) => vi\.(advanceTimersByTime|runOnlyPendingTimers)\(([^)]*)\)\);',
        lambda match: f'act(() => {{ vi.{match.group(1)}({match.group(2)}); }});',
        source,
    )
    source = re.sub(
        r'act\(\(\) => controller\(\)\.push\((.*)\)\);',
        r'act(() => { controller().push(\1); });',
        source,
    )
    path.write_text(source)

replace_exact(
    "tests/searchPaletteCoverage.test.ts",
    '  const input = screen.getByRole("textbox");',
    '  const input = screen.getByRole("textbox") as HTMLInputElement;',
)
replace_exact(
    "tests/bookmarkEditorCoverage.test.ts",
    '    await act(() => { finish?.({ ...existing, id: "finished" }); });',
    '''    act(() => { finish?.({ ...existing, id: "finished" }); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Save" })).not.toBeDisabled());''',
)
for raw_path, old_value, new_value in [
    ("tests/componentLifecycleCoverage.test.ts", "    await act(() => { finish?.(); });", "    act(() => { finish?.(); });"),
    ("tests/settingsDialogCoverage.test.ts", "    await act(() => { finish?.([]); });", "    act(() => { finish?.([]); });"),
    ("tests/trashDialogCoverage.test.ts", "    await act(() => { finish?.(); });", "    act(() => { finish?.(); });"),
]:
    replace_exact(raw_path, old_value, new_value)

for raw_path in ["tests/settingsDialogCoverage.test.ts", "tests/trashDialogCoverage.test.ts"]:
    path = Path(raw_path)
    source = path.read_text()
    marker = '}));\n\n'
    if source.count(marker) < 1:
        raise SystemExit(f"Missing mock declaration marker in {raw_path}")
    source = source.replace(marker, '}));\n\nconst confirmMock = vi.fn();\n\n', 1)
    old_spy = '  vi.spyOn(window, "confirm").mockReturnValue(true);'
    new_spy = '''  confirmMock.mockReset();
  confirmMock.mockReturnValue(true);
  vi.spyOn(window, "confirm").mockImplementation(confirmMock);'''
    if source.count(old_spy) != 1:
        raise SystemExit(f"Expected one confirm spy in {raw_path}")
    source = source.replace(old_spy, new_spy, 1)
    source = source.replace("vi.mocked(window.confirm).mockReturnValueOnce", "confirmMock.mockReturnValueOnce")
    source = source.replace("vi.mocked(window.confirm).mockReturnValue", "confirmMock.mockReturnValue")
    path.write_text(source)

replace_exact(
    "tests/appLauncherCoverage.test.ts",
    '''function openPages(): void {
  fireEvent.click(screen.getByRole("menuitem", { name: "Pages" }));
}''',
    '''function openPages(): void {
  if (!screen.queryByRole("menuitem", { name: "Pages" })) openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Pages" }));
}''',
)
replace_exact(
    "tests/bookmarkEditorCoverage.test.ts",
    '    fireEvent.click(screen.getByRole("button", { name: "Close" }));\n    expect(handlers.onClose).toHaveBeenCalledOnce();',
    '    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);\n    expect(handlers.onClose).toHaveBeenCalledOnce();',
)
replace_exact(
    "tests/componentLifecycleCoverage.test.ts",
    '''    const dialog = screen.getByRole("dialog");
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog).toHaveFocus();''',
    '''    const dialog = screen.getByRole("dialog");
    const closeButton = screen.getByRole("button", { name: "Close" });
    Object.defineProperty(closeButton, "offsetParent", { configurable: true, value: null });
    fireEvent.keyDown(document, { key: "Tab" });
    expect(dialog).toHaveFocus();''',
)
replace_exact(
    "tests/componentLifecycleCoverage.test.ts",
    '''  it("constrains placement and assigns menuitem roles", () => {
    menu();
    const context = screen.getByRole("menu", { name: "Actions" });
    expect(context).toHaveStyle({ left: "132px", top: "112px" });''',
    '''  it("constrains placement and assigns menuitem roles", async () => {
    menu();
    const context = screen.getByRole("menu", { name: "Actions" });
    await waitFor(() => expect(context).toHaveStyle({ left: "132px", top: "112px" }));''',
)
component = Path("tests/componentLifecycleCoverage.test.ts")
source = component.read_text()
source = source.replace('getAllByRole("button", { name: "Dismiss" })', 'getAllByRole("button", { name: "Dismiss notification" })')
source = source.replace('getByRole("button", { name: "Dismiss" })', 'getByRole("button", { name: "Dismiss notification" })')
source = source.replace("    fireEvent.focus(undo);", "    undo.focus();")
old_pending = '''    act(() => { finish?.(); });
    await waitFor(() => expect(screen.queryByText("Undoable")).toBeNull());'''
new_pending = '''    await act(async () => {
      finish?.();
      await Promise.resolve();
    });
    expect(screen.queryByText("Undoable")).toBeNull();'''
if source.count(old_pending) != 1:
    raise SystemExit("Expected one pending toast action resolution")
component.write_text(source.replace(old_pending, new_pending, 1))

settings = Path("tests/settingsDialogCoverage.test.ts")
source = settings.read_text()
source = source.replace('screen.getByRole("slider", { name })', 'screen.getByRole("slider", { name: new RegExp(name) })')
source = source.replace('screen.getByRole("button", { name: "Russian" })', 'screen.getByRole("button", { name: "Русский" })')
source = source.replace("for (let index = 0; index < 80; index += 1)", "for (let index = 0; index < 110; index += 1)")
source = source.replace('const retention = screen.getByLabelText("Keep deleted items");', 'const retention = screen.getByRole("combobox");')
settings.write_text(source)

forbidden = [
    "get() { return this.parentElement; }",
    "act(() => vi.advanceTimersByTime",
    "act(() => vi.runOnlyPendingTimers",
    "act(() => controller().push",
    "await act(() => { finish",
    "vi.mocked(window.confirm)",
    'const input = screen.getByRole("textbox");',
]
combined = "\n".join(Path(item).read_text() for item in files)
for pattern in forbidden:
    if pattern in combined:
        raise SystemExit(f"Normalization incomplete: {pattern}")
