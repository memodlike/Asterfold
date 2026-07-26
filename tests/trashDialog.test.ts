import { createElement } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  emptyTrash: vi.fn(),
  permanentlyDelete: vi.fn(),
  restoreBoard: vi.fn(),
  restoreBookmark: vi.fn(),
  restorePage: vi.fn(),
  useLiveQuery: vi.fn(),
}));

vi.mock("dexie-react-hooks", () => ({
  useLiveQuery: mocks.useLiveQuery,
}));

vi.mock("../src/db/database", () => ({
  db: {},
}));

vi.mock("../src/db/repository", () => ({
  emptyTrash: mocks.emptyTrash,
  listTrash: vi.fn(),
  permanentlyDelete: mocks.permanentlyDelete,
  restoreBoard: mocks.restoreBoard,
  restoreBookmark: mocks.restoreBookmark,
  restorePage: mocks.restorePage,
}));

import { TrashDialog } from "../src/features/trash/TrashDialog";
import { I18nProvider } from "../src/i18n";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TrashDialog destructive actions", () => {
  it("prevents duplicate restore submissions while the first request is pending", async () => {
    let finishRestore: (() => void) | undefined;
    mocks.restoreBookmark.mockImplementation(() => new Promise<void>((resolve) => {
      finishRestore = resolve;
    }));
    mocks.useLiveQuery.mockReturnValue({
      pages: [],
      boards: [],
      bookmarks: [{
        id: "bookmark-1",
        title: "Example",
        deletedAt: "2026-07-26T00:00:00.000Z",
      }],
    });

    render(createElement(I18nProvider, {
      preference: "en",
      children: createElement(TrashDialog, {
        open: true,
        onClose: vi.fn(),
        onChanged: vi.fn(),
        onError: vi.fn(),
      }),
    }));

    const restoreButton = screen.getByRole("button", { name: "Restore" });
    fireEvent.click(restoreButton);
    fireEvent.click(restoreButton);

    expect(mocks.restoreBookmark).toHaveBeenCalledTimes(1);
    expect(restoreButton).toBeDisabled();

    finishRestore?.();
    await waitFor(() => expect(restoreButton).not.toBeDisabled());
  });
});
