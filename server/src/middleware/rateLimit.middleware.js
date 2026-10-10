const buckets = new Map();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 30;

export const userRateLimit = (req, res, next) => {
  const userId = req.user?._id?.toString();
  if (!userId) {
    return res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Authentication required' },
    });
  }

  const now = Date.now();
  const recent = (buckets.get(userId) || []).filter((timestamp) => now - timestamp < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    const retryAfter = Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
    res.set('Retry-After', String(retryAfter));
    return res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many requests; please try again shortly' },
    });
  }

  recent.push(now);
  buckets.set(userId, recent);
  return next();
};

export const clearRateLimitBuckets = () => buckets.clear();
