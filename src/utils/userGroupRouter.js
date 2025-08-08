const fs = require('fs');
const path = require('path');
const logger = require('./logger');

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

const findGroupForUser = (userId) => {
  const mapping = loadUserGroupMapping();
  
  // Handle new structure with groups object
  const groups = mapping.groups || mapping;
  
  for (const [groupId, users] of Object.entries(groups)) {
    if (Array.isArray(users) && users.includes(userId)) {
      return groupId;
    }
  }
  
  return null;
};

const getUserApiKey = (userId) => {
  const mapping = loadUserGroupMapping();
  
  if (mapping.userApiKeys && mapping.userApiKeys[userId]) {
    return mapping.userApiKeys[userId];
  }
  
  return null;
};

const getGroupIdForUser = (userId, fallbackGroupId) => {
  const mappedGroupId = findGroupForUser(userId);
  
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