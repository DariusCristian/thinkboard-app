import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const ratelimit =
  redisUrl && redisToken
    ? new Ratelimit({
        redis: new Redis({ url: redisUrl, token: redisToken }),
        limiter: Ratelimit.slidingWindow(
          Number(process.env.RATE_LIMIT || 60),
          process.env.RATE_LIMIT_WINDOW || "1 m"
        ),
      })
    : null;

export default async function rateLimiter(req, res, next) {
  if (!ratelimit) return next();

  try {
    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.ip ||
      "anonymous";

    const { success, limit, remaining, reset } = await ratelimit.limit(ip);
    res.setHeader("X-RateLimit-Limit", limit);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", reset);

    if (!success) {
      return res.status(429).json({ message: "Too many requests" });
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
