require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Client } = require('@line/bot-sdk');
const logger = require('./utils/logger');
const { formatMessage } = require('./utils/messageFormatter');
const { validateWebhook } = require('./middleware/webhookValidator');

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
    
    // Helper: Log LINE events to find group ID
    if (req.body.events && req.body.events.length > 0) {
      req.body.events.forEach(event => {
        if (event.source && event.source.groupId) {
          logger.info(`📍 LINE Group ID Found: ${event.source.groupId}`);
        }
        if (event.source && event.source.roomId) {
          logger.info(`📍 LINE Room ID Found: ${event.source.roomId}`);
        }
      });
      return res.status(200).json({ success: true });
    }
    
    const formattedMessage = formatMessage(req.body);
    
    const message = {
      type: 'text',
      text: formattedMessage
    };
    
    const groupId = process.env.LINE_GROUP_ID;
    
    if (!groupId) {
      throw new Error('LINE_GROUP_ID not configured');
    }
    
    await lineClient.pushMessage(groupId, message);
    
    logger.info('Message sent to LINE group successfully');
    res.status(200).json({ success: true, message: 'Notification sent' });
  } catch (error) {
    logger.error('Error processing webhook', { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
});

// LINE webhook endpoint (for receiving LINE events)
app.post('/line/webhook', async (req, res) => {
  try {
    const events = req.body.events || [];
    
    for (const event of events) {
      if (event.source) {
        const sourceInfo = {
          type: event.source.type,
          userId: event.source.userId,
          groupId: event.source.groupId,
          roomId: event.source.roomId
        };
        
        logger.info('LINE Event Source Info:', sourceInfo);
        
        // Auto-reply with the IDs
        if (event.type === 'message' && event.replyToken) {
          let replyText = '📍 Source IDs:\n';
          if (event.source.groupId) {
            replyText += `Group ID: ${event.source.groupId}\n`;
          }
          if (event.source.roomId) {
            replyText += `Room ID: ${event.source.roomId}\n`;
          }
          if (event.source.userId) {
            replyText += `User ID: ${event.source.userId}`;
          }
          
          await lineClient.replyMessage(event.replyToken, {
            type: 'text',
            text: replyText
          });
        }
      }
    }
    
    res.status(200).json({ success: true });
  } catch (error) {
    logger.error('Error processing LINE webhook', { error: error.message });
    res.status(200).json({ success: true }); // Return 200 to prevent LINE retries
  }
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  logger.info(`Webhook notifier service running on port ${port}`);
});