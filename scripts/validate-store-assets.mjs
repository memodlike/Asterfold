import { inflateSync } from "node:zlib";
import { readFile, readdir, stat } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

const root = resolve("store-assets");
const required = new Map([
  ["README.md", null],
  ["icon/icon-128.png", { width: 128, height: 128, opaque: false }],
  ["promo/small-promo-440x280.png", { width: 440, height: 280, opaque: true }],
  ["promo/small-promo-source.svg", { width: 440, height: 280 }],
  ["promo/marquee-1400x560.png", { width: 1400, height: 560, opaque: true }],
  ["promo/marquee-source.svg", { width: 1400, height: 560 }],
]);
const allowedExtensions = new Set([".md", ".png", ".svg"]);
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const failures = [];

function fail(message) {
  failures.push(message);
}

function relativeAssetPath(path) {
  return relative(root, path).replaceAll("\\", "/");
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

function pngChunks(buffer) {
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > buffer.length) throw new Error("truncated PNG chunk");
    chunks.push({ type, data: buffer.subarray(start, end) });
    offset = end + 4;
    if (type === "IEND") break;
  }
  return chunks;
}

function unfilterScanlines(raw, width, height, bytesPerPixel) {
  const stride = width * bytesPerPixel;
  const output = Buffer.alloc(stride * height);
  let sourceOffset = 0;
  for (let row = 0; row < height; row += 1) {
    const filter = raw[sourceOffset];
    sourceOffset += 1;
    const rowOffset = row * stride;
    for (let column = 0; column < stride; column += 1) {
      const value = raw[sourceOffset + column];
      const left = column >= bytesPerPixel ? output[rowOffset + column - bytesPerPixel] : 0;
      const up = row > 0 ? output[rowOffset - stride + column] : 0;
      const upLeft = row > 0 && column >= bytesPerPixel ? output[rowOffset - stride + column - bytesPerPixel] : 0;
      let reconstructed;
      if (filter === 0) reconstructed = value;
      else if (filter === 1) reconstructed = value + left;
      else if (filter === 2) reconstructed = value + up;
      else if (filter === 3) reconstructed = value + Math.floor((left + up) / 2);
      else if (filter === 4) {
        const predictor = left + up - upLeft;
        const leftDistance = Math.abs(predictor - left);
        const upDistance = Math.abs(predictor - up);
        const upperLeftDistance = Math.abs(predictor - upLeft);
        reconstructed = value + (leftDistance <= upDistance && leftDistance <= upperLeftDistance ? left : upDistance <= upperLeftDistance ? up : upLeft);
      } else {
        throw new Error(`unsupported PNG filter ${filter}`);
      }
      output[rowOffset + column] = reconstructed & 255;
    }
    sourceOffset += stride;
  }
  return output;
}

function inspectPng(buffer, requireOpaque) {
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(pngSignature)) throw new Error("invalid PNG signature");
  const chunks = pngChunks(buffer);
  const header = chunks.find((chunk) => chunk.type === "IHDR")?.data;
  if (!header || header.length !== 13) throw new Error("missing PNG IHDR");
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const bitDepth = header[8];
  const colorType = header[9];
  const interlace = header[12];
  if (requireOpaque) {
    if (bitDepth !== 8 || interlace !== 0) throw new Error("opaque validation supports non-interlaced 8-bit PNG only");
    if (chunks.some((chunk) => chunk.type === "tRNS")) throw new Error("promo PNG contains a transparency chunk");
    const channels = colorType === 6 ? 4 : colorType === 4 ? 2 : colorType === 2 ? 3 : colorType === 0 ? 1 : null;
    if (!channels) throw new Error(`unsupported promo PNG color type ${colorType}`);
    if (colorType === 6 || colorType === 4) {
      const compressed = Buffer.concat(chunks.filter((chunk) => chunk.type === "IDAT").map((chunk) => chunk.data));
      const pixels = unfilterScanlines(inflateSync(compressed), width, height, channels);
      const alphaOffset = channels - 1;
      for (let offset = alphaOffset; offset < pixels.length; offset += channels) {
        if (pixels[offset] !== 255) throw new Error("promo PNG contains transparent or translucent pixels");
      }
    }
  }
  return { width, height };
}

function inspectSvg(source) {
  const opening = source.match(/<svg\b[^>]*>/u)?.[0];
  if (!opening) throw new Error("missing SVG root element");
  const width = Number(opening.match(/\bwidth=["'](\d+(?:\.\d+)?)["']/u)?.[1]);
  const height = Number(opening.match(/\bheight=["'](\d+(?:\.\d+)?)["']/u)?.[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error("SVG width and height must be explicit");
  return { width, height };
}

for (const [name, expected] of required) {
  const path = join(root, name);
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size === 0) fail(`${name}: missing or empty`);
    if (expected) {
      const buffer = await readFile(path);
      const dimensions = extname(path) === ".png"
        ? inspectPng(buffer, expected.opaque === true)
        : inspectSvg(buffer.toString("utf8"));
      if (dimensions.width !== expected.width || dimensions.height !== expected.height) {
        fail(`${name}: expected ${expected.width}x${expected.height}, got ${dimensions.width}x${dimensions.height}`);
      }
    }
  } catch (error) {
    fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

let files = [];
try {
  files = await filesUnder(root);
} catch (error) {
  fail(`store-assets: ${error instanceof Error ? error.message : String(error)}`);
}

for (const file of files) {
  const name = relativeAssetPath(file);
  const extension = extname(file).toLowerCase();
  if (!allowedExtensions.has(extension)) fail(`${name}: unsupported file extension`);
  const info = await stat(file);
  if (info.size === 0) fail(`${name}: file is empty`);
  if (extension === ".png") {
    try {
      inspectPng(await readFile(file), name.startsWith("promo/"));
    } catch (error) {
      fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

const screenshots = files.filter((file) => relativeAssetPath(file).startsWith("screenshots/") && extname(file).toLowerCase() === ".png");
if (screenshots.length < 1 || screenshots.length > 5) fail(`screenshots: expected 1–5 PNG files, found ${screenshots.length}`);
for (const screenshot of screenshots) {
  const name = relativeAssetPath(screenshot);
  try {
    const dimensions = inspectPng(await readFile(screenshot), false);
    if (dimensions.width !== 1280 || dimensions.height !== 800) {
      fail(`${name}: expected 1280x800, got ${dimensions.width}x${dimensions.height}`);
    }
  } catch (error) {
    fail(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (failures.length > 0) {
  console.error(`Store asset validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Store asset validation passed: ${files.length} files, ${screenshots.length} screenshot(s).`);
}
