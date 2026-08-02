# Asterfold 3.1.0 Windows 11 performance plan

## Primary target

- Windows 11 Pro
- AMD Ryzen 5 5600
- 32 GB RAM
- AMD Radeon R5 230 / Caicos legacy GPU
- Chrome 150 or later

## Implemented renderer

`auto` classifies known software renderers as `software`, Radeon R5 230/Caicos and comparable legacy renderers as `compatibility`, and modern renderers as `quality`. Users can explicitly select Quality or Smooth Glass.

Compatibility mode retains translucent surfaces, highlights, gradients and transform/opacity motion. It uses pre-rendered wallpaper variants and disables live backdrop filtering. Uploaded wallpaper decode output is bounded to a 1920-pixel long edge.

## Automated gates

- Pure classifier tests for R5 230, Caicos, SwiftShader and Microsoft Basic Renderer.
- Static CSS gate against animated width, margin and box-shadow.
- Static gate requiring no privacy text blur.
- Real MV3 fixture with 12 boards and 600 bookmarks at 1280×720.
- Twenty launcher open/close cycles with computed-style verification.
- 90-frame sample with p95 below 100 ms and no individual frame above 300 ms on CI.

## Physical-device gate

CI does not emulate the exact R5 230 driver and Windows DWM path. On the corporate PC, confirm `chrome://gpu`, then capture a Performance trace while opening the launcher, Settings, Search and dragging a bookmark during Teams screen sharing. Target p95 frame time is 20 ms; release automation does not claim this physical result until measured.
