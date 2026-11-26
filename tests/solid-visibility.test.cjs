const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const { resolveHiddenEdges } = loadTypeScript("lib/solid-visibility.ts");
const seg = (from, to, hidden = false) => ({ from, to, hidden });

test("a pyramid hides exactly the back edges AD, DC and DS", () => {
  const points = [["A", 0, 0, 0], ["B", 2, 0, 0], ["C", 2, 2, 0], ["D", 0, 2, 0], ["S", 0, 0, 3]].map(([name, x, y, z]) => ({ name, x, y, z }));
  const edges = [["S", "A"], ["S", "B"], ["S", "C"], ["S", "D"], ["A", "B"], ["B", "C"], ["C", "D"], ["A", "D"]];
  const hidden = resolveHiddenEdges(points, edges.map(([a, b]) => seg(a, b)));
  const hiddenNames = edges.filter((_, i) => hidden[i]).map((e) => e.join(""));
  assert.deepEqual(hiddenNames.sort(), ["AD", "CD", "SD"]);
});

test("the model's own dashes are ignored on hull edges but kept for inner segments", () => {
  const points = [["A", 0, 0, 0], ["B", 2, 0, 0], ["C", 2, 2, 0], ["D", 0, 2, 0], ["S", 0, 0, 3]].map(([name, x, y, z]) => ({ name, x, y, z }));
  // AB is a visible front edge even if flagged hidden; the base diagonal AC is inside the solid's face plane? it lies in the base face, so it follows the base (back-facing).
  const hidden = resolveHiddenEdges(points, [seg("A", "B", true), seg("A", "C", false)]);
  assert.equal(hidden[0], false);
  assert.equal(hidden[1], true);
});

test("a flat figure falls back to the flags it came with", () => {
  const points = [["A", 0, 0, 0], ["B", 1, 0, 0], ["C", 1, 1, 0], ["D", 0, 1, 0]].map(([name, x, y, z]) => ({ name, x, y, z }));
  assert.deepEqual(resolveHiddenEdges(points, [seg("A", "B", true), seg("B", "C", false)]), [true, false]);
});
