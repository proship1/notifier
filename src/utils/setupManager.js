const { v4: uuidv4 } = require('uuid');
const { getRedisClient, isRedisConnected } = require('./redisClient');
const logger = require('./logger');

const SETUP_EXPIRY = 30 * 60; // 30 minutes

const createSetupSession = async (groupId) => {
  if (!isRedisConnected()) {
    logger.warn('Redis not connected - setup sessions disabled');
    return null;
  }

  try {
    const redisClient = getRedisClient();
    const setupToken = uuidv4();
    const sessionKey = `setup:${groupId}`;
    
    const sessionData = {
      token: setupToken,
      groupId: groupId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + SETUP_EXPIRY * 1000).toISOString()
    };

    await redisClient.hSet(sessionKey, sessionData);
    await redisClient.expire(sessionKey, SETUP_EXPIRY);
    
    logger.info(`Setup session created for group ${groupId}`, { token: setupToken });
    return setupToken;
  } catch (error) {
    logger.error('Failed to create setup session', { error: error.message, groupId });
    return null;
  }
};

const getSetupSession = async (groupId) => {
  if (!isRedisConnected()) {
    return null;
  }

  try {
    const redisClient = getRedisClient();
    const sessionKey = `setup:${groupId}`;
    const sessionData = await redisClient.hGetAll(sessionKey);
    
    if (!sessionData || Object.keys(sessionData).length === 0) {
      return null;
    }

    return sessionData;
  } catch (error) {
    logger.error('Failed to get setup session', { error: error.message, groupId });
    return null;
  }
};

const validateSetupSession = async (groupId, token) => {
  const session = await getSetupSession(groupId);
  
  if (!session) {
    return { valid: false, reason: 'session_not_found' };
  }

  if (session.token !== token) {
    return { valid: false, reason: 'invalid_token' };
  }

  if (session.status !== 'pending') {
    return { valid: false, reason: 'session_already_used' };
  }

  const expiresAt = new Date(session.expiresAt);
  if (Date.now() > expiresAt.getTime()) {
    return { valid: false, reason: 'session_expired' };
  }

  return { valid: true, session };
};

const completeSetup = async (groupId, userId, apiKey) => {
  if (!isRedisConnected()) {
    logger.warn('Redis not connected - cannot complete setup');
    return false;
  }

  try {
    const redisClient = getRedisClient();
    
    // Save user data
    const userKey = `user:${userId}`;
    await redisClient.hSet(userKey, {
      groupId: groupId,
      apiKey: apiKey,
      setupAt: new Date().toISOString(),
      setupMethod: 'linebot'
    });

    // Mark setup session as completed
    const sessionKey = `setup:${groupId}`;
    await redisClient.hSet(sessionKey, 'status', 'completed');
    
    // Set user data to not expire, but clean up setup session after 1 hour
    await redisClient.expire(sessionKey, 3600);
    
    logger.info(`Setup completed for user ${userId} in group ${groupId}`);
    return true;
  } catch (error) {
    logger.error('Failed to complete setup', { error: error.message, groupId, userId });
    return false;
  }
};

const cleanupExpiredSessions = async () => {
  if (!isRedisConnected()) {
    return;
  }

  try {
    const redisClient = getRedisClient();
    const sessionKeys = await redisClient.keys('setup:*');
    let cleanedCount = 0;

    for (const key of sessionKeys) {
      const ttl = await redisClient.ttl(key);
      if (ttl === -1) {
        // No expiry set, check manually
        const sessionData = await redisClient.hGetAll(key);
        if (sessionData.expiresAt) {
          const expiresAt = new Date(sessionData.expiresAt);
          if (Date.now() > expiresAt.getTime()) {
            await redisClient.del(key);
            cleanedCount++;
          }
        }
      }
    }

    if (cleanedCount > 0) {
      logger.info(`Cleaned up ${cleanedCount} expired setup sessions`);
    }
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', { error: error.message });
  }
};

module.exports = {
  createSetupSession,
  getSetupSession,
  validateSetupSession,
  completeSetup,
  cleanupExpiredSessions
};