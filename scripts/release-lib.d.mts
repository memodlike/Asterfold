export interface ZipSourceEntry { path: string; name: string }
export interface ParsedZipEntry { name: string; size: number; data: Buffer }
export function crc32(data: Buffer): number;
export function writeDeterministicZip(destination: string, entries: ZipSourceEntry[], writeFile: typeof import("node:fs/promises").writeFile): Promise<void>;
export function readZipEntries(buffer: Buffer): ParsedZipEntry[];
export function sha256File(path: string): Promise<string>;
export function checksumLine(path: string): Promise<string>;
