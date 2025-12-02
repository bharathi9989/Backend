// lightweight rate limiter for sensitive endpoints (simple memory, not for prod)
const attempts = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX = 30;

export const simpleRateLimiter = (req, res, next) => {
  const key = req.ip;
  const data = attempts.get(key) || { count: 0, ts: Date.now() };
  if (Date.now() - data.ts > WINDOW_MS) {
    attempts.set(key, { count: 1, ts: Date.now() });
    return next();
  }
  data.count++;
  attempts.set(key, data);
  if (data.count > MAX)
    return res.status(429).json({ message: "Too many requests" });
  next();
};
