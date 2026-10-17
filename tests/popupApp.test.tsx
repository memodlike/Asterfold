import { createElement } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultSettings } from "../src/db/defaults";
import type { WorkspaceData } from "../src/domain/models";

const mocks = vi.hoisted(() => ({
  openWorkspace: vi.fn(),
  useWorkspace: vi.fn(),
}));

vi.mock("../src/browser/api", () => ({
  openWorkspace: mocks.openWorkspace,
}));

vi.mock("../src/app/useWorkspace", () => ({
  useWorkspace: mocks.useWorkspace,
}));

import { PopupApp } from "../entrypoints/popup/PopupApp";

function mockWorkspaceData(): WorkspaceData {
  return {
    pages: [],
    boards: [],
    bookmarks: [],
    settings: createDefaultSettings(),
  };
}

describe("PopupApp keyboard interaction and zero-permission import (A7, K2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useWorkspace.mockReturnValue({
      workspace: mockWorkspaceData(),
      failed: false,
      retry: vi.fn(),
    });
  });

  it("does not offer native Chrome import button (K2)", () => {
    render(createElement(PopupApp));
    expect(screen.queryByRole("button", { name: /Import from Chrome/i })).toBeNull();
    expect(screen.getByRole("button", { name: /Open workspace/i })).toBeVisible();
  });

  it("triggers openWorkspace when Enter is pressed on non-interactive popup elements", () => {
    const { container } = render(createElement(PopupApp));
    const main = container.querySelector("main")!;

    fireEvent.keyDown(main, { key: "Enter" });
    expect(mocks.openWorkspace).toHaveBeenCalledTimes(1);
  });

  it("does not suppress or intercept Enter when a button is focused (A7 regression)", () => {
    render(createElement(PopupApp));
    const settingsButton = screen.getByRole("button", { name: "Settings" });
    settingsButton.focus();

    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    const defaultPrevented = !settingsButton.dispatchEvent(enterEvent);

    expect(defaultPrevented).toBe(false);
    expect(mocks.openWorkspace).not.toHaveBeenCalled();
  });
});
