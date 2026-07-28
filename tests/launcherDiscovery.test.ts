import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLauncher } from "../src/app/AppLauncher";
import type { Page } from "../src/domain/models";
import { I18nProvider } from "../src/i18n";

const page: Page = {
  id: "page", userId: null, title: "Workspace", icon: null, accent: null, position: "hzz", isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", deletedAt: null, deletedBatchId: null, version: 1,
};

function renderLauncher(overrides: Partial<Parameters<typeof AppLauncher>[0]> = {}) {
  const props: Parameters<typeof AppLauncher>[0] = {
    pages: [page], activePageId: page.id, privacy: false,
    onCreateBoard: vi.fn(), onCreatePage: vi.fn(), onSelectPage: vi.fn(), onRenamePage: vi.fn(), onDuplicatePage: vi.fn(),
    onDefaultPage: vi.fn(), onMovePage: vi.fn(), onDeletePage: vi.fn(), onSearch: vi.fn(), onPrivacy: vi.fn(), onTrash: vi.fn(), onSettings: vi.fn(),
    ...overrides,
  };
  render(createElement(I18nProvider, { preference: "en", children: createElement(AppLauncher, props) }));
  return props;
}

afterEach(() => {
  cleanup();
});

describe("first-use launcher discovery", () => {
  it("renders a non-modal localized hint and opens the launcher from its primary action", () => {
    const dismiss = vi.fn();
    renderLauncher({ showFirstRunHint: true, onDismissFirstRunHint: dismiss });
    expect(screen.getByRole("complementary", { name: "Start with the Asterfold menu" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(dismiss).toHaveBeenCalledOnce();
    expect(screen.getByRole("menu", { name: "Open Asterfold menu" })).toBeVisible();
  });

  it("dismisses the hint from keyboard-accessible controls and does not render it for completed onboarding", () => {
    const dismiss = vi.fn();
    renderLauncher({ showFirstRunHint: true, onDismissFirstRunHint: dismiss });
    fireEvent.click(screen.getByRole("button", { name: "Dismiss hint" }));
    expect(dismiss).toHaveBeenCalledOnce();
  });

  it("treats opening the launcher itself as discovery completion", () => {
    const dismiss = vi.fn();
    renderLauncher({ showFirstRunHint: true, onDismissFirstRunHint: dismiss });
    fireEvent.click(screen.getByRole("button", { name: "Open Asterfold menu" }));
    expect(dismiss).toHaveBeenCalledOnce();
  });
});