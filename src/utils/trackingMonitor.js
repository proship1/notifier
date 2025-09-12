const { getRedisClient } = require('./redisClient');
const logger = require('./logger');

class TrackingMonitor {
  constructor() {
    this.TRACKING_KEY_PREFIX = 'tracking:';
    this.DAILY_STATS_KEY = 'tracking:stats:';
    this.DUPLICATE_LOG_KEY = 'tracking:duplicates:';
    this.WINDOW_SECONDS = 86400; // 24 hours window for tracking
  }

  /**
   * Record a tracking number occurrence
   * @param {string} trackingNo - The tracking number
   * @param {string} orderId - The order ID
   * @param {string} userId - The user ID
   * @returns {object} - { isDuplicate, occurrenceCount, firstSeen }
   */
  async recordTracking(trackingNo, orderId, userId) {
    // Validate input parameters
    if (!trackingNo || !orderId || !userId) {
      logger.warn('Invalid tracking parameters', { trackingNo, orderId, userId });
      return { isDuplicate: false, occurrenceCount: 1 };
    }

    const redis = getRedisClient();
    if (!redis) {
      logger.warn('Redis not available for tracking monitor');
      return { isDuplicate: false, occurrenceCount: 1 };
    }

    try {
      const now = Date.now();
      const today = new Date().toISOString().split('T')[0];
      
      // Key for this tracking number
      const trackingKey = `${this.TRACKING_KEY_PREFIX}${trackingNo}`;
      const statsKey = `${this.DAILY_STATS_KEY}${today}`;
      
      // Check if tracking number exists
      const existingData = await redis.get(trackingKey);
      
      let trackingData;
      let isDuplicate = false;
      
      if (existingData) {
        // Tracking number seen before
        trackingData = JSON.parse(existingData);
        trackingData.occurrences.push({
          orderId,
          userId,
          timestamp: now
        });
        isDuplicate = true;
        
        // Log duplicate
        const duplicateKey = `${this.DUPLICATE_LOG_KEY}${today}`;
        await redis.rPush(duplicateKey, JSON.stringify({
          trackingNo,
          orderId,
          userId,
          timestamp: now,
          occurrenceNumber: trackingData.occurrences.length
        }));
        await redis.expire(duplicateKey, 7 * 86400); // Keep duplicate logs for 7 days
        
        logger.warn('DUPLICATE TRACKING NUMBER DETECTED', {
          trackingNo,
          occurrences: trackingData.occurrences.length,
          orderId,
          userId,
          timeSinceFirst: now - trackingData.firstSeen
        });
      } else {
        // First time seeing this tracking number
        trackingData = {
          trackingNo,
          firstSeen: now,
          occurrences: [{
            orderId,
            userId,
            timestamp: now
          }]
        };
      }
      
      // Save tracking data with expiry
      await redis.setEx(trackingKey, this.WINDOW_SECONDS, JSON.stringify(trackingData));
      
      // Update daily statistics
      await redis.hIncrBy(statsKey, 'total', 1);
      if (isDuplicate) {
        await redis.hIncrBy(statsKey, 'duplicates', 1);
      } else {
        await redis.hIncrBy(statsKey, 'unique', 1);
      }
      await redis.expire(statsKey, 30 * 86400); // Keep stats for 30 days
      
      return {
        isDuplicate,
        occurrenceCount: trackingData.occurrences.length,
        firstSeen: trackingData.firstSeen,
        timeSinceFirst: now - trackingData.firstSeen
      };
      
    } catch (error) {
      logger.error('Error in tracking monitor', { error: error.message });
      return { isDuplicate: false, occurrenceCount: 1 };
    }
  }

  /**
   * Get statistics for a specific date
   * @param {string} date - Date in YYYY-MM-DD format (optional, defaults to today)
   */
  async getStats(date = null) {
    const redis = getRedisClient();
    if (!redis) {
      return null;
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const statsKey = `${this.DAILY_STATS_KEY}${targetDate}`;
    
    try {
      const stats = await redis.hGetAll(statsKey);
      
      if (!stats || Object.keys(stats).length === 0) {
        return {
          date: targetDate,
          total: 0,
          unique: 0,
          duplicates: 0,
          duplicationRate: 0
        };
      }
      
      const total = parseInt(stats.total || 0);
      const unique = parseInt(stats.unique || 0);
      const duplicates = parseInt(stats.duplicates || 0);
      
      return {
        date: targetDate,
        total,
        unique,
        duplicates,
        duplicationRate: total > 0 ? ((duplicates / total) * 100).toFixed(2) : 0
      };
      
    } catch (error) {
      logger.error('Error getting stats', { error: error.message });
      return null;
    }
  }

  /**
   * Get list of duplicate tracking numbers for a date
   * @param {string} date - Date in YYYY-MM-DD format (optional)
   */
  async getDuplicates(date = null) {
    const redis = getRedisClient();
    if (!redis) {
      return [];
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    const duplicateKey = `${this.DUPLICATE_LOG_KEY}${targetDate}`;
    
    try {
      const duplicates = await redis.lRange(duplicateKey, 0, -1);
      return duplicates.map(d => JSON.parse(d));
    } catch (error) {
      logger.error('Error getting duplicates', { error: error.message });
      return [];
    }
  }

  /**
   * Get detailed report for monitoring
   */
  async getDetailedReport(date = null) {
    const stats = await this.getStats(date);
    const duplicates = await this.getDuplicates(date);
    
    // Group duplicates by tracking number
    const duplicatesByTracking = {};
    duplicates.forEach(dup => {
      if (!duplicatesByTracking[dup.trackingNo]) {
        duplicatesByTracking[dup.trackingNo] = [];
      }
      duplicatesByTracking[dup.trackingNo].push(dup);
    });
    
    return {
      stats,
      duplicateDetails: duplicatesByTracking,
      duplicateCount: Object.keys(duplicatesByTracking).length,
      topDuplicates: Object.entries(duplicatesByTracking)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 10)
        .map(([trackingNo, occurrences]) => ({
          trackingNo,
          count: occurrences.length,
          orders: [...new Set(occurrences.map(o => o.orderId))],
          users: [...new Set(occurrences.map(o => o.userId))]
        }))
    };
  }
}

module.exports = new TrackingMonitor();