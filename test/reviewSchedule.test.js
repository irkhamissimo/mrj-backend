const test = require("node:test");
const assert = require("node:assert/strict");
const { intervalForRating, nextReviewDate } = require("../utils/reviewSchedule");

test("difficult ratings return quickly", () => {
  assert.equal(intervalForRating(1, 30), 1);
  assert.equal(intervalForRating(2, 30), 1);
  assert.equal(intervalForRating(3, 30), 3);
});

test("easy ratings grow and cap the interval", () => {
  assert.equal(intervalForRating(4, 2), 7);
  assert.equal(intervalForRating(4, 10), 20);
  assert.equal(intervalForRating(5, 2), 14);
  assert.equal(intervalForRating(5, 30), 60);
});

test("next review date uses the calculated interval", () => {
  const reviewedAt = new Date("2026-01-01T00:00:00.000Z");
  const result = nextReviewDate(5, 1, reviewedAt);
  assert.equal(result.intervalDays, 14);
  assert.equal(result.nextReviewAt.toISOString(), "2026-01-15T00:00:00.000Z");
});

test("invalid ratings are rejected", () => {
  assert.throws(() => intervalForRating(0), /between 1 and 5/);
  assert.throws(() => intervalForRating(6), /between 1 and 5/);
});
