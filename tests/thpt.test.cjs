const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const resolve = (id) => (id.startsWith("@/") ? loadTypeScript(id.slice(2) + ".ts", resolve) : require(id));
const thpt = loadTypeScript("lib/thpt.ts", resolve);
const paper = loadTypeScript("lib/exam-paper.ts", resolve);
const blueprints = loadTypeScript("lib/thpt-blueprints.ts", resolve);

const set = (id, truth) => ({ type: "TRUE_FALSE_SET", options: ["a", "b", "c", "d"].map((x) => ({ id: x, text: x })), correctOptionIds: truth, id, content: "c", points: 1 });

test("every official paper structure adds up to 10 points", () => {
  for (const bp of blueprints.THPT_BLUEPRINTS) assert.equal(blueprints.totalPoints(bp.sections), 10, bp.code);
  const math = blueprints.blueprintByCode("MATH");
  assert.deepEqual(math.sections.map((s) => s.count), [12, 4, 6]);
  assert.equal(math.minutes, 90);
});

test("a subject name picks its paper structure", () => {
  const pick = blueprints.suggestBlueprint;
  assert.equal(pick("Toán học"), "MATH");
  assert.equal(pick("Vật lý 12"), "SCIENCE");
  assert.equal(pick("Hóa học"), "SCIENCE");
  assert.equal(pick("Sinh học"), "SCIENCE");
  assert.equal(pick("Tiếng Anh"), "ENGLISH");
  assert.equal(pick("Ngữ văn"), "LITERATURE");
  assert.equal(pick("Lịch sử"), "SOCIAL");
  assert.equal(pick(undefined), "SOCIAL");
});

test("Đúng/Sai answers are judged per statement with the official partial credit", () => {
  const q = set("q", ["a", "c"]);
  const ans = (yes, no) => ({ selectedOptionIds: yes, falseOptionIds: no, essayText: "" });
  assert.equal(thpt.objectiveRatio(q, ans(["a", "c"], ["b", "d"])), 1);
  assert.equal(thpt.objectiveRatio(q, ans(["a", "c"], ["b"])), 0.5);
  assert.equal(thpt.objectiveRatio(q, ans(["a"], ["b"])), 0.25);
  assert.equal(thpt.objectiveRatio(q, ans(["a"], [])), 0.1);
  assert.equal(thpt.objectiveRatio(q, ans([], [])), 0);
  const judged = thpt.judgeStatement(ans(["a"], ["b"]), "a", false);
  assert.deepEqual([judged.selectedOptionIds, judged.falseOptionIds], [[], ["b", "a"]]);
});

test("short answers match equivalent numbers", () => {
  const q = { type: "SHORT_ANSWER", options: [], correctOptionIds: ["-2,5"] };
  for (const [given, want] of [["-2,5", 1], [" −2.50", 1], ["2,5", 0], ["", 0]]) {
    assert.equal(thpt.objectiveRatio(q, { selectedOptionIds: [], essayText: given }), want, given);
  }
});

test("printed papers restart numbering per part, keep Đúng/Sai statements and shuffle other versions", () => {
  const mc = (i) => ({ id: "m" + i, type: "SINGLE_CHOICE", content: "x", points: 0.25, correctOptionIds: ["a"], options: ["a", "b", "c", "d"].map((x) => ({ id: x, text: x })) });
  const qs = [mc(1), mc(2), mc(3), mc(4), set("s1", ["a"]), set("s2", ["b"]), { id: "sa", type: "SHORT_ANSWER", content: "y", points: 0.5, options: [], correctOptionIds: ["3"] }];
  const [v1, v2] = paper.buildPaper(qs, 2);
  assert.deepEqual(v1.parts.map((p) => p.part), [1, 2, 3]);
  assert.deepEqual(v1.parts[0].questions.map((q) => q.id), ["m1", "m2", "m3", "m4"]);
  assert.match(v1.parts[1].instruction, /từ câu 1 đến câu 2/);
  assert.deepEqual(v1.parts[1].questions[0].options.map((o) => o.label), ["a", "b", "c", "d"]);
  assert.equal(v1.code, "101");
  assert.equal(v2.code, "102");
  assert.deepEqual(v2.parts[1].questions[0].options.map((o) => o.id), ["a", "b", "c", "d"], "statement order never changes");
  const again = paper.buildPaper(qs, 2)[1];
  assert.deepEqual(again.parts[0].questions.map((q) => q.id), v2.parts[0].questions.map((q) => q.id), "versions are deterministic");
  // Labels follow the shuffled order and the key still points at the right option.
  const q = v2.parts[0].questions[0];
  assert.deepEqual(q.options.map((o) => o.label), ["A", "B", "C", "D"]);
  assert.equal(paper.answerKeyText(q), q.options.find((o) => o.id === "a").label);
});

test("a part is spread from easy to very hard like a real paper", () => {
  const split = blueprints.splitByDifficulty;
  const all = ["EASY", "MEDIUM", "HARD", "VERY_HARD"];
  assert.deepEqual(split(12, all), [{ difficulty: "EASY", count: 5 }, { difficulty: "MEDIUM", count: 4 }, { difficulty: "HARD", count: 2 }, { difficulty: "VERY_HARD", count: 1 }]);
  assert.deepEqual(split(4, all), [{ difficulty: "EASY", count: 2 }, { difficulty: "MEDIUM", count: 1 }, { difficulty: "HARD", count: 1 }]);
  assert.deepEqual(split(1, all), [{ difficulty: "EASY", count: 1 }]);
  assert.deepEqual(split(24, ["EASY", "MEDIUM", "HARD"]), [{ difficulty: "EASY", count: 12 }, { difficulty: "MEDIUM", count: 7 }, { difficulty: "HARD", count: 5 }]);
  assert.deepEqual(split(5, ["HARD", "EASY"]).map((p) => p.difficulty), ["EASY", "HARD"], "levels come out easiest first");
  assert.deepEqual(split(5, []), []);
  for (let n = 1; n <= 40; n++) assert.equal(split(n, all).reduce((sum, p) => sum + p.count, 0), n, `count ${n} keeps every question`);
});
