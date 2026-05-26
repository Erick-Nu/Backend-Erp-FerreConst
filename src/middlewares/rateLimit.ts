import type { RequestHandler } from 'express';

type RateLimitOptions = {
  maxRequests: number;
  windowMs: number;
  message?: string;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const DEFAULT_RATE_LIMIT_MESSAGE = 'Too many requests, please try again later';
const TOO_MANY_REQUESTS_STATUS_CODE = 429;
const ONE_SECOND_MS = 1000;

function getClientKey(ip: string | undefined): string {
  if (typeof ip !== 'string') {
    return '';
  }

  return ip;
}

function createRateLimit(options: RateLimitOptions): RequestHandler {
  const { maxRequests, windowMs, message = DEFAULT_RATE_LIMIT_MESSAGE } = options;
  const requestsByClient = new Map<string, RateLimitEntry>();

  return (req, res, next) => {
    const now = Date.now();
    const clientKey = getClientKey(req.ip);
    const currentEntry = requestsByClient.get(clientKey);

    if (!currentEntry || currentEntry.resetAt <= now) {
      const resetAt = now + windowMs;
      requestsByClient.set(clientKey, {
        count: 1,
        resetAt,
      });

      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
      res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / ONE_SECOND_MS)));
      next();
      return;
    }

    if (currentEntry.count >= maxRequests) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((currentEntry.resetAt - now) / ONE_SECOND_MS),
      );
      res.setHeader('Retry-After', String(retryAfterSeconds));
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', '0');
      res.setHeader(
        'X-RateLimit-Reset',
        String(Math.ceil(currentEntry.resetAt / ONE_SECOND_MS)),
      );
      res.status(TOO_MANY_REQUESTS_STATUS_CODE).json({
        message,
      });
      return;
    }

    currentEntry.count += 1;
    requestsByClient.set(clientKey, currentEntry);

    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(maxRequests - currentEntry.count));
    res.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(currentEntry.resetAt / ONE_SECOND_MS)),
    );

    next();
  };
}

export { createRateLimit };
