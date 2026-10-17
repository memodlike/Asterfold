import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { WorkspaceData } from "../src/domain/models";
import { I18nProvider } from "../src/i18n";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  parseHtml: vi.fn(),
  parseBackup: vi.fn(),
  publishThemePreview: vi.fn(),
}));

vi.mock("../src/features/onboarding/onboardingCommit", () => ({
  commitOnboardingPlan: mocks.commit,
}));
vi.mock("../src/services/importWorker", () => ({
  parseHtmlOffThread: mocks.parseHtml,
  parseBackupOffThread: mocks.parseBackup,
}));
vi.mock("../src/features/appearance/themePreview", () => ({
  publishThemePreview: mocks.publishThemePreview,
}));

import { OnboardingWizard } from "../src/features/onboarding/OnboardingWizard";

function workspace(): WorkspaceData {
  return {
    pages: [],
    boards: [],
    bookmarks: [],
    settings: createDefaultSettings(),
  };
}

function renderWizard(onCompleted = vi.fn()) {
  const data = workspace();
  const view = render(createElement(I18nProvider, {
    preference: "en",
    children: createElement(OnboardingWizard, { workspace: data, onCompleted }),
  }));
  return { ...view, data, onCompleted };
}

beforeEach(() => {
  mocks.commit.mockReset();
  mocks.parseHtml.mockReset();
  mocks.parseBackup.mockReset();
  mocks.publishThemePreview.mockReset();
  mocks.commit.mockResolvedValue({ status: "completed", imported: 0, skippedDuplicates: 0 });
});

describe("one-screen onboarding", () => {
  it("shows language, bookmarks and appearance together and commits once with the chosen look", async () => {
    const { onCompleted } = renderWizard();
    expect(screen.getByRole("heading", { name: "Welcome to Asterfold" })).toBeVisible();
    expect(screen.getByText(/No account and no analytics/u)).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
    for (const name of ["Interface language", "Bookmarks", "Appearance"]) expect(screen.getByRole("region", { name })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Start with Asterfold/u })).toHaveAttribute("aria-checked", "true");
    // The old step navigation is gone: no Continue/Back buttons and no close button.
    expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    fireEvent.click(screen.getByRole("radio", { name: "Dusk" }));
    expect(screen.getByRole("radio", { name: "Dusk" })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(mocks.publishThemePreview).toHaveBeenLastCalledWith(expect.objectContaining({ wallpaperId: "builtin-dusk", backgroundMode: "wallpaper", mode: "dark", density: "compact" })));

    fireEvent.click(screen.getByRole("button", { name: "Open my workspace" }));
    await waitFor(() => expect(mocks.commit).toHaveBeenCalledTimes(1));
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      locale: "auto",
      source: "default",
      theme: { mode: "dark", density: "compact", wallpaperId: "builtin-dusk", backgroundMode: "wallpaper" },
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("asks before skipping, returns to setup, and commits defaults when confirmed", async () => {
    const { data, onCompleted } = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Skip setup" }));
    expect(screen.getByRole("heading", { name: "Skip guided setup?" })).toBeVisible();
    expect(mocks.commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue setup" }));
    expect(screen.getByRole("heading", { name: "Welcome to Asterfold" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Skip setup" }));
    fireEvent.click(screen.getByRole("button", { name: "Skip and use defaults" }));
    await waitFor(() => expect(mocks.commit).toHaveBeenCalledTimes(1));
    expect(mocks.commit.mock.calls[0]?.[0]).toMatchObject({
      locale: data.settings.locale,
      source: "default",
      records: [],
      backup: null,
      theme: data.settings.theme,
      workspaceRows: data.settings.workspaceRows,
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("recomputes auto language label dynamically when locale changes (A10)", () => {
    const { container } = renderWizard();
    const select = screen.getByRole("combobox", { name: "Interface language" }) as HTMLSelectElement;
    const autoOption = container.querySelector<HTMLOptionElement>('option[value="auto"]')!;

    expect(autoOption.textContent).toContain("Auto (Chrome language)");

    fireEvent.change(select, { target: { value: "ru" } });
    expect(autoOption.textContent).toContain("Авто (язык Chrome)");

    fireEvent.change(select, { target: { value: "kk" } });
    expect(autoOption.textContent).toContain("Авто (Chrome тілі)");
  });

  it("does not offer Chrome bookmark import and displays export hint (K2)", () => {
    renderWizard();
    expect(screen.queryByRole("radio", { name: /Import from Chrome/u })).toBeNull();
    expect(screen.getByRole("radio", { name: /Start with Asterfold/u })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Import bookmark HTML/u })).toBeVisible();
    expect(screen.getByText(/To import from Chrome: Chrome menu → Bookmarks and lists/u)).toBeVisible();
  });

  it("opens the file picker from the source itself, parses off-thread and clears stale previews", async () => {
    mocks.parseHtml.mockResolvedValue([
      { title: "A", url: "https://a.example", description: null, folderPath: ["Work"] },
      { title: "B", url: "https://b.example", description: null, folderPath: ["Work"] },
    ]);
    const { container } = renderWizard();
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="text/html"]')!;
    const picker = vi.spyOn(input, "click");
    fireEvent.click(screen.getByRole("radio", { name: /Import bookmark HTML/u }));
    expect(picker).toHaveBeenCalledTimes(1);
    const file = new File(["<DL><p></DL>"], "bookmarks.html", { type: "text/html" });
    Object.defineProperty(file, "text", { configurable: true, value: vi.fn().mockResolvedValue("<DL><p></DL>") });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText("bookmarks.html");
    expect(screen.getByText("Bookmarks: 2 · boards: 1")).toBeVisible();
    expect(mocks.parseHtml).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("radio", { name: /Start with Asterfold/u }));
    expect(screen.queryByText("bookmarks.html")).not.toBeInTheDocument();
  });
});
