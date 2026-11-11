require("./helpers/register-ui.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { visibleFilterCount, filterValuesEqual } = require("../lib/responsive-filters.ts");

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

test("unchanged primitive filters do not need applying, including empty and false values", () => {
  assert.equal(filterValuesEqual("", ""), true);
  assert.equal(filterValuesEqual(false, false), true);
  assert.equal(filterValuesEqual(false, ""), false);
  assert.equal(filterValuesEqual("ACTIVE", "PENDING"), false);
});

test("date drafts compare values rather than object identity or key order", () => {
  assert.equal(filterValuesEqual({ from: "2026-11-01", to: "2026-11-11" }, { to: "2026-11-11", from: "2026-11-01" }), true);
  assert.equal(filterValuesEqual({ from: "2026-11-01", to: "" }, { from: "2026-11-01", to: "2026-11-11" }), false);
  assert.equal(filterValuesEqual({ from: "", to: "" }, { from: "" }), false);
});

test("rendering and editing a filter draft never invokes its applied change callback", () => {
  const React = require("react");
  const { defineToolbarFilter } = require("../components/ui/responsive-filter-toolbar.tsx");
  const applied = [];
  const pending = [];
  const filter = defineToolbarFilter({
    id: "status", label: "Trạng thái", value: "ACTIVE", defaultValue: "",
    onChange: (value) => applied.push(value),
    render: (value, onChange) => React.createElement("input", { value, onChange: (event) => onChange(event.target.value) }),
  });
  const input = filter.render("ACTIVE", (value) => pending.push(value), { inPopup: true, values: {}, setValue() {} });
  input.props.onChange({ target: { value: "PENDING" } });
  assert.deepEqual(pending, ["PENDING"]);
  assert.deepEqual(applied, []);
  filter.apply(pending[0]);
  assert.deepEqual(applied, ["PENDING"]);
});
