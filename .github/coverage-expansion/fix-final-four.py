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
    '''  it("opens page actions by pointer and keyboard and routes every enabled action", () => {
    const { handlers } = renderLauncher();
    const actOnSecondary = (name: string): void => {
      openMenu();
      openPages();
      fireEvent.contextMenu(screen.getByRole("menuitem", { name: "Secondary" }), { clientX: 50, clientY: 80 });
      fireEvent.click(screen.getByRole("menuitem", { name }));
    };

    actOnSecondary("Rename");
    expect(handlers.onRenamePage).toHaveBeenCalledWith(pages[1]);
    actOnSecondary("Duplicate");
    expect(handlers.onDuplicatePage).toHaveBeenCalledWith(pages[1]);
    actOnSecondary("Default page");
    expect(handlers.onDefaultPage).toHaveBeenCalledWith(pages[1]);
    actOnSecondary("Move left");
    expect(handlers.onMovePage).toHaveBeenCalledWith(pages[1], 0);
    actOnSecondary("Move right");
    expect(handlers.onMovePage).toHaveBeenCalledWith(pages[1], 2);
    actOnSecondary("Move to Trash");
    expect(handlers.onDeletePage).toHaveBeenCalledWith(pages[1]);

    openMenu();
    openPages();
    const tertiary = screen.getByRole("menuitem", { name: "Tertiary" });''',
    '''  it("opens page actions by pointer and keyboard and routes every enabled action", async () => {
    const { handlers } = renderLauncher();
    const actOnSecondary = async (name: string): Promise<void> => {
      openMenu();
      openPages();
      const secondary = await screen.findByRole("menuitem", { name: "Secondary" });
      fireEvent.contextMenu(secondary, { clientX: 50, clientY: 80 });
      fireEvent.click(screen.getByRole("menuitem", { name }));
    };

    await actOnSecondary("Rename");
    expect(handlers.onRenamePage).toHaveBeenCalledWith(pages[1]);
    await actOnSecondary("Duplicate");
    expect(handlers.onDuplicatePage).toHaveBeenCalledWith(pages[1]);
    await actOnSecondary("Default page");
    expect(handlers.onDefaultPage).toHaveBeenCalledWith(pages[1]);
    await actOnSecondary("Move left");
    expect(handlers.onMovePage).toHaveBeenCalledWith(pages[1], 0);
    await actOnSecondary("Move right");
    expect(handlers.onMovePage).toHaveBeenCalledWith(pages[1], 2);
    await actOnSecondary("Move to Trash");
    expect(handlers.onDeletePage).toHaveBeenCalledWith(pages[1]);

    openMenu();
    openPages();
    const tertiary = await screen.findByRole("menuitem", { name: "Tertiary" });''',
)
replace_exact(
    "tests/componentLifecycleCoverage.test.ts",
    '''    const context = screen.getByRole("menu", { name: "Actions" });
    await waitFor(() => expect(context).toHaveStyle({ left: "132px", top: "112px" }));''',
    '''    const context = screen.getByRole("menu", { name: "Actions" });
    await act(async () => { await Promise.resolve(); });
    expect(context).toHaveStyle({ left: "132px", top: "112px" });''',
)
replace_exact(
    "tests/settingsDialogCoverage.test.ts",
    '''] as const) fireEvent.change(screen.getByRole("slider", { name: new RegExp(name) }), { target: { value } });''',
    '''] as const) {
      const label = screen.getByText(name, { selector: "strong" }).closest("label");
      const slider = label?.querySelector<HTMLInputElement>('input[type="range"]');
      expect(slider).not.toBeNull();
      fireEvent.change(slider!, { target: { value } });
    }''',
)
replace_exact(
    "tests/settingsDialogCoverage.test.ts",
    '''    fireEvent.change(screen.getByLabelText("Default page"), { target: { value: "page-two" } });
    expect(mocks.updateSettings).toHaveBeenCalledWith({ quickSaveDefaultPageId: "page-two", quickSaveDefaultBoardId: "board-two" });
    fireEvent.change(screen.getByLabelText("Default board"), { target: { value: "board-one" } });''',
    '''    const [defaultPage, defaultBoard] = screen.getAllByRole("combobox");
    fireEvent.change(defaultPage!, { target: { value: "page-two" } });
    expect(mocks.updateSettings).toHaveBeenCalledWith({ quickSaveDefaultPageId: "page-two", quickSaveDefaultBoardId: "board-two" });
    fireEvent.change(defaultBoard!, { target: { value: "board-one" } });''',
)
