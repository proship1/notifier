const { createClient } = require('redis');
const logger = require('./logger');

let redisClient = null;

const initializeRedis = async () => {
  logger.info('Starting Redis initialization...');
  try {
    // Fly.io automatically sets REDIS_URL environment variable
    const redisUrl = process.env.REDIS_URL;
    
    logger.info(`Redis URL check: ${redisUrl ? 'Found' : 'Not found'}`);
    
    if (!redisUrl) {
      logger.warn('No REDIS_URL found - Redis features disabled');
      return null;
    }

    logger.info('Creating Redis client...');
    redisClient = createClient({
      url: redisUrl
    });

    redisClient.on('error', (err) => {
      logger.error('Redis client error', { error: err.message });
    });

    redisClient.on('connect', () => {
      logger.info('Connected to Redis successfully');
    });

    logger.info('Attempting to connect to Redis...');
    await redisClient.connect();
    logger.info('Redis connection established');
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis', { error: error.message });
    return null;
  }
};

const getRedisClient = () => {
  return redisClient;
};

const isRedisConnected = () => {
  return redisClient && redisClient.isReady;
};

module.exports = {
  initializeRedis,
  getRedisClient,
  isRedisConnected
};