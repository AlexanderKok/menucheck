# Suggested Improvements for Future Implementation

This document contains recommendations for enhancing the codebase that were identified during code reviews but are not critical for immediate implementation.

## Feature 0004: Public Upload API - Non-Critical Improvements

### 1. PDF Processing Enhancement
**Location**: `server/src/api.ts` - PDF Processing (lines 168-244)
**Issue**: PDF parsing happens immediately in the upload endpoint, which could cause timeouts for large files
**Recommendation**: 
- Move PDF parsing to background queue for large files (>5MB)
- Add file size limits to prevent abuse (suggest 10MB max)
- Implement progress tracking for large file processing
- Return upload ID immediately and process in background

**Implementation Steps**:
1. Add file size check in upload endpoint
2. Create background job for PDF processing
3. Update client to poll for processing status
4. Add progress indicators in UI

---

### 2. Database Cleanup Job Implementation
**Location**: Multiple locations need coordination
**Issue**: 7-day expiration is hardcoded but no cleanup job is implemented
**Recommendation**:
- Implement periodic cleanup for expired public uploads
- Add GDPR-compliant IP address retention policies
- Create maintenance script for database housekeeping

**Implementation Steps**:
1. Create cleanup script in `server/scripts/cleanup-expired-uploads.js`
2. Add cron job or scheduled task configuration
3. Implement IP address anonymization after retention period
4. Add logging for cleanup operations

**Retention Policy Suggestion**:
- Public uploads: 7 days after expiration
- Rate limit records: 48 hours after window
- IP addresses: Anonymize after 30 days for GDPR compliance

---

### 3. Rate Limiting Enhancement
**Location**: `server/src/middleware/rateLimit.ts`
**Issue**: Current implementation is basic but could be more sophisticated
**Recommendation**:
- Add IP whitelist for development/testing environments
- Consider different rate limits for different endpoints
- Implement sliding window rate limiting for better UX

**Implementation Steps**:
1. Add environment-based IP whitelist
2. Create endpoint-specific rate limit configurations
3. Implement Redis-based rate limiting for better scalability
4. Add rate limit analytics and monitoring

**Suggested Rate Limits**:
- PDF Upload: 10 per hour (more resource intensive)
- URL Parse: 30 per hour (current)
- Report Request: 50 per hour (lightweight)

---

## General Code Quality Improvements

### Security Enhancements
- Add request validation middleware for all public endpoints
- Implement request size limits
- Add honeypot fields to forms to detect bots
- Consider implementing CSRF protection for public forms

### Performance Optimizations
- Add response caching for static analysis data
- Implement database connection pooling optimization
- Add query optimization for rate limiting checks
- Consider implementing CDN for static assets

### Monitoring and Observability
- Add structured logging throughout the application
- Implement metrics collection for rate limiting effectiveness
- Add health checks for all external dependencies
- Create dashboard for public upload analytics

---

## Priority Levels

**High Priority** (implement in next sprint):
- PDF Processing Enhancement (affects user experience)
- Database Cleanup Job (prevents data bloat)

**Medium Priority** (implement in next month):
- Rate Limiting Enhancement (improves system robustness)
- Security Enhancements (hardens system)

**Low Priority** (implement when scaling):
- Performance Optimizations
- Advanced Monitoring

---

## Notes for Developers

- All improvements should maintain backward compatibility
- Consider feature flags for gradual rollout of enhancements
- Test thoroughly in staging environment before production
- Update documentation when implementing any of these suggestions
- Consider user feedback when prioritizing these improvements

---

*Document created during Feature 0004 code review - refer to docs/features/0004_REVIEW.md for full context*

