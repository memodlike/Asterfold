# Asterfold 3.1.1

## Windows 11 performance update

- Adds Adaptive Compatibility Glass for legacy and software-rendered GPUs.
- Automatically recognizes AMD Radeon R5 230 / Caicos-class renderers and selects the compatibility path.
- Keeps transparency, gradients, glass highlights, hover motion, menu motion and drag-and-drop while removing live `backdrop-filter` from the compatibility renderer.
- Adds pre-rendered local variants for built-in wallpapers and uses the bounded thumbnail as the compatibility variant for uploaded wallpapers.
- Caps uploaded wallpaper output to a 1920-pixel long edge, reducing decoded texture memory from roughly 31.6 MiB at 4K to roughly 7.9 MiB at Full HD before compositor copies.
- Removes layout-sized `width`/`margin` transitions and paint-heavy animated board shadows.
- Replaces per-bookmark privacy blur with a lightweight visual placeholder.
- Avoids rewriting unchanged CSS custom properties.
- Measures dnd-kit droppable layouts before dragging and disables desktop auto-scroll.

## Stress and release gates

- Adds a 600-bookmark real-extension stress scenario at 1280×720.
- Verifies the compatibility renderer has no live wallpaper filter or menu backdrop blur.
- Samples animation frames and rejects extreme frame stalls in CI.
- Runs stress checks in normal CI and again from the exact release tag.
- Preserves deterministic Linux/Windows release subjects, checksums, provenance, SBOM and GitHub attestations.

## Data compatibility

- Database schema 7 adds the `performanceMode` preference.
- Existing Low Power users migrate to Compatibility Glass.
- Existing Pages, Boards, bookmarks, Trash, Quick Save, privacy, wallpaper and animation preferences are preserved.
- Backup formats remain backward compatible; missing `performanceMode` values normalize to `auto`.

## Target hardware

The primary compatibility target is Windows 11 with Ryzen 5 5600, 32 GB RAM and AMD Radeon R5 230. CI cannot reproduce that exact physical GPU, so the release includes deterministic renderer classification and automated compatibility-path stress gates; final physical-GPU FPS remains a device-side verification item.

## Chrome Web Store package

Upload **`Asterfold-Chrome.zip`**. `chrome-unpacked.zip` is for Developer mode. GitHub-generated source archives are not extension packages.
