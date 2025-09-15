const { getRedisClient } = require('./redisClient');
const logger = require('./logger');

class BatchManager {
  constructor() {
    this.enabled = process.env.ENABLE_BATCHING === 'true';
    this.batchInterval = parseInt(process.env.BATCH_INTERVAL_MS || '900000'); // 15 minutes
    this.batchSize = parseInt(process.env.BATCH_SIZE || '10'); // 10 messages
    this.timers = new Map(); // Group timers
    this.stats = {
      batchesSent: 0,
      messagesBatched: 0,
      fallbacksSent: 0,
      errors: 0
    };
  }

  /**
   * BULLETPROOF: Process webhook safely - ANY error = immediate send
   */
  async processWebhook(webhookData, groupId, originalSendFunction) {
    // SAFETY: If batching disabled, send immediately
    if (!this.enabled) {
      logger.debug('Batching disabled, sending immediately');
      return await originalSendFunction();
    }

    try {
      // Try to add to batch
      const result = await this.addToBatch(webhookData, groupId, originalSendFunction);
      if (result.shouldSendNow) {
        return await originalSendFunction();
      }
      return { success: true, batched: true };
    } catch (error) {
      // ANY ERROR = IMMEDIATE SEND (BULLETPROOF FALLBACK)
      logger.error('Batch processing failed, sending immediately', {
        error: error.message,
        groupId,
        trackingNo: webhookData.trackingNo
      });
      this.stats.fallbacksSent++;
      return await originalSendFunction();
    }
  }

  /**
   * Add webhook to batch queue
   */
  async addToBatch(webhookData, groupId, originalSendFunction) {
    const redis = getRedisClient();
    if (!redis) {
      logger.warn('Redis unavailable, sending immediately');
      return { shouldSendNow: true };
    }

    const batchKey = `batch:${groupId}`;
    const timerKey = `timer:${groupId}`;

    // Add to batch
    const batchData = {
      webhookData,
      timestamp: Date.now(),
      originalSendFunction: originalSendFunction.toString() // For recovery if needed
    };

    await redis.rPush(batchKey, JSON.stringify(batchData));
    const batchCount = await redis.lLen(batchKey);

    logger.debug(`Added to batch ${batchKey}`, { 
      batchCount, 
      trackingNo: webhookData.trackingNo 
    });

    // Start timer if this is first message
    if (batchCount === 1) {
      this.startBatchTimer(groupId, batchKey);
    }

    // Check if batch is full (10 messages)
    if (batchCount >= this.batchSize) {
      logger.info(`Batch full (${batchCount}), processing immediately`, { groupId });
      this.clearBatchTimer(groupId);
      setImmediate(() => this.processBatch(batchKey, groupId));
    }

    return { shouldSendNow: false };
  }

  /**
   * Start 15-minute timer for batch
   */
  startBatchTimer(groupId, batchKey) {
    // Clear existing timer
    this.clearBatchTimer(groupId);

    const timer = setTimeout(() => {
      logger.info(`Batch timer expired (15 min), processing batch`, { groupId });
      this.processBatch(batchKey, groupId);
    }, this.batchInterval);

    this.timers.set(groupId, timer);
    logger.debug(`Started batch timer for group ${groupId}`);
  }

  /**
   * Clear batch timer
   */
  clearBatchTimer(groupId) {
    const timer = this.timers.get(groupId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(groupId);
    }
  }

