import { describe, expect, it } from "vitest";
import { squarify } from "./treemap.ts";

describe("squarify", () => {
  const rect = { x: 0, y: 0, w: 600, h: 400 };
  const values = [6, 6, 4, 3, 2, 2, 1];
  const placed = squarify(values, (v) => v, rect);

  it("gives every item an area proportional to its value and fills the rect", () => {
    const scale = (600 * 400) / values.reduce((a, b) => a + b, 0);
    expect(placed).toHaveLength(values.length);
    for (const p of placed) expect(p.w * p.h).toBeCloseTo(p.item * scale, 6);
    expect(placed.reduce((s, p) => s + p.w * p.h, 0)).toBeCloseTo(600 * 400, 6);
  });

  it("stays inside the rect without overlaps", () => {
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(-1e-9);
      expect(p.y).toBeGreaterThanOrEqual(-1e-9);
      expect(p.x + p.w).toBeLessThanOrEqual(600 + 1e-9);
      expect(p.y + p.h).toBeLessThanOrEqual(400 + 1e-9);
    }
    for (const a of placed) for (const b of placed) {
      if (a === b) continue;
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(ox <= 1e-9 || oy <= 1e-9).toBe(true);
    }
  });

  it("skips non-positive values and handles empty input", () => {
    expect(squarify([3, 0, -1], (v) => v, rect)).toHaveLength(1);
    expect(squarify([], (v: number) => v, rect)).toEqual([]);
  });
});
