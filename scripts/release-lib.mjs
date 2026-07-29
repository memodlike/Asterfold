import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

export function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function canonicalizeZipData(data, name) {
  if (data.includes(0)) return data;
  const decoded = data.toString("utf8");
  if (!Buffer.from(decoded, "utf8").equals(data)) return data;
  let normalized = decoded.replace(/\r\n?/gu, "\n");
  if (/\.html$/iu.test(name)) normalized = normalized.replace(/\n(?:[ \t]*\n)+([ \t]*<\/body>)/gu, "\n$1");
  return Buffer.from(normalized, "utf8");
}

export async function writeDeterministicZip(destination, entries, writeFile) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name, "en"));
  const names = new Set();
  for (const entry of sorted) {
    const normalized = entry.name.replaceAll("\\", "/");
    if (!normalized || normalized.startsWith("/") || normalized.split("/").some((part) => part === "..")) {
      throw new Error(`Unsafe ZIP entry: ${entry.name}`);
    }
    if (names.has(normalized)) throw new Error(`Duplicate ZIP entry: ${normalized}`);
    names.add(normalized);
    const name = Buffer.from(normalized);
    const data = canonicalizeZipData(await readFile(entry.path), normalized);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x5021, 12); // 2020-01-01
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0x5021, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(sorted.length, 8);
  end.writeUInt16LE(sorted.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  await writeFile(destination, Buffer.concat([...localParts, ...centralParts, end]));
}

export function readZipEntries(buffer) {
  const endSignature = 0x06054b50;
  let endOffset = -1;
  for (let offset = Math.max(0, buffer.length - 65_557); offset <= buffer.length - 22; offset += 1) {
    if (buffer.readUInt32LE(offset) === endSignature) endOffset = offset;
  }
  if (endOffset < 0) throw new Error("ZIP end-of-central-directory not found");
  const count = buffer.readUInt16LE(endOffset + 10);
  const centralOffset = buffer.readUInt32LE(endOffset + 16);
  const entries = [];
  const seen = new Set();
  let offset = centralOffset;
  for (let index = 0; index < count; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const externalAttributes = buffer.readUInt32LE(offset + 38);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (!name || name.startsWith("/") || name.includes("\\") || name.split("/").some((part) => part === "..")) throw new Error(`Unsafe ZIP entry: ${name}`);
    if (seen.has(name)) throw new Error(`Duplicate ZIP entry: ${name}`);
    seen.add(name);
    if (method !== 0) throw new Error(`Unexpected compression method for ${name}`);
    if (compressedSize !== uncompressedSize) throw new Error(`Unexpected compressed size for ${name}`);
    if ((externalAttributes >>> 16) & 0o111) throw new Error(`Executable ZIP entry is forbidden: ${name}`);
    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error(`Invalid local header for ${name}`);
    const localNameLength = buffer.readUInt16LE(localOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    entries.push({ name, size: uncompressedSize, data: buffer.subarray(dataStart, dataStart + uncompressedSize) });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export async function sha256File(path) {
  const data = await readFile(path);
  return createHash("sha256").update(data).digest("hex");
}

export async function checksumLine(path) {
  return `${await sha256File(path)}  ${basename(path)}`;
}
