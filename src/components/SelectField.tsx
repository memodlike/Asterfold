import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
  icon?: ReactNode;
}

interface SelectFieldProps {
  value: string;
  options: ReadonlyArray<SelectOption>;
  onChange: (value: string) => void;
  label: string;
  className?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}

interface PopoverPosition {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
  placement: "top" | "bottom";
}

const VIEWPORT_MARGIN = 8;
const POPOVER_GAP = 6;
const MAX_POPOVER_HEIGHT = 300;

function nextEnabledIndex(options: ReadonlyArray<SelectOption>, start: number, direction: 1 | -1): number {
  if (options.length === 0) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (start + direction * offset + options.length) % options.length;
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

function firstEnabledIndex(options: ReadonlyArray<SelectOption>): number {
  return options.findIndex((option) => !option.disabled);
}

function lastEnabledIndex(options: ReadonlyArray<SelectOption>): number {
  for (let index = options.length - 1; index >= 0; index -= 1) {
    if (!options[index]?.disabled) return index;
  }
  return -1;
}

function findTypeaheadMatch(options: ReadonlyArray<SelectOption>, query: string, start: number): number {
  if (!query || options.length === 0) return -1;
  for (let offset = 1; offset <= options.length; offset += 1) {
    const index = (start + offset + options.length) % options.length;
    const option = options[index];
    if (option && !option.disabled && option.label.toLocaleLowerCase().startsWith(query)) return index;
  }
  return -1;
}

function nativeOptionNodes(options: ReadonlyArray<SelectOption>): ReactNode[] {
  const nodes: ReactNode[] = [];
  let index = 0;
  while (index < options.length) {
    const option = options[index]!;
    if (!option.group) {
      nodes.push(<option key={`option:${option.value}`} value={option.value} disabled={option.disabled}>{option.label}</option>);
      index += 1;
      continue;
    }
    const group = option.group;
    const groupOptions: ReactNode[] = [];
    const groupStart = index;
    while (index < options.length && options[index]?.group === group) {
      const groupedOption = options[index]!;
      groupOptions.push(<option key={`option:${groupedOption.value}`} value={groupedOption.value} disabled={groupedOption.disabled}>{groupedOption.label}</option>);
      index += 1;
    }
    nodes.push(<optgroup key={`group:${group}:${groupStart}`} label={group}>{groupOptions}</optgroup>);
  }
  return nodes;
}

export function SelectField({ value, options, onChange, label, className = "", disabled = false, autoFocus = false, compact = false }: SelectFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const typeaheadRef = useRef("");
  const typeaheadTimerRef = useRef<number | null>(null);
  const focusTimerRef = useRef<number | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const triggerId = useId();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const selectedIndex = useMemo(() => options.findIndex((option) => option.value === value), [options, value]);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const [activeIndex, setActiveIndex] = useState(() => selectedIndex >= 0 ? selectedIndex : firstEnabledIndex(options));
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const [bridgeHost, setBridgeHost] = useState<HTMLElement | null>(null);
  const unavailable = disabled || options.length === 0 || options.every((option) => option.disabled);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = document.documentElement.clientHeight;
    const width = Math.min(Math.max(rect.width, compact ? 132 : 180), viewportWidth - VIEWPORT_MARGIN * 2);
    const left = Math.min(Math.max(VIEWPORT_MARGIN, rect.left), Math.max(VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN));
    const availableBelow = viewportHeight - rect.bottom - VIEWPORT_MARGIN - POPOVER_GAP;
    const availableAbove = rect.top - VIEWPORT_MARGIN - POPOVER_GAP;
    const placement = availableBelow < 176 && availableAbove > availableBelow ? "top" : "bottom";
    const available = placement === "top" ? availableAbove : availableBelow;
    const maxHeight = Math.max(0, Math.min(MAX_POPOVER_HEIGHT, available));
    setPosition({
      left,
      width,
      maxHeight,
      placement,
      ...(placement === "top"
        ? { bottom: viewportHeight - rect.top + POPOVER_GAP }
        : { top: rect.bottom + POPOVER_GAP }),
    });
  }, [compact]);

  const close = useCallback((restoreFocus = false) => {
    typeaheadRef.current = "";
    if (typeaheadTimerRef.current !== null) {
      window.clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = null;
    }
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
      scrollFrameRef.current = null;
    }
    setOpen(false);
    setPosition(null);
    if (restoreFocus) {
      focusTimerRef.current = window.setTimeout(() => {
        focusTimerRef.current = null;
        triggerRef.current?.focus();
      }, 0);
    }
  }, []);

  const openMenu = useCallback((preferredIndex?: number) => {
    if (unavailable) return;
    if (focusTimerRef.current !== null) {
      window.clearTimeout(focusTimerRef.current);
      focusTimerRef.current = null;
    }
    const fallback = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabledIndex(options);
    setActiveIndex(preferredIndex ?? fallback);
    setOpen(true);
  }, [options, selectedIndex, unavailable]);

  const commit = useCallback((index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    onChange(option.value);
    close(true);
  }, [close, onChange, options]);

  useEffect(() => {
    if (autoFocus) triggerRef.current?.focus();
  }, [autoFocus]);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const wrappingLabel = trigger.closest("label");
    setBridgeHost(wrappingLabel?.parentElement ?? trigger.parentElement);
    if (!wrappingLabel) return;
    const previousFor = wrappingLabel.getAttribute("for");
    if (!previousFor) wrappingLabel.htmlFor = triggerId;
    return () => {
      if (!previousFor && wrappingLabel.htmlFor === triggerId) wrappingLabel.removeAttribute("for");
    };
  }, [triggerId]);

  useEffect(() => {
    const fallback = selectedIndex >= 0 && !options[selectedIndex]?.disabled ? selectedIndex : firstEnabledIndex(options);
    setActiveIndex(unavailable ? -1 : fallback);
  }, [options, selectedIndex, unavailable]);

  useEffect(() => {
    if (open && unavailable) close(false);
  }, [close, open, unavailable]);

  useEffect(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const handleNativeChange = (event: Event): void => {
      const nextValue = (event.currentTarget as HTMLButtonElement).value;
      const index = options.findIndex((option) => option.value === nextValue);
      if (index >= 0) commit(index);
    };
    trigger.addEventListener("change", handleNativeChange);
    return () => trigger.removeEventListener("change", handleNativeChange);
  }, [commit, options]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const reposition = (): void => updatePosition();
    window.addEventListener("resize", reposition, { passive: true });
    window.addEventListener("scroll", reposition, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, updatePosition]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
    const frame = window.requestAnimationFrame(() => {
      if (scrollFrameRef.current === frame) scrollFrameRef.current = null;
      const option = popoverRef.current?.querySelector<HTMLElement>(`[data-option-index="${activeIndex}"]`);
      option?.scrollIntoView?.({ block: "nearest" });
    });
    scrollFrameRef.current = frame;
    return () => {
      if (scrollFrameRef.current === frame) {
        window.cancelAnimationFrame(frame);
        scrollFrameRef.current = null;
      }
    };
  }, [activeIndex, open, updatePosition]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current);
    if (focusTimerRef.current !== null) window.clearTimeout(focusTimerRef.current);
    if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current);
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (unavailable) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      if (!open) {
        const edge = direction === 1 ? firstEnabledIndex(options) : lastEnabledIndex(options);
        openMenu(selectedIndex >= 0 ? selectedIndex : edge);
      } else {
        setActiveIndex((current) => nextEnabledIndex(options, current < 0 ? (direction === 1 ? -1 : 0) : current, direction));
      }
      return;
    }
    if (event.key === "Home" && open) { event.preventDefault(); setActiveIndex(firstEnabledIndex(options)); return; }
    if (event.key === "End" && open) { event.preventDefault(); setActiveIndex(lastEnabledIndex(options)); return; }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (open) commit(activeIndex);
      else openMenu();
      return;
    }
    if (event.key === "Escape" && open) { event.preventDefault(); close(true); return; }
    if (event.key === "Tab") { close(false); return; }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.length === 1) {
      const key = event.key.toLocaleLowerCase();
      const previous = typeaheadRef.current;
      const repeatedCharacter = previous.length > 0 && Array.from(previous).every((character) => character === key);
      const query = repeatedCharacter ? key : `${previous}${key}`;
      typeaheadRef.current = query;
      if (typeaheadTimerRef.current !== null) window.clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = window.setTimeout(() => { typeaheadRef.current = ""; typeaheadTimerRef.current = null; }, 500);
      const match = findTypeaheadMatch(options, query, open ? activeIndex : selectedIndex);
      if (match >= 0) {
        event.preventDefault();
        if (open) setActiveIndex(match);
        else commit(match);
      }
    }
  };

  const activeOptionId = open && activeIndex >= 0 && activeIndex < options.length && !options[activeIndex]?.disabled
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  const popoverStyle: CSSProperties | undefined = position ? {
    left: position.left,
    width: position.width,
    maxHeight: position.maxHeight,
    ...(position.top === undefined ? {} : { top: position.top }),
    ...(position.bottom === undefined ? {} : { bottom: position.bottom }),
  } : undefined;

  const bridge = bridgeHost ? createPortal(
    <select
      hidden
      aria-hidden="true"
      tabIndex={-1}
      value={value}
      disabled={unavailable}
      data-select-bridge="true"
      onChange={(event) => {
        const index = options.findIndex((option) => option.value === event.currentTarget.value);
        if (index >= 0) commit(index);
      }}
    >
      {selectedIndex < 0 ? <option value="">—</option> : null}
      {nativeOptionNodes(options)}
    </select>,
    bridgeHost,
  ) : null;

  const popover = open && position ? createPortal(
    <div
      ref={popoverRef}
      id={listboxId}
      role="listbox"
      aria-label={label}
      className="select-popover"
      data-placement={position.placement}
      style={popoverStyle}
    >
      {options.map((option, index) => {
        const showGroup = Boolean(option.group && option.group !== options[index - 1]?.group);
        return <div className="select-popover__entry" key={`${option.group ?? ""}:${option.value}`}>
          {showGroup ? <div className="select-popover__group" role="presentation">{option.group}</div> : null}
          <button
            id={`${listboxId}-option-${index}`}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={option.value === value}
            aria-disabled={option.disabled || undefined}
            disabled={option.disabled}
            className={`${option.value === value ? "is-selected" : ""} ${index === activeIndex ? "is-active" : ""}`}
            data-option-index={index}
            onMouseEnter={() => { if (!option.disabled) setActiveIndex(index); }}
            onClick={() => commit(index)}
          >
            {option.icon ? <span className="select-field__icon" aria-hidden="true">{option.icon}</span> : null}
            <span className="select-popover__label">{option.label}</span>
            {option.value === value ? <Check size={15} aria-hidden="true" /> : <span className="select-popover__check-placeholder" />}
          </button>
        </div>;
      })}
    </div>,
    document.body,
  ) : null;

  return <div className={`select-field ${compact ? "select-field--compact" : ""} ${className}`.trim()} data-state={open ? "open" : "closed"}>
    <button
      ref={triggerRef}
      id={triggerId}
      type="button"
      role="combobox"
      value={value}
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={open ? listboxId : undefined}
      aria-activedescendant={activeOptionId}
      disabled={unavailable}
      onClick={() => open ? close(false) : openMenu()}
      onKeyDown={handleKeyDown}
    >
      <span className="select-field__value">
        {selectedOption?.icon ? <span className="select-field__icon" aria-hidden="true">{selectedOption.icon}</span> : null}
        <span>{selectedOption?.label ?? "—"}</span>
      </span>
      <ChevronDown className="select-field__chevron" size={16} aria-hidden="true" />
    </button>
    {bridge}
    {popover}
  </div>;
}
