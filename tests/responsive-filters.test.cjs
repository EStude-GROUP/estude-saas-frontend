require("./helpers/register-ui.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { visibleFilterCount } = require("../lib/responsive-filters.ts");

test("all filters remain inline when they fit, including the exact boundary", () => {
  assert.equal(visibleFilterCount(972, [192, 192, 192], 360), 3);
  assert.equal(visibleFilterCount(971, [192, 192, 192], 360), 1);
});

test("one overflowing filter brings a second filter into the popup", () => {
  assert.equal(visibleFilterCount(1100, [192, 192, 192, 192], 360), 2);
  assert.equal(visibleFilterCount(700, [192, 192], 360), 0);
});

test("narrow containers move more trailing filters without reordering", () => {
  const widths = [256, 192, 192, 192, 192, 192];
  assert.equal(visibleFilterCount(1625, widths, 360), 4);
  assert.equal(visibleFilterCount(1000, widths, 360), 2);
  assert.equal(visibleFilterCount(500, widths, 360), 0);
  assert.equal(visibleFilterCount(0, widths, 360), 0);
  assert.equal(visibleFilterCount(2000, widths, 360), 6);
});

test("single or absent filters never produce a one-filter popup", () => {
  assert.equal(visibleFilterCount(200, [], 360), 0);
  assert.equal(visibleFilterCount(200, [192], 360), 1);
});

test("filter-only toolbars and actual control widths are supported", () => {
  assert.equal(visibleFilterCount(412, [160, 240]), 2);
  assert.equal(visibleFilterCount(411, [160, 240]), 0);
  assert.equal(visibleFilterCount(900, [150, 180, 230], 360), 1);
});
