const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const { parseFigureExpr } = loadTypeScript("lib/figure-expr.ts");

test("figure expressions follow the same closed grammar as the backend", () => {
  const cases = { "x^2-4*x+3": 3, "2x+1": 1, "-x^2": -0, "sqrt(4)+abs(-1)": 3, "sin(0)+cos(0)": 1, "2^-1": 0.5, "(x+1)/2": 0.5, "x^2 − 4x + 3": 3 };
  for (const [src, want] of Object.entries(cases)) {
    const fn = parseFigureExpr(src);
    assert.ok(fn, src);
    assert.equal(fn(0) + 0, want + 0, src);
  }
  assert.equal(parseFigureExpr("x^2-4*x+3")(2), -1);
});

test("anything outside the grammar is rejected instead of evaluated", () => {
  for (const bad of ["", "x+", "foo(x)", "x;1", "alert(1)", "window", "x**2", "constructor", "((((((((((((((((((((((((((x))))))))))))))))))))))))))"]) {
    assert.equal(parseFigureExpr(bad), null, JSON.stringify(bad));
  }
});
