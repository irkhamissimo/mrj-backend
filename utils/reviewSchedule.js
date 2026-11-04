const DAY_MS = 24 * 60 * 60 * 1000;

function intervalForRating(rating, previousInterval = 1) {
  if (![1, 2, 3, 4, 5].includes(rating)) {
    throw new Error("Rating must be between 1 and 5");
  }

  if (rating <= 2) return 1;
  if (rating === 3) return 3;
  if (rating === 4) return Math.min(60, Math.max(7, previousInterval * 2));
  return Math.min(60, Math.max(14, previousInterval * 3));
}

function nextReviewDate(rating, previousInterval, reviewedAt = new Date()) {
  const intervalDays = intervalForRating(rating, previousInterval);
  return {
    intervalDays,
    nextReviewAt: new Date(reviewedAt.getTime() + intervalDays * DAY_MS),
  };
}

module.exports = { intervalForRating, nextReviewDate };
