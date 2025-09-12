const express = require('express');
const { getRedisClient } = require('../utils/redisClient');
const logger = require('../utils/logger');

const router = express.Router();

// POST /clear-stats - Clear all tracking statistics
router.post('/', async (req, res) => {
  try {
    // Optional secret for security
    const secret = req.body.secret || req.query.secret;
    const expectedSecret = process.env.CLEAR_STATS_SECRET || 'clear-stats-2024';
    
    if (secret !== expectedSecret) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid secret provided' 
      });
    }
    
    const redis = getRedisClient();
    
    if (!redis) {
      return res.status(503).json({ 
        error: 'Redis not available',
        message: 'Cannot clear stats without Redis connection'
      });
    }
    
    logger.info('Clearing tracking statistics...');
    
    // Patterns to clear
    const patterns = [
      'tracking:*',           // Individual tracking numbers
      'tracking:stats:*',     // Daily statistics
      'tracking:duplicates:*' // Duplicate logs
    ];
    
    let totalDeleted = 0;
    const deletedKeys = {};
    
    for (const pattern of patterns) {
      let cursor = 0;
      let patternDeleted = 0;
      
      // Use SCAN to iterate through keys in batches
      do {
        const result = await redis.scan(cursor, {
          MATCH: pattern,
          COUNT: 100
        });
        
        cursor = result.cursor;
        const keys = result.keys;
        
        if (keys.length > 0) {
          // Delete keys in batches
          await redis.del(...keys);
          patternDeleted += keys.length;
          totalDeleted += keys.length;
        }
      } while (cursor !== 0);
      
      if (patternDeleted > 0) {
        deletedKeys[pattern] = patternDeleted;
        logger.info(`Deleted ${patternDeleted} keys matching pattern: ${pattern}`);
      }
    }
    
    logger.info(`Total keys deleted: ${totalDeleted}`);
    
    res.json({
      success: true,
      message: 'All tracking statistics cleared',
      totalDeleted,
      deletedByPattern: deletedKeys,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error clearing stats', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to clear stats',
      message: error.message 
    });
  }
});

// GET /clear-stats - Show what would be cleared
router.get('/', async (req, res) => {
  try {
    const redis = getRedisClient();
    
    if (!redis) {
      return res.status(503).json({ 
        error: 'Redis not available',
        message: 'Cannot check stats without Redis connection'
      });
    }
    
    const patterns = [
      'tracking:*',
      'tracking:stats:*',
      'tracking:duplicates:*'
    ];
    
    const keyCounts = {};
    let totalKeys = 0;
    
    for (const pattern of patterns) {
      const keys = await redis.keys(pattern);
      keyCounts[pattern] = keys.length;
      totalKeys += keys.length;
    }
    
    res.json({
      message: 'Current tracking data in Redis',
      totalKeys,
      keysByPattern: keyCounts,
      note: 'To clear, send POST request with secret parameter'
    });
    
  } catch (error) {
    logger.error('Error checking stats', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to check stats',
      message: error.message 
    });
  }
});

module.exports = router;