import { ValidationError } from "./errors";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const BASE = 36n;
export const RANK_WIDTH = 12;
const MAX_RANK = BASE ** BigInt(RANK_WIDTH) - 1n;
const RANK_PATTERN = new RegExp(`^[0-9a-z]{${RANK_WIDTH}}$`);

export interface RankedEntity {
  id: string;
  position: string;
}

export interface OrderingIssue {
  code: "INVALID_RANK" | "DUPLICATE_RANK" | "DUPLICATE_ID";
  id: string;
  position: string;
}

export interface RankAllocation<T extends RankedEntity> {
  position: string;
  scope: T[];
}

function parseRank(rank: string): bigint {
  if (!RANK_PATTERN.test(rank)) {
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
  return left < right ? -1 : left > right ? 1 : 0;
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
  return RANK_PATTERN.test(rank);
}

function ordered<T extends RankedEntity>(scope: readonly T[]): T[] {
  return [...scope].sort((left, right) => compareRanks(left.position, right.position));
}

export function validateScope(scope: readonly RankedEntity[]): OrderingIssue[] {
  const issues: OrderingIssue[] = [];
  const ids = new Set<string>();
  const positions = new Set<string>();
  for (const item of scope) {
    if (ids.has(item.id)) issues.push({ code: "DUPLICATE_ID", id: item.id, position: item.position });
    ids.add(item.id);
    if (!isValidRank(item.position)) {
      issues.push({ code: "INVALID_RANK", id: item.id, position: item.position });
      continue;
    }
    if (positions.has(item.position)) issues.push({ code: "DUPLICATE_RANK", id: item.id, position: item.position });
    positions.add(item.position);
  }
  return issues;
}

export function rebalance<T extends RankedEntity>(scope: readonly T[]): T[] {
  const ranks = evenlySpacedRanks(scope.length);
  return scope.map((item, index) => ({ ...item, position: ranks[index]! }));
}

export function allocateAtEnd<T extends RankedEntity>(scope: readonly T[]): RankAllocation<T> {
  let normalized = validateScope(scope).length === 0 ? ordered(scope) : rebalance(scope);
  let position = rankBetween(normalized.at(-1)?.position ?? null, null);
  if (position === null) {
    normalized = rebalance(normalized);
    position = rankBetween(normalized.at(-1)?.position ?? null, null);
  }
  if (position === null) throw new ValidationError("Unable to allocate a position after rebalancing");
  return { position, scope: normalized };
}

export function allocateBetween<T extends RankedEntity>(
  scope: readonly T[],
  previousId: string | null,
  nextId: string | null,
): RankAllocation<T> {
  let normalized = validateScope(scope).length === 0 ? ordered(scope) : rebalance(scope);
  const bounds = (): [string | null, string | null] => {
    const previous = previousId === null ? null : normalized.find((item) => item.id === previousId)?.position;
    const next = nextId === null ? null : normalized.find((item) => item.id === nextId)?.position;
    if (previous === undefined || next === undefined) throw new ValidationError("Position boundary was not found");
    return [previous, next];
  };
  let [previous, next] = bounds();
  let position = rankBetween(previous, next);
  if (position === null) {
    normalized = rebalance(normalized);
    [previous, next] = bounds();
    position = rankBetween(previous, next);
  }
  if (position === null) throw new ValidationError("Unable to allocate a position after rebalancing");
  return { position, scope: normalized };
}

export function moveMany<T extends RankedEntity>(
  scope: readonly T[],
  ids: readonly string[],
  targetIndex: number,
): T[] {
  const normalized = validateScope(scope).length === 0 ? ordered(scope) : rebalance(scope);
  const selectedIds = new Set(ids);
  const selected = normalized.filter((item) => selectedIds.has(item.id));
  if (selected.length !== selectedIds.size) throw new ValidationError("One or more ordered items were not found");
  const remaining = normalized.filter((item) => !selectedIds.has(item.id));
  const index = Math.max(0, Math.min(Math.trunc(targetIndex), remaining.length));
  remaining.splice(index, 0, ...selected);
  return rebalance(remaining);
}
