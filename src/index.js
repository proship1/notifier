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

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, () => {
  logger.info(`Webhook notifier service running on port ${port}`);
});