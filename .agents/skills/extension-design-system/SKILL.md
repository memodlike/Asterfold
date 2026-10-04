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
  - Shown as "Smooth glass": light translucency driven by the Glass transparency setting, but no live CSS blur and no SVG refraction (prevents lag on low-end integrated graphics, e.g. AMD Radeon R5 230 / Intel HD Graphics).
  - Slightly more tint than Quality at the same setting, since the wallpaper behind text stays sharp; never more transparent than Quality.
- **Software Mode** (shown as "Lightweight"):
  - Absolute minimal GPU overhead: boards use plain alpha translucency only (no blur, refraction or pointer highlight); overlays stay solid. Glass transparency at 0% makes boards solid.

## Theme Tokens & Semantic Palettes
- Never hardcode raw hex values (`#fff`, `#000`) in component files.
- Always use semantic CSS variables:
  - `--surface-bg`, `--surface-panel`, `--surface-border`
  - `--text-primary`, `--text-secondary`, `--text-muted`
  - `--accent-primary`, `--accent-hover`, `--accent-subtle`
- Ensure WCAG AA compliance (4.5:1 text contrast for body copy, 3:1 for large headings) in all modes.

## GPU Compositing & Pointer Highlight Artifact Prevention (Ironclad Rule)
- **Never use `contain: paint` on elements with rounded corners or moving highlights**:
  `contain: paint` clips child layers to a hard rectangular bounding box (`border-box`) without respecting `border-radius`. When cursor highlights (`.board__glare`) reach the edges/corners, `contain: paint` chops them off into sharp 90-degree square edges and rectangular artifacts. Always use `overflow: hidden; border-radius: inherit;` (with `contain: layout style;` excluding `paint`) so highlights smoothly clip to the actual rounded boundary.
- **Never promote cursor-following glare elements with `will-change: transform` over `backdrop-filter` surfaces**:
  Promoting moving glare/highlight layers to independent hardware layers (`will-change: transform`) over elements using `backdrop-filter: blur(...)` forces Chromium's Skia rasterizer to invalidate and re-composite rectangular backdrop tiles (damage rects) every frame. This creates visible square/tile flashing and horizontal seam lines. Simple 2D pointer highlights must composite in the local layer without `will-change: transform`.
- **Never apply `content-visibility: auto` with synthetic `contain-intrinsic-size` to dynamic CSS Grid workspace boards**:
  Boards in CSS Grid have dynamically stretched row heights. Applying `content-visibility: auto` with fixed `contain-intrinsic-size` creates synthetic height boundary lines and rendering steps across rows of cards. New Tab workspace boards are above-the-fold and must render naturally without artificial containment steps.

## Motion & Keyboard Accessibility
- **Reduced Motion Support**:
  - Respect `@media (prefers-reduced-motion: reduce)`.
  - When active, disable spring physics, scale shifts, and slide animations; switch to instantaneous state changes or subtle opacity fades.
- **Keyboard Navigation & ARIA**:
  - Custom select dropdowns, modals, and context menus must manage focus traps, `aria-activedescendant`, `tabIndex={-1}`, and keyboard arrows/Enter/Escape listeners.
  - Interactive elements must maintain a visible, high-contrast focus outline.

