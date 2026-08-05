import { createElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { WorkspaceData } from "../src/domain/models";
import { I18nProvider } from "../src/i18n";

const mocks = vi.hoisted(() => ({
  commit: vi.fn(),
  readChrome: vi.fn(),
  parseHtml: vi.fn(),
  parseBackup: vi.fn(),
  publishThemePreview: vi.fn(),
}));

vi.mock("../src/features/onboarding/onboardingCommit", () => ({
  commitOnboardingPlan: mocks.commit,
}));
vi.mock("../src/features/onboarding/chromeBookmarkImport", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/features/onboarding/chromeBookmarkImport")>();
  return { ...original, readChromeBookmarks: mocks.readChrome };
});
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

function clickContinue(): void {
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
}

beforeEach(() => {
  mocks.commit.mockReset();
  mocks.readChrome.mockReset();
  mocks.parseHtml.mockReset();
  mocks.parseBackup.mockReset();
  mocks.publishThemePreview.mockReset();
  mocks.commit.mockResolvedValue({ status: "completed", imported: 0, skippedDuplicates: 0 });
  mocks.readChrome.mockResolvedValue({ status: "granted", records: [], permissionRemoved: true });
});

describe("guided onboarding wizard", () => {
  it("completes the four-step default flow with an appearance preview and one controlled commit", async () => {
    const { onCompleted } = renderWizard();
    expect(screen.getByRole("heading", { name: "Welcome to Asterfold" })).toBeVisible();
    expect(screen.getByText(/No account and no analytics/u)).toBeVisible();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");

    clickContinue();
    expect(screen.getByRole("heading", { name: "Bring bookmarks or start fresh" })).toBeVisible();
    expect(screen.getByRole("radio", { name: /Start with Asterfold/u })).toHaveAttribute("aria-checked", "true");

    clickContinue();
    expect(screen.getByRole("heading", { name: "Choose your starting appearance" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    fireEvent.click(screen.getByRole("button", { name: "Compact" }));
    fireEvent.click(screen.getByRole("button", { name: "One row" }));
    fireEvent.click(screen.getByRole("radio", { name: "Graphite Dark" }));
    expect(mocks.publishThemePreview).toHaveBeenCalled();

    clickContinue();
    expect(screen.getByRole("heading", { name: "Review setup" })).toBeVisible();
    expect(screen.getByText("Graphite Dark")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Finish setup/u }));

    await waitFor(() => expect(mocks.commit).toHaveBeenCalledTimes(1));
    const committed = mocks.commit.mock.calls[0]?.[0];
    expect(committed).toMatchObject({
      locale: "auto",
      source: "default",
      workspaceRows: 1,
      theme: { preset: "graphite-dark", mode: "dark", density: "compact" },
    });
    expect(onCompleted).toHaveBeenCalledTimes(1);
  });

  it("treats the visible Skip action as an explicit defaults commit", async () => {
    const { data, onCompleted } = renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Skip setup" }));
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

  it("requires confirmation for the close button and returns to the active setup", () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("heading", { name: "Skip guided setup?" })).toBeVisible();
    expect(mocks.commit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Continue setup" }));
    expect(screen.getByRole("heading", { name: "Welcome to Asterfold" })).toBeVisible();
  });

  it("shows recoverable Chrome permission denial and permits switching source", async () => {
    mocks.readChrome.mockResolvedValue({ status: "denied", records: [], permissionRemoved: false });
    renderWizard();
    clickContinue();
    fireEvent.click(screen.getByRole("radio", { name: /Import from Chrome/u }));
    fireEvent.click(document.querySelector<HTMLButtonElement>(".onboarding-source-action button")!);
    await screen.findByText(/Bookmark access was not granted/u);
    expect(screen.getByRole("button", { name: "Retry" })).toBeVisible();
    fireEvent.click(screen.getByRole("radio", { name: /Import bookmark HTML/u }));
    expect(screen.getByRole("button", { name: "Import bookmark HTML" })).toBeVisible();
  });

  it("parses an HTML file off-thread, renders preview counts and clears stale state on source change", async () => {
    mocks.parseHtml.mockResolvedValue([
      { title: "A", url: "https://a.example", description: null, folderPath: ["Work"] },
      { title: "B", url: "https://b.example", description: null, folderPath: ["Work"] },
    ]);
    const { container } = renderWizard();
    clickContinue();
    fireEvent.click(screen.getByRole("radio", { name: /Import bookmark HTML/u }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*="text/html"]')!;
    const file = new File(["<DL><p></DL>"], "bookmarks.html", { type: "text/html" });
    fireEvent.change(input, { target: { files: [file] } });

    await screen.findByText("bookmarks.html");
    expect(screen.getByText(/2 bookmarks · 1 folders/u)).toBeVisible();
    expect(mocks.parseHtml).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("radio", { name: /Start with Asterfold/u }));
    expect(screen.queryByText("bookmarks.html")).not.toBeInTheDocument();
  });
});
