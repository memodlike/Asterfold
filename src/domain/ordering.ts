import { ValidationError } from "./errors";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = 36n;
export const RANK_WIDTH = 12;
const MAX_RANK = BASE ** BigInt(RANK_WIDTH) - 1n;

function parseRank(rank: string): bigint {
  if (!new RegExp(`^[0-9a-z]{${RANK_WIDTH}}$`).test(rank)) {
    throw new ValidationError(`Invalid position key: ${rank}`);
  }

  let value = 0n;
  for (const character of rank) {
    value = value * BASE + BigInt(ALPHABET.indexOf(character));
  }
  return value;
}

function formatRank(value: bigint): string {
  if (value < 0n || value > MAX_RANK) {
    throw new ValidationError("Position key is outside the supported range");
  }

  let current = value;
  let result = "";
  while (current > 0n) {
    const digit = ALPHABET[Number(current % BASE)];
    if (digit === undefined) throw new ValidationError("Unable to encode position key");
    result = digit + result;
    current /= BASE;
  }
  return result.padStart(RANK_WIDTH, "0");
}

export function compareRanks(left: string, right: string): number {
  return left.localeCompare(right);
}

export function rankBetween(previous: string | null, next: string | null): string | null {
  const lower = previous === null ? 0n : parseRank(previous);
  const upper = next === null ? MAX_RANK : parseRank(next);

  if (lower >= upper) {
    throw new ValidationError("Position bounds are reversed");
  }
  if (upper - lower <= 1n) return null;
  return formatRank((lower + upper) / 2n);
}

export function evenlySpacedRanks(count: number): string[] {
  if (!Number.isInteger(count) || count < 0) {
    throw new ValidationError("Position count must be a non-negative integer");
  }
  if (count === 0) return [];

  const step = MAX_RANK / BigInt(count + 1);
  return Array.from({ length: count }, (_, index) => formatRank(step * BigInt(index + 1)));
}

export function isValidRank(rank: string): boolean {
  try {
    parseRank(rank);
    return true;
  } catch {
    return false;
  }
}
