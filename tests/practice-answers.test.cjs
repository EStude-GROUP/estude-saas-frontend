const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTypeScript } = require("./helpers/load-typescript.cjs");

const resolve = (id) => (id.startsWith("@/") ? loadTypeScript(id.slice(2) + ".ts", resolve) : require(id));
const practice = loadTypeScript("lib/practice-answers.ts", resolve);

const set = { id: "s", type: "TRUE_FALSE_SET", options: ["a", "b", "c", "d"].map((id) => ({ id, label: id, text: id })), correctOptionIds: ["a", "c"] };
const short = { id: "n", type: "SHORT_ANSWER", options: [], correctOptionIds: ["-2,5"] };
const single = { id: "m", type: "SINGLE_CHOICE", options: [] };
const multi = { id: "x", type: "MULTIPLE_CHOICE", options: [] };

test("each statement keeps one verdict and can be changed", () => {
  let v = practice.applyPracticeChoice(set, [], "a:T");
  v = practice.applyPracticeChoice(set, v, "b:F");
  v = practice.applyPracticeChoice(set, v, "a:F");
  assert.deepEqual([...v].sort(), ["a:F", "b:F"]);
  assert.equal(practice.statementValue(v, "a"), false);
  assert.equal(practice.statementValue(v, "c"), null);
});

test("answers are sent in the shape the server expects", () => {
  assert.deepEqual(practice.toPracticeSubmission(set, ["a:T", "b:F", "c:T"]), { questionId: "s", selectedOptionIds: ["a", "c"], falseOptionIds: ["b"] });
  assert.deepEqual(practice.toPracticeSubmission(short, [" 2,5 "]), { questionId: "n", selectedOptionIds: [], essayText: "2,5" });
  assert.deepEqual(practice.toPracticeSubmission(single, ["o1"]), { questionId: "m", selectedOptionIds: ["o1"] });
  assert.deepEqual(practice.toPracticeSubmission(short, undefined), { questionId: "n", selectedOptionIds: [], essayText: "" });
});

test("a graded question is turned back into the screen state", () => {
  assert.deepEqual(practice.storedPracticeAnswer({ ...set, selectedOptionIds: ["a"], falseOptionIds: ["b"] }), ["a:T", "b:F"]);
  assert.deepEqual(practice.storedPracticeAnswer({ ...short, selectedOptionIds: [], essayText: "7" }), ["7"]);
  assert.deepEqual(practice.storedPracticeAnswer({ ...short, selectedOptionIds: [], essayText: "  " }), []);
  assert.deepEqual(practice.storedPracticeAnswer({ ...single, selectedOptionIds: ["o2"] }), ["o2"]);
});

test("plain choices behave as before and short answers compare as numbers", () => {
  assert.deepEqual(practice.applyPracticeChoice(single, ["o1"], "o2"), ["o2"]);
  assert.deepEqual(practice.applyPracticeChoice(multi, ["o1"], "o2"), ["o1", "o2"]);
  assert.deepEqual(practice.applyPracticeChoice(multi, ["o1", "o2"], "o1"), ["o2"]);
  assert.deepEqual(practice.applyPracticeChoice(short, [], "  "), []);
  assert.equal(practice.shortAnswerIsRight(short, ["−2.50"]), true);
  assert.equal(practice.shortAnswerIsRight(short, ["2,5"]), false);
  assert.equal(practice.shortAnswerIsRight(short, []), false);
});