  /**
   * Process and send batch
   */
  async processBatch(batchKey, groupId) {
    try {
      const redis = getRedisClient();
      if (!redis) {
        logger.error('Redis unavailable during batch processing', { groupId });
        return;
      }

      // Get all messages from batch
      const messages = await redis.lRange(batchKey, 0, -1);
      if (messages.length === 0) {
        logger.debug('Empty batch, skipping', { groupId });
        return;
      }

      // Clear the batch first (prevent duplicate processing)
      await redis.del(batchKey);
      this.clearBatchTimer(groupId);

      // Parse messages
      const webhookDataArray = messages.map(msg => {
        try {
          return JSON.parse(msg).webhookData;
        } catch (e) {
          logger.error('Failed to parse batched message', { msg, error: e.message });
          return null;
        }
      }).filter(Boolean);

      if (webhookDataArray.length === 0) {
        logger.error('No valid messages in batch', { groupId, messageCount: messages.length });
        return;
      }

      // Format batch message
      const batchMessage = this.formatBatchMessage(webhookDataArray);
      
      // Send batch
      const { Client } = require('@line/bot-sdk');
      const lineClient = new Client({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
        channelSecret: process.env.LINE_CHANNEL_SECRET
      });

      const message = {
        type: 'text',
        text: batchMessage
      };

      await lineClient.pushMessage(groupId, message);

      // Update stats
      this.stats.batchesSent++;
      this.stats.messagesBatched += webhookDataArray.length;

      logger.info('Batch sent successfully', {
        groupId,
        messageCount: webhookDataArray.length,
        batchSize: batchMessage.length
      });

    } catch (error) {
      this.stats.errors++;
      logger.error('Failed to process batch', {
        error: error.message,
        groupId,
        batchKey
      });
      
      // TODO: Could implement retry logic here if needed
    }
  }

  /**
   * Format multiple webhooks into single batch message
   */
  formatBatchMessage(webhookDataArray) {
    const count = webhookDataArray.length;
    const now = new Date();
    const startTime = new Date(Math.min(...webhookDataArray.map(w => new Date(w.timestamp || now))));
    
    const formatTime = (date) => date.toLocaleTimeString('th-TH', {
      timeZone: 'Asia/Bangkok',
      hour: '2-digit',
      minute: '2-digit'
    });

    const formatDateTime = (date) => date.toLocaleString('th-TH', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    });

    let batchMessage = `📊 แจ้งเตือน ${count} รายการ [${formatTime(startTime)}-${formatTime(now)}]\n`;
    batchMessage += `━━━━━━━━━━━━━━━━━━\n\n`;

    webhookDataArray.forEach((data, index) => {
      const number = `${index + 1}️⃣`;
      const status = data.message || data.text || 'ไม่ระบุสถานะ';
      const trackingNo = data.trackingNo || 'ไม่มี';
      const customerName = data.customerName || 'ไม่ระบุ';
      const customerPhone = data.customerPhone || 'ไม่ระบุ';

      batchMessage += `${number} สถานะ: ${status}\n`;
      batchMessage += `🏷️ Tracking: ${trackingNo}\n`;
      batchMessage += `👤 ลูกค้า: ${customerName}\n`;
      batchMessage += `📞 เบอร์โทร: ${customerPhone}\n`;
      
      if (index < webhookDataArray.length - 1) {
        batchMessage += `\n`;
      }
    });

    batchMessage += `\n━━━━━━━━━━━━━━━━━━\n`;
    batchMessage += `🕒 ${formatDateTime(now)}`;

    return batchMessage;
  }

  /**
   * Emergency: Flush all pending batches
   */
  async flushAllBatches() {
    try {
      const redis = getRedisClient();
      if (!redis) return { error: 'Redis unavailable' };

      const batchKeys = await redis.keys('batch:*');
      let flushedCount = 0;

      for (const batchKey of batchKeys) {
        const groupId = batchKey.replace('batch:', '');
        await this.processBatch(batchKey, groupId);
        flushedCount++;
      }

      return { success: true, batchesFlushed: flushedCount };
    } catch (error) {
      logger.error('Failed to flush all batches', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Get current batch status
   */
  async getBatchStatus() {
    try {
      const redis = getRedisClient();
      if (!redis) return { error: 'Redis unavailable' };

      const batchKeys = await redis.keys('batch:*');
      const status = {
        batches: [],
        stats: this.stats,
        config: {
          enabled: this.enabled,
          batchSize: this.batchSize,
          batchInterval: this.batchInterval
        }
      };

      for (const batchKey of batchKeys) {
        const groupId = batchKey.replace('batch:', '');
        const count = await redis.lLen(batchKey);
        const hasTimer = this.timers.has(groupId);

        status.batches.push({
          groupId,
          messageCount: count,
          hasTimer,
          batchKey
        });
      }

      return status;
    } catch (error) {
      logger.error('Failed to get batch status', { error: error.message });
      return { error: error.message };
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return { ...this.stats };
  }
}

// Singleton instance
const batchManager = new BatchManager();

module.exports = batchManager;