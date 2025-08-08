require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@line/bot-sdk');
const logger = require('./utils/logger');
const { formatMessage } = require('./utils/messageFormatter');
const { validateWebhook } = require('./middleware/webhookValidator');
const { getGroupIdForUser } = require('./utils/userGroupRouter');
const { fetchOrderDetails } = require('./utils/proshipApi');

const app = express();
const port = process.env.PORT || 3000;

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const lineClient = new Client(lineConfig);

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/webhook', validateWebhook, async (req, res) => {
  try {
    logger.info('Webhook received', { body: req.body });
    
    // Parse webhook data
    let webhookData = req.body;
    let targetUserId = null;
    let orderId = null;
    
    // Extract data from nested JSON if present
    if (req.body.text && typeof req.body.text === 'string') {
      try {
        const parsed = JSON.parse(req.body.text);
        webhookData = { ...webhookData, ...parsed };
        targetUserId = parsed.createdBy;
        orderId = parsed.eId;
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
    
    // Route to appropriate group - only send if user is mapped
    const groupId = getGroupIdForUser(targetUserId, null);
    
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
    
    await lineClient.pushMessage(groupId, message);
    
    logger.info('Message sent to LINE group successfully');
    res.status(200).json({ success: true, message: 'Notification sent' });
  } catch (error) {
    logger.error('Error processing webhook', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  logger.info(`Webhook notifier service running on port ${port}`);
});