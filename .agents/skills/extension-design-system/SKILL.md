---
name: extension-design-system
description: Design system engineering, visual ergonomics, zero-flash startup snapshots, glassmorphism, responsive Boards, and accessibility (WCAG AA) for Chrome New Tab extensions. Use when styling components, managing theme tokens, building dialogs, optimizing DnD, or resolving UI rendering regressions.
license: MIT
metadata:
  target-platforms: "Google Chrome 120+, Modern Web Standards"
  design-tokens: "CSS Variables, Semantic Theme Tokens"
---

# Extension Design System & New Tab Ergonomics

## Zero-Flash New Tab Startup Architecture
- **Problem**: React hydration and IndexedDB queries take 50–200ms. Without pre-paint synchronization, opening a New Tab causes a jarring white flash in dark mode.
- **Solution**:
  1. Synchronous startup snapshot script (`bootstrap.ts` + `bootstrap.css`) executed directly in the HTML `<head>` before any React or bundle code loads.
  2. Cache active theme token (`dark`, `light`, `system`) and safe wallpaper URL in `localStorage`.
  3. Apply `data-theme` and background styles to `<html>` and `<body>` synchronously.
  4. Display smooth compositor-only entrance transition (`opacity` / `transform`) once React state is warm.

## Tiered GPU & Low-Spec Rendering Profiles
- **Quality Mode**:
  - Full backdrop blur (`backdrop-filter: blur(20px)`), dynamic glass reflections, high-resolution textures.
- **Compatibility Mode**:
  - Solid, opaque, theme-aware surfaces without live CSS blur filters (prevents lag on low-end integrated graphics, e.g. AMD Radeon R5 230 / Intel HD Graphics).
  - High contrast card boundaries, responsive hit areas, and zero wallpaper bleed-through.
- **Software Mode**:
  - Absolute minimal GPU overhead, flat colors, zero transparency.

## Theme Tokens & Semantic Palettes
- Never hardcode raw hex values (`#fff`, `#000`) in component files.
- Always use semantic CSS variables:
  - `--surface-bg`, `--surface-panel`, `--surface-border`
  - `--text-primary`, `--text-secondary`, `--text-muted`
  - `--accent-primary`, `--accent-hover`, `--accent-subtle`
- Ensure WCAG AA compliance (4.5:1 text contrast for body copy, 3:1 for large headings) in all modes.

## Motion & Keyboard Accessibility
- **Reduced Motion Support**:
  - Respect `@media (prefers-reduced-motion: reduce)`.
  - When active, disable spring physics, scale shifts, and slide animations; switch to instantaneous state changes or subtle opacity fades.
- **Keyboard Navigation & ARIA**:
  - Custom select dropdowns, modals, and context menus must manage focus traps, `aria-activedescendant`, `tabIndex={-1}`, and keyboard arrows/Enter/Escape listeners.
  - Interactive elements must maintain a visible, high-contrast focus outline.
