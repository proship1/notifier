# LINE Messaging API Credit Savings Strategies

## Current Situation Analysis

Your webhook notifier currently sends a LINE message for **every webhook event**, which consumes credits rapidly. Based on the codebase analysis:

1. **Main message sending occurs at** `src/index.js:221` via `lineClient.pushMessage()`
2. **Existing deduplication**: 1-hour order ID caching (line 184-210)
3. **User mapping check**: Messages only sent to mapped users (line 151-160)
4. **Tracking monitoring**: Statistics collection without blocking (line 107-148)

## LINE API Pricing Structure

- **Free tier**: 500-5,000 messages/month depending on plan
- **Overage cost**: ~0.10 TWD per additional message
- **Monthly limits**: Hard limits that block sending when exceeded

## Recommended Credit Saving Strategies

### 1. **Message Batching & Aggregation** (HIGHEST IMPACT)
Instead of sending individual messages per webhook:
- **Batch multiple events** into digest messages (e.g., every 5-10 minutes)
- **Implementation approach**:
  - Queue incoming webhooks in Redis
  - Use a scheduled job to process and send batched messages
  - Group messages by user/group for consolidated delivery
- **Potential savings**: 80-90% reduction for high-volume periods

### 2. **Intelligent Filtering & Prioritization**
- **Filter non-critical events**: Only send important status changes
- **Event priority levels**: 
  - HIGH: Payment confirmations, shipping updates
  - MEDIUM: Order status changes
  - LOW: Informational updates (batch or skip)
- **User preferences**: Allow users to configure notification levels
- **Potential savings**: 30-50% reduction

### 3. **Enhanced Deduplication** 
Current system has 1-hour order deduplication. Enhance with:
- **Extend cache duration** for order IDs (currently 1 hour → 4-6 hours)
- **Content-based deduplication**: Hash message content to prevent identical messages
- **Smart duplicate detection**: Check if meaningful changes occurred
- **Potential savings**: 20-30% reduction

### 4. **Time-Based Throttling**
- **Rate limiting per user/group**: Max X messages per hour
- **Quiet hours**: Don't send low-priority messages at night
- **Burst protection**: Prevent webhook spam from consuming credits
- **Implementation**: Redis-based sliding window counters
- **Potential savings**: 15-25% reduction

### 5. **Message Bundling Using LINE Features**
LINE API allows up to **5 messages in a single API call**:
- Bundle related notifications together
- Use carousel/flex messages for multiple items
- **Potential savings**: Up to 80% for bundled content

### 6. **Smart Caching & State Management**
- **Track message state**: Don't resend if status hasn't changed
- **Incremental updates only**: Send diffs instead of full updates
- **User presence detection**: Skip if user inactive
- **Potential savings**: 10-20% reduction

### 7. **Alternative Delivery Methods**
- **Web dashboard**: Provide URL for detailed status instead of full message
- **Summary reports**: Daily digest instead of real-time
- **Pull vs Push**: Let users request updates via commands
- **Potential savings**: Variable based on user behavior

## Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. Extend order deduplication cache to 4-6 hours
2. Implement basic message filtering by webhook type
3. Add rate limiting per user (e.g., max 10 messages/hour)

### Phase 2: Batching System (3-5 days)
1. Build Redis queue for webhook events
2. Create batch processor with configurable intervals
3. Implement message bundling (up to 5 per API call)

### Phase 3: Advanced Features (1 week+)
1. User preference system for notification levels
2. Content-based deduplication
3. Analytics dashboard for credit usage monitoring

## Monitoring & Analytics

Track these metrics to optimize further:
- Messages sent per hour/day
- Duplicate rate
- Credit consumption rate
- User engagement with messages
- Peak usage times

## Example Implementation Snippets

### Simple Batching Queue (Redis-based)
```javascript
// Queue webhook for batching
async function queueWebhook(webhookData) {
  const batchKey = `batch:${webhookData.groupId}`;
  await redis.rPush(batchKey, JSON.stringify(webhookData));
  await redis.expire(batchKey, 600); // 10 minute TTL
}

// Process batched messages (run every 5 minutes)
async function processBatches() {
  const keys = await redis.keys('batch:*');
  for (const key of keys) {
    const messages = await redis.lRange(key, 0, -1);
    if (messages.length > 0) {
      const combined = combineMessages(messages);
      await sendBatchedMessage(combined);
      await redis.del(key);
    }
  }
}
```

### Rate Limiting
```javascript
async function checkRateLimit(userId) {
  const key = `ratelimit:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, 3600); // 1 hour window
  }
  return count <= 10; // Max 10 messages per hour
}
```

## Expected Results

Implementing these strategies could reduce LINE credit consumption by **60-80%** while maintaining user experience quality. Start with Phase 1 for immediate 20-30% savings, then progressively implement more sophisticated solutions.

## Tools & Resources

- **Redis**: Already integrated for caching and queuing
- **Node Schedule**: For batch processing jobs
- **LINE Flex Messages**: For rich, bundled content
- **Monitoring**: Use `/tracking-report` endpoint for analytics

## Next Steps

1. Review and prioritize strategies based on your usage patterns
2. Analyze peak webhook times using current tracking data
3. Implement Phase 1 quick wins
4. Monitor credit usage reduction
5. Progressively implement advanced features based on ROI