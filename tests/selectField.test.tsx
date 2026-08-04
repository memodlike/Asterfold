import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SelectField, type SelectOption } from "../src/components/SelectField";

const options: SelectOption[] = [
  { value: "one", label: "Alpha", group: "Primary" },
  { value: "two", label: "Beta", group: "Primary" },
  { value: "disabled", label: "Blocked", group: "Secondary", disabled: true },
  { value: "three", label: "Gamma", group: "Secondary" },
];

function ControlledSelect({ initial = "one", items = options, autoFocus = false }: { initial?: string; items?: SelectOption[]; autoFocus?: boolean }) {
  const [value, setValue] = useState(initial);
  return <SelectField value={value} options={items} onChange={setValue} label="Destination" autoFocus={autoFocus} />;
}

const originalRectDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "getBoundingClientRect");

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => ({
      x: 20,
      y: 20,
      top: 20,
      right: 240,
      bottom: 60,
      left: 20,
      width: 220,
      height: 40,
      toJSON: () => ({}),
    })),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  if (originalRectDescriptor) {
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", originalRectDescriptor);
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).getBoundingClientRect;
  }
  vi.useRealTimers();
});

describe("SelectField", () => {
  it("renders grouped compatibility options and commits a pointer selection", async () => {
    const onChange = vi.fn();
    const { container } = render(<label>Destination<SelectField value="one" options={options} onChange={onChange} label="Destination" /></label>);

    const trigger = screen.getByRole("combobox", { name: "Destination" });
    expect(trigger).toHaveValue("one");
    expect(trigger).toHaveTextContent("Alpha");
    expect(container.querySelectorAll("optgroup")).toHaveLength(2);

    fireEvent.click(trigger);
    const listbox = await screen.findByRole("listbox", { name: "Destination" });
    expect(listbox).toHaveAttribute("data-placement");
    fireEvent.click(screen.getByRole("option", { name: "Gamma" }));

    expect(onChange).toHaveBeenCalledWith("three");
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("supports Arrow, Home, End, Enter and Escape keyboard behavior", async () => {
    const onChange = vi.fn();
    render(<SelectField value="one" options={options} onChange={onChange} label="Destination" />);
    const trigger = screen.getByRole("combobox", { name: "Destination" });

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await screen.findByRole("listbox");
    fireEvent.keyDown(trigger, { key: "End" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("three");

    fireEvent.keyDown(trigger, { key: "ArrowUp" });
    await screen.findByRole("listbox");
    fireEvent.keyDown(trigger, { key: "Home" });
    fireEvent.keyDown(trigger, { key: " " });
    expect(onChange).toHaveBeenLastCalledWith("one");

    fireEvent.click(trigger);
    await screen.findByRole("listbox");
    fireEvent.keyDown(trigger, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(trigger).toHaveFocus();
  });

  it("skips disabled options while navigating and supports typeahead", async () => {
    const onChange = vi.fn();
    render(<SelectField value="two" options={options} onChange={onChange} label="Destination" />);
    const trigger = screen.getByRole("combobox", { name: "Destination" });

    fireEvent.keyDown(trigger, { key: "g" });
    expect(onChange).toHaveBeenCalledWith("three");

    fireEvent.click(trigger);
    await screen.findByRole("listbox");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenLastCalledWith("three");

    fireEvent.click(trigger);
    await screen.findByRole("listbox");
    fireEvent.keyDown(trigger, { key: "Tab" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("closes on an outside pointer and repositions on resize and scroll", async () => {
    render(<div><ControlledSelect /><button type="button">Outside</button></div>);
    const trigger = screen.getByRole("combobox", { name: "Destination" });
    fireEvent.click(trigger);
    await screen.findByRole("listbox");

    fireEvent(window, new Event("resize"));
    fireEvent.scroll(window);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("places the menu above when the lower viewport has insufficient space", async () => {
    Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
      configurable: true,
      value: vi.fn(() => ({
        x: 20,
        y: 700,
        top: 700,
        right: 240,
        bottom: 740,
        left: 20,
        width: 220,
        height: 40,
        toJSON: () => ({}),
      })),
    });
    Object.defineProperty(document.documentElement, "clientHeight", { configurable: true, value: 768 });

    render(<ControlledSelect />);
    fireEvent.click(screen.getByRole("combobox", { name: "Destination" }));
    expect(await screen.findByRole("listbox")).toHaveAttribute("data-placement", "top");
  });

  it("handles unknown, empty and entirely disabled option sets", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SelectField value="missing" options={options} onChange={onChange} label="Destination" />);
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveTextContent("—");

    rerender(<SelectField value="" options={[]} onChange={onChange} label="Destination" />);
    expect(screen.getByRole("combobox", { name: "Destination" })).toBeDisabled();

    rerender(<SelectField value="blocked" options={[{ value: "blocked", label: "Blocked", disabled: true }]} onChange={onChange} label="Destination" />);
    expect(screen.getByRole("combobox", { name: "Destination" })).toBeDisabled();
  });

  it("keeps options out of the Tab sequence and closes without trapping focus", async () => {
    render(<div><ControlledSelect /><button type="button">Next control</button></div>);
    const trigger = screen.getByRole("combobox", { name: "Destination" });

    fireEvent.click(trigger);
    const renderedOptions = await screen.findAllByRole("option");
    renderedOptions.forEach((option) => expect(option).toHaveAttribute("tabindex", "-1"));

    fireEvent.keyDown(trigger, { key: "Tab" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("cycles repeated typeahead characters and supports Unicode labels", async () => {
    const onChange = vi.fn();
    const typeaheadOptions: SelectOption[] = [
      { value: "alpha", label: "Alpha" },
      { value: "gamma", label: "Gamma" },
      { value: "garden", label: "Garden" },
      { value: "kazakh", label: "Қазақша" },
    ];
    render(<SelectField value="alpha" options={typeaheadOptions} onChange={onChange} label="Destination" />);
    const trigger = screen.getByRole("combobox", { name: "Destination" });

    fireEvent.click(trigger);
    await screen.findByRole("listbox");
    fireEvent.keyDown(trigger, { key: "g" });
    expect(trigger.getAttribute("aria-activedescendant")).toMatch(/option-1$/);
    fireEvent.keyDown(trigger, { key: "g" });
    expect(trigger.getAttribute("aria-activedescendant")).toMatch(/option-2$/);
    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith("garden");

    fireEvent.keyDown(trigger, { key: "Қ" });
    expect(onChange).toHaveBeenLastCalledWith("kazakh");
  });

  it("reconciles an externally changed value and closes when options become unavailable", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<SelectField value="one" options={options} onChange={onChange} label="Destination" />);
    const trigger = screen.getByRole("combobox", { name: "Destination" });

    fireEvent.click(trigger);
    await screen.findByRole("listbox");
    rerender(<SelectField value="three" options={options} onChange={onChange} label="Destination" />);
    await waitFor(() => expect(trigger.getAttribute("aria-activedescendant")).toMatch(/option-3$/));

    rerender(<SelectField value="" options={[]} onChange={onChange} label="Destination" />);
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    expect(trigger).toBeDisabled();
  });

  it("cancels scheduled scrolling and focus restoration during teardown", async () => {
    const requestAnimationFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 73);
    const cancelAnimationFrame = vi.spyOn(window, "cancelAnimationFrame");
    const setTimeoutSpy = vi.spyOn(window, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { unmount } = render(<ControlledSelect />);
    const trigger = screen.getByRole("combobox", { name: "Destination" });

    fireEvent.click(trigger);
    await screen.findByRole("listbox");
    expect(requestAnimationFrame).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("option", { name: "Gamma" }));
    unmount();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(73);
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("focuses the trigger on request and routes the compatibility bridge change", () => {
    const onChange = vi.fn();
    const { container } = render(<SelectField value="one" options={options} onChange={onChange} label="Destination" autoFocus />);
    expect(screen.getByRole("combobox", { name: "Destination" })).toHaveFocus();

    const bridge = container.parentElement?.querySelector<HTMLSelectElement>("select[data-select-bridge='true']");
    expect(bridge).not.toBeNull();
    fireEvent.change(bridge!, { target: { value: "two" } });
    expect(onChange).toHaveBeenCalledWith("two");
  });
});
