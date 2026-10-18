// Squarified treemap layout (Bruls, Huizing, van Wijk 2000). Pure; used by the market heatmap.

export type Rect = { x: number; y: number; w: number; h: number };
export type Placed<T> = Rect & { item: T };

/** Worst aspect ratio in a row of areas laid along a side of length `side`. */
function worst(row: number[], side: number): number {
  const sum = row.reduce((a, b) => a + b, 0);
  const max = Math.max(...row), min = Math.min(...row);
  return Math.max((side * side * max) / (sum * sum), (sum * sum) / (side * side * min));
}

/** Lay items out in `rect` with areas proportional to `value`; items with value <= 0 are skipped. */
export function squarify<T>(items: T[], value: (t: T) => number, rect: Rect): Placed<T>[] {
  const list = items.map((item) => ({ item, v: value(item) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  const total = list.reduce((s, x) => s + x.v, 0);
  if (!total || rect.w <= 0 || rect.h <= 0) return [];
  const scale = (rect.w * rect.h) / total;
  const areas = list.map((x) => x.v * scale);
  const out: Placed<T>[] = [];
  let { x, y, w, h } = rect;
  let i = 0;
  while (i < areas.length) {
    const side = Math.min(w, h);
    const row = [areas[i]];
    let j = i + 1;
    while (j < areas.length && worst([...row, areas[j]], side) <= worst(row, side)) row.push(areas[j++]);
    const sum = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      // Column on the left edge.
      const cw = sum / h;
      let cy = y;
      row.forEach((a, k) => { const ch = a / cw; out.push({ x, y: cy, w: cw, h: ch, item: list[i + k].item }); cy += ch; });
      x += cw; w -= cw;
    } else {
      // Row along the top edge.
      const rh = sum / w;
      let cx = x;
      row.forEach((a, k) => { const rw = a / rh; out.push({ x: cx, y, w: rw, h: rh, item: list[i + k].item }); cx += rw; });
      y += rh; h -= rh;
    }
    i = j;
  }
  return out;
}
