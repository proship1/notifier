const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const { getRedisClient, isRedisConnected } = require('./redisClient');

const mappingFile = path.join(__dirname, '../data/userGroupMapping.json');

const loadUserGroupMapping = () => {
  try {
    const data = fs.readFileSync(mappingFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.warn('Could not load user group mapping file, using default group only');
    return {};
  }
};

const findGroupForUser = async (userId) => {
  // Try Redis first (for new users)
  if (isRedisConnected()) {
    try {
      const redisClient = getRedisClient();
      const groupId = await redisClient.hGet(`user:${userId}`, 'groupId');
      if (groupId) {
        logger.info(`User ${userId} found in Redis, group: ${groupId}`);
        return groupId;
      }
    } catch (error) {
      logger.warn('Redis lookup failed, falling back to JSON', { error: error.message });
    }
  }
  
  // Fallback to JSON file (for existing users)
  const mapping = loadUserGroupMapping();
  
  // Handle new structure with groups object
  const groups = mapping.groups || mapping;
  
  for (const [groupId, users] of Object.entries(groups)) {
    if (Array.isArray(users) && users.includes(userId)) {
      logger.info(`User ${userId} found in JSON file, group: ${groupId}`);
      return groupId;
    }
  }
  
  return null;
};

const getUserApiKey = async (userId) => {
  // Try Redis first (for new users)
  if (isRedisConnected()) {
    try {
      const redisClient = getRedisClient();
      const apiKey = await redisClient.hGet(`user:${userId}`, 'apiKey');
      if (apiKey) {
        logger.info(`API key for user ${userId} found in Redis`);
        return apiKey;
      }
    } catch (error) {
      logger.warn('Redis API key lookup failed, falling back to JSON', { error: error.message });
    }
  }
  
  // Fallback to JSON file (for existing users)
  const mapping = loadUserGroupMapping();
  
  if (mapping.userApiKeys && mapping.userApiKeys[userId]) {
    logger.info(`API key for user ${userId} found in JSON file`);
    return mapping.userApiKeys[userId];
  }
  
  return null;
};

const getGroupIdForUser = async (userId, fallbackGroupId) => {
  const mappedGroupId = await findGroupForUser(userId);
  
  if (mappedGroupId) {
    logger.info(`User ${userId} mapped to group ${mappedGroupId}`);
    return mappedGroupId;
  }
  
  logger.info(`User ${userId} not mapped - skipping message to save API calls`);
  return null; // Don't send to fallback, save API calls
};

module.exports = {
  getGroupIdForUser,
  getUserApiKey,
  loadUserGroupMapping,
  findGroupForUser
};