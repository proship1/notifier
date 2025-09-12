require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { Client } = require('@line/bot-sdk');
const logger = require('./utils/logger');
const { formatMessage } = require('./utils/messageFormatter');
const { validateWebhook } = require('./middleware/webhookValidator');
const { getGroupIdForUser } = require('./utils/userGroupRouter');
const { fetchOrderDetails } = require('./utils/proshipApi');
const { initializeRedis, getRedisClient } = require('./utils/redisClient');
const { cleanupExpiredSessions } = require('./utils/setupManager');
const trackingMonitor = require('./utils/trackingMonitor');
const batchManager = require('./utils/batchManager');

// Import new routes
const lineWebhookRouter = require('./routes/lineWebhook');
const setupFormRouter = require('./routes/setupForm');
const trackingReportRouter = require('./routes/trackingReport');
const clearStatsRouter = require('./routes/clearStats');
const groupsReportRouter = require('./routes/groupsReport');
const redisCheckRouter = require('./routes/redisCheck');
const batchStatusRouter = require('./routes/batchStatus');

const app = express();
const port = process.env.PORT || 3000;

// Set up EJS template engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const lineClient = new Client(lineConfig);

// Apply body parser to all routes EXCEPT LINE webhook (which needs raw body for signature)
app.use((req, res, next) => {
  if (req.path === '/line/webhook' && req.method === 'POST') {
    // Skip body parsing for LINE webhook
    next();
  } else {
    bodyParser.json()(req, res, next);
  }
});
app.use(bodyParser.urlencoded({ extended: true }));

// Add new routes
app.use('/line/webhook', lineWebhookRouter);
app.use('/setup', setupFormRouter);
app.use('/tracking-report', trackingReportRouter);
app.use('/clear-stats', clearStatsRouter);
app.use('/groups-report', groupsReportRouter);
app.use('/redis-check', redisCheckRouter);
app.use('/batch-status', batchStatusRouter);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// GET /find-group-id endpoint for LINE group ID finder
app.get('/find-group-id', (req, res) => {
  res.json({
    success: true,
    message: 'เพิ่มบอทนี้เข้ากลุ่ม LINE แล้วพิมพ์ "หา group id" เพื่อดู Group ID',
    instructions: [
      '1. เพิ่มบอทเข้ากลุ่ม LINE',
      '2. พิมพ์ "หา group id" ในกลุ่ม',
      '3. บอทจะแสดง Group ID ให้'
    ]
  });
});

app.post('/webhook', validateWebhook, async (req, res) => {
  try {
    logger.info('Webhook received', { body: req.body });
    
    // Parse webhook data
    let webhookData = req.body;
    let targetUserId = null;
    let orderId = null;
    let trackingNo = null;
    
    // Extract data from nested JSON if present
    if (req.body.text && typeof req.body.text === 'string') {
      try {
        const parsed = JSON.parse(req.body.text);
        webhookData = { ...webhookData, ...parsed };
        targetUserId = parsed.createdBy;
        orderId = parsed.eId;
        trackingNo = parsed.trackingNo;
      } catch (e) {
        // Not nested JSON, use direct values
      }
    }
    
    // Get direct values if not from nested JSON
    if (!targetUserId) {
      targetUserId = req.body.createdBy;
    }
    if (!orderId) {
      orderId = req.body.eId;
    }
    if (!trackingNo) {
      trackingNo = req.body.trackingNo;
    }

    // Monitor tracking number for statistics only (not blocking)
    // Commented out 24-hour blocking - using 1-hour order ID deduplication only
    if (trackingNo && orderId && targetUserId) {
      try {
        const monitorResult = await trackingMonitor.recordTracking(trackingNo, orderId, targetUserId);
        
        logger.info('Tracking monitoring result', {
          trackingNo,
          orderId,
          isDuplicate: monitorResult.isDuplicate,
          occurrenceCount: monitorResult.occurrenceCount,
          timeSinceFirst: monitorResult.timeSinceFirst
        });
        
        // 24-hour blocking disabled - relying on 1-hour order ID deduplication
        // if (monitorResult.isDuplicate) {
        //   logger.warn('BLOCKING DUPLICATE TRACKING NUMBER', {
        //     trackingNo,
        //     orderId,
        //     occurrenceCount: monitorResult.occurrenceCount,
        //     timeSinceFirst: `${(monitorResult.timeSinceFirst / 1000 / 60).toFixed(2)} minutes`
        //   });
        //   
        //   return res.status(200).json({ 
        //     success: true, 
        //     message: 'Duplicate tracking number blocked - LINE message skipped',
        //     trackingNo,
        //     orderId,
        //     isDuplicate: true,
        //     occurrenceCount: monitorResult.occurrenceCount,
        //     timeSinceFirstMinutes: (monitorResult.timeSinceFirst / 1000 / 60).toFixed(2)
        //   });
        // }
      } catch (error) {
        // Monitoring errors should not affect webhook processing
        logger.warn('Tracking monitoring failed, continuing with webhook processing', {
          error: error.message,
          trackingNo,
          orderId
        });
      }
    }
    
    // Route to appropriate group - only send if user is mapped
    const groupId = await getGroupIdForUser(targetUserId, null);
    
    if (!groupId) {
      logger.info('User not mapped - skipping LINE message to save API calls');
      return res.status(200).json({ 
        success: true, 
        message: 'User not mapped - message skipped to save API calls',
        userId: targetUserId 
      });
    }
    
    // Fetch customer details from ProShip API if order ID exists
    if (orderId && targetUserId) {
      logger.info(`Fetching ProShip details for order ${orderId}`);
      const orderDetails = await fetchOrderDetails(orderId, targetUserId);
      
      if (orderDetails) {
        // Add customer info to webhook data
        webhookData.customerName = orderDetails.customerName;
        webhookData.customerPhone = orderDetails.customerPhone;
        logger.info('Customer info added to message');
      }
    }
    
    // Format message with customer info
    const formattedMessage = formatMessage(webhookData);
    
    const message = {
      type: 'text',
      text: formattedMessage
    };
    
    // Check for duplicate order ID to prevent duplicate LINE messages
    if (orderId) {
      try {
        const redis = getRedisClient();
        if (redis) {
          const dedupKey = `dedup:order:${orderId}`;
          const existing = await redis.get(dedupKey);
          
          if (existing) {
            logger.info('Duplicate order detected - skipping LINE message', {
              orderId,
              trackingNo,
              firstSent: JSON.parse(existing).timestamp
            });
            return res.status(200).json({ 
              success: true, 
              message: 'Duplicate order - LINE message skipped',
              orderId,
              deduplicated: true
            });
          }
          
          // Cache order ID for 12 hours (43200 seconds)
          await redis.setEx(dedupKey, 43200, JSON.stringify({
            orderId,
            timestamp: new Date().toISOString(),
            trackingNo
          }));
        }
      } catch (dedupError) {
        // Don't fail webhook processing if deduplication fails
        logger.warn('Order deduplication check failed, continuing with LINE message', {
          error: dedupError.message,
          orderId
        });
      }
    }
    
    // BULLETPROOF BATCHING: Try batch, fallback to immediate on ANY error
    const originalSendFunction = async () => {
      await lineClient.pushMessage(groupId, message);
      logger.info('Message sent to LINE group successfully');
      return { success: true, immediate: true };
    };

    const result = await batchManager.processWebhook(webhookData, groupId, originalSendFunction);
    
    if (result.batched) {
      logger.info('Message added to batch successfully', { groupId, trackingNo });
      res.status(200).json({ success: true, message: 'Notification batched', batched: true });
    } else {
      res.status(200).json({ success: true, message: 'Notification sent', batched: false });
    }
  } catch (error) {
    logger.error('Error processing webhook', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

// Initialize Redis and start server
const startServer = async () => {
  try {
    // Initialize Redis connection
    await initializeRedis();
    logger.info('Redis initialization completed');
    
    // Schedule periodic cleanup of expired setup sessions (every hour)
    setInterval(async () => {
      try {
        await cleanupExpiredSessions();
      } catch (error) {
        logger.error('Setup sessions cleanup failed', { error: error.message });
      }
    }, 60 * 60 * 1000); // 1 hour
    
    // Start HTTP server
    app.listen(port, () => {
      logger.info(`Webhook notifier service running on port ${port}`);
      logger.info('LINE Bot setup system ready');
      logger.info(`Setup forms available at: ${process.env.BASE_URL || 'http://localhost:' + port}/setup/GROUP_ID`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: error.message });
    process.exit(1);
  }
};

startServer();