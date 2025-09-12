const express = require('express');
const { getRedisClient } = require('../utils/redisClient');
const logger = require('../utils/logger');

const router = express.Router();

// GET /redis-check - Check Redis for active groups
router.get('/', async (req, res) => {
  try {
    const redis = getRedisClient();
    const allGroups = new Set();
    const userMappings = {};
    const apiKeys = [];
    const allKeys = [];
    const keysByPattern = {};
    
    if (!redis) {
      return res.json({ 
        error: 'Redis not connected',
        totalGroups: 0 
      });
    }
    
    // First scan ALL keys to see what's in Redis
    let cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: '*',
        COUNT: 100
      });
      
      cursor = result.cursor;
      const keys = result.keys;
      allKeys.push(...keys);
      
      // Categorize keys by prefix
      for (const key of keys) {
        const prefix = key.split(':')[0];
        if (!keysByPattern[prefix]) {
          keysByPattern[prefix] = [];
        }
        keysByPattern[prefix].push(key);
      }
    } while (cursor !== 0);
    
    // Process user: keys
    cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: 'user:*',
        COUNT: 100
      });
      
      cursor = result.cursor;
      const keys = result.keys;
      
      for (const key of keys) {
        try {
          const groupId = await redis.get(key);
          if (groupId) {
            allGroups.add(groupId);
            const userId = key.replace('user:', '');
            if (!userMappings[groupId]) {
              userMappings[groupId] = [];
            }
            userMappings[groupId].push(userId);
          }
        } catch (e) {
          logger.warn(`Could not read key ${key}: ${e.message}`);
        }
      }
    } while (cursor !== 0);
    
    // Process group: keys (if they exist)
    cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: 'group:*',
        COUNT: 100
      });
      
      cursor = result.cursor;
      const keys = result.keys;
      
      for (const key of keys) {
        try {
          const groupData = await redis.get(key);
          const groupId = key.replace('group:', '');
          allGroups.add(groupId);
        } catch (e) {
          logger.warn(`Could not read key ${key}: ${e.message}`);
        }
      }
    } while (cursor !== 0);
    
    // Process setup: keys to find groups
    cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: 'setup:*',
        COUNT: 100
      });
      
      cursor = result.cursor;
      const keys = result.keys;
      
      for (const key of keys) {
        try {
          const setupData = await redis.get(key);
          if (setupData) {
            try {
              const parsed = JSON.parse(setupData);
              if (parsed.groupId) {
                allGroups.add(parsed.groupId);
              }
            } catch (e) {
              // Not JSON or can't parse
            }
          }
        } catch (e) {
          logger.warn(`Could not read key ${key}: ${e.message}`);
        }
      }
    } while (cursor !== 0);
    
    // Scan for API keys
    cursor = 0;
    do {
      const result = await redis.scan(cursor, {
        MATCH: 'apiKey:*',
        COUNT: 100
      });
      
      cursor = result.cursor;
      const keys = result.keys;
      
      for (const key of keys) {
        try {
          const apiData = await redis.get(key);
          if (apiData) {
            try {
              const parsed = JSON.parse(apiData);
              if (parsed.groupId) {
                allGroups.add(parsed.groupId);
                apiKeys.push({
                  key: key.replace('apiKey:', ''),
                  groupId: parsed.groupId
                });
              }
            } catch (e) {
              // Not JSON
            }
          }
        } catch (e) {
          logger.warn(`Could not read key ${key}: ${e.message}`);
        }
      }
    } while (cursor !== 0);
    
    // Add environment group if exists
    if (process.env.LINE_GROUP_ID && process.env.LINE_GROUP_ID !== 'your_line_group_id_here') {
      allGroups.add(process.env.LINE_GROUP_ID);
    }
    
    const groupDetails = [];
    for (const groupId of allGroups) {
      groupDetails.push({
        groupId,
        mappedUsers: userMappings[groupId] || [],
        mappedUserCount: (userMappings[groupId] || []).length
      });
    }
    
    res.json({
      success: true,
      totalGroups: allGroups.size,
      groups: groupDetails,
      apiKeys: apiKeys.length,
      totalKeys: allKeys.length,
      keyPatterns: Object.keys(keysByPattern).map(prefix => ({
        prefix,
        count: keysByPattern[prefix].length
      })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Error checking Redis', { error: error.message });
    res.status(500).json({ 
      error: 'Failed to check Redis',
      message: error.message 
    });
  }
});

module.exports = router;