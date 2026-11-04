const test = require("node:test");
const assert = require("node:assert/strict");
const { mergeRanges } = require("../utils/verseRanges");

test("merges overlapping and adjacent verse ranges", () => {
  assert.deepEqual(
    mergeRanges([
      { fromVerse: 5, toVerse: 8 },
      { fromVerse: 1, toVerse: 4 },
      { fromVerse: 7, toVerse: 10 },
    ]),
    [{ fromVerse: 1, toVerse: 10 }]
  );
});

test("preserves gaps between verse ranges", () => {
  assert.deepEqual(
    mergeRanges([
      { fromVerse: 1, toVerse: 3 },
      { fromVerse: 7, toVerse: 9 },
    ]),
    [
      { fromVerse: 1, toVerse: 3 },
      { fromVerse: 7, toVerse: 9 },
    ]
  );
});
