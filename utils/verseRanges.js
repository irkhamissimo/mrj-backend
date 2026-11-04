function mergeRanges(ranges) {
  return [...ranges]
    .map((range) => ({ fromVerse: Number(range.fromVerse), toVerse: Number(range.toVerse) }))
    .sort((a, b) => a.fromVerse - b.fromVerse)
    .reduce((result, range) => {
      const last = result[result.length - 1];
      if (last && range.fromVerse <= last.toVerse + 1) {
        last.toVerse = Math.max(last.toVerse, range.toVerse);
      } else {
        result.push(range);
      }
      return result;
    }, []);
}

module.exports = { mergeRanges };
