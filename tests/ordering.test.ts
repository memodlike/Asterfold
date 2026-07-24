import { describe, expect, it } from "vitest";
import {
  allocateAtEnd,
  allocateBetween,
  compareRanks,
  moveMany,
  rebalance,
  validateScope,
} from "../src/domain/ordering";

interface Item {
  id: string;
  position: string;
}

describe("ordering service", () => {
  it("allocates 1,000 sequential append positions without duplicates", () => {
    let items: Item[] = [];
    for (let index = 0; index < 1_000; index += 1) {
      const allocation = allocateAtEnd(items);
      items = [...allocation.scope, { id: String(index), position: allocation.position }];
    }
    expect(validateScope(items)).toEqual([]);
    expect(new Set(items.map((item) => item.position)).size).toBe(1_000);
  });

  it("uses deterministic ASCII ordering independent of locale", () => {
    expect(compareRanks("00000000000a", "00000000000b")).toBeLessThan(0);
    expect(compareRanks("00000000000b", "00000000000a")).toBeGreaterThan(0);
    expect(compareRanks("00000000000a", "00000000000a")).toBe(0);
  });

  it("rebalances dense positions and retries allocation between neighbors", () => {
    const dense = [
      { id: "a", position: "000000000001" },
      { id: "b", position: "000000000002" },
    ];
    const allocation = allocateBetween(dense, "a", "b");
    expect(allocation.scope.map((item) => item.id)).toEqual(["a", "b"]);
    expect(allocation.position).not.toBe(dense[0]?.position);
    expect(allocation.position).not.toBe(dense[1]?.position);
    expect(validateScope([...allocation.scope, { id: "new", position: allocation.position }])).toEqual([]);
  });

  it("moves many items atomically while preserving their relative order", () => {
    const scope = rebalance(Array.from({ length: 8 }, (_, index) => ({ id: String(index), position: "" })));
    const moved = moveMany(scope, ["5", "2", "5", "4"], 1);
    expect(moved.map((item) => item.id)).toEqual(["0", "2", "4", "5", "1", "3", "6", "7"]);
    expect(validateScope(moved)).toEqual([]);
  });

  it("survives 10,000 deterministic random moves", () => {
    let scope = rebalance(Array.from({ length: 100 }, (_, index) => ({ id: String(index), position: "" })));
    let state = 0x1234abcd;
    for (let index = 0; index < 10_000; index += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      const source = String(state % 100);
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      scope = moveMany(scope, [source], state % 100);
    }
    expect(validateScope(scope)).toEqual([]);
    expect(new Set(scope.map((item) => item.id)).size).toBe(100);
  });

  it("reports invalid and duplicate positions and repairs them safely", () => {
    const corrupted = [
      { id: "a", position: "invalid" },
      { id: "b", position: "000000000001" },
      { id: "c", position: "000000000001" },
    ];
    expect(validateScope(corrupted).map((issue) => issue.code)).toEqual([
      "INVALID_RANK",
      "DUPLICATE_RANK",
    ]);
    expect(validateScope(rebalance(corrupted))).toEqual([]);
  });
});
