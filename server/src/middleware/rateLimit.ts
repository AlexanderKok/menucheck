import { Next } from 'hono';

type Variables = { clientIP?: string };
import { getDatabase } from '../lib/db';
import { rateLimitTracker } from '../schema/publicUploads';
import { eq, and, gte, lt } from 'drizzle-orm';
import type { RateLimitInfo } from '../types/url-parsing';

const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_MAX_REQUESTS = 30;

/**
 * Get client IP address from request headers
 */
function getClientIP(c: any): string {
  // Check common headers for real IP (reverse proxy/load balancer scenarios)
  const forwardedFor = c.req.header('x-forwarded-for');
  const realIP = c.req.header('x-real-ip');
  const cfConnectingIP = c.req.header('cf-connecting-ip'); // Cloudflare
  
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  // Fallback to connection remote address (may not be accurate behind proxies)
  return c.env?.REMOTE_ADDR || '127.0.0.1';
}

/**
 * Check rate limit for given IP address
 */
export async function checkRateLimit(ipAddress: string): Promise<RateLimitInfo> {
  const db = await getDatabase();
  const now = new Date();
  const windowStart = new Date(now.getTime() - (RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000));
  
  try {
    // Find existing rate limit record for this IP within the current window
    const existingRecord = await db
      .select()
      .from(rateLimitTracker)
      .where(
        and(
          eq(rateLimitTracker.ipAddress, ipAddress),
          gte(rateLimitTracker.windowStart, windowStart)
        )
      )
      .limit(1);
    
    if (existingRecord.length === 0) {
      // No recent requests, allow this one
      return {
        allowed: true,
        requestsRemaining: RATE_LIMIT_MAX_REQUESTS - 1,
        resetTime: new Date(now.getTime() + (RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000))
      };
    }
    
    const record = existingRecord[0];
    const requestsRemaining = RATE_LIMIT_MAX_REQUESTS - record.requestCount - 1;
    
    if (record.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
      // Rate limit exceeded
      const resetTime = new Date(record.windowStart.getTime() + (RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000));
      const retryAfter = Math.ceil((resetTime.getTime() - now.getTime()) / 1000);
      
      return {
        allowed: false,
        requestsRemaining: 0,
        resetTime,
        retryAfter
      };
    }
    
    // Within rate limit
    return {
      allowed: true,
      requestsRemaining: Math.max(0, requestsRemaining),
      resetTime: new Date(record.windowStart.getTime() + (RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000))
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On database error, allow the request but log the issue
    return {
      allowed: true,
      requestsRemaining: RATE_LIMIT_MAX_REQUESTS - 1,
      resetTime: new Date(now.getTime() + (RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000))
    };
  }
}

/**
 * Record a rate limited request
 */
export async function recordRequest(ipAddress: string): Promise<void> {
  const db = await getDatabase();
  const now = new Date();
  const windowStart = new Date(now.getTime() - (RATE_LIMIT_WINDOW_HOURS * 60 * 60 * 1000));
  
  try {
    // Find existing record for current window
    const existingRecord = await db
      .select()
      .from(rateLimitTracker)
      .where(
        and(
          eq(rateLimitTracker.ipAddress, ipAddress),
          gte(rateLimitTracker.windowStart, windowStart)
        )
      )
      .limit(1);
    
    if (existingRecord.length === 0) {
      // Create new record
      const recordId = `rate_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await db.insert(rateLimitTracker).values({
        id: recordId,
        ipAddress,
        requestCount: 1,
        windowStart: now,
      });
    } else {
      // Update existing record
      await db
        .update(rateLimitTracker)
        .set({ 
          requestCount: existingRecord[0].requestCount + 1,
          updatedAt: now
        })
        .where(eq(rateLimitTracker.id, existingRecord[0].id));
    }
  } catch (error) {
    console.error('Failed to record rate limit request:', error);
    // Don't throw - this shouldn't block the actual request
  }
}

/**
 * Clean up old rate limit records (should be called periodically)
 */
export async function cleanupOldRateLimitRecords(): Promise<void> {
  const db = await getDatabase();
  const cutoffTime = new Date(Date.now() - (RATE_LIMIT_WINDOW_HOURS * 2 * 60 * 60 * 1000)); // Keep 2x window for safety
  
  try {
    await db
      .delete(rateLimitTracker)
      .where(lt(rateLimitTracker.windowStart, cutoffTime));
  } catch (error) {
    console.error('Failed to cleanup old rate limit records:', error);
  }
}

/**
 * Hono middleware for rate limiting
 */
export async function rateLimitMiddleware(c: any, next: Next) {
  const ipAddress = getClientIP(c);
  const rateLimitInfo = await checkRateLimit(ipAddress);
  
  if (!rateLimitInfo.allowed) {
    return c.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        message: `Too many requests. You can make ${RATE_LIMIT_MAX_REQUESTS} requests per hour.`,
        retryAfter: rateLimitInfo.retryAfter,
        resetTime: rateLimitInfo.resetTime.toISOString()
      },
      429,
      {
        'Retry-After': rateLimitInfo.retryAfter?.toString() || '3600',
        'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.requestsRemaining.toString(),
        'X-RateLimit-Reset': Math.floor(rateLimitInfo.resetTime.getTime() / 1000).toString()
      }
    );
  }
  
  // Record this request
  await recordRequest(ipAddress);
  
  // Add rate limit info to response headers
  c.header('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
  c.header('X-RateLimit-Remaining', rateLimitInfo.requestsRemaining.toString());
  c.header('X-RateLimit-Reset', Math.floor(rateLimitInfo.resetTime.getTime() / 1000).toString());
  
  // Store IP for use in route handlers
  c.set('clientIP', ipAddress);
  
  await next();
}