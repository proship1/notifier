const crypto = require('crypto');
const logger = require('../utils/logger');

const validateWebhook = (req, res, next) => {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    return next();
  }
  
  const signature = req.headers['x-webhook-signature'] || 
                    req.headers['x-hub-signature-256'] || 
                    req.headers['x-signature'];
  
  if (!signature) {
    logger.warn('Webhook request missing signature');
    return res.status(401).json({ error: 'Missing signature' });
  }
  
  const payload = JSON.stringify(req.body);
  
  let isValid = false;
  
  if (req.headers['x-hub-signature-256']) {
    const expectedSignature = 'sha256=' + 
      crypto.createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');
    isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } else {
    const expectedSignature = crypto.createHmac('sha256', webhookSecret)
      .update(payload)
      .digest('hex');
    isValid = signature === expectedSignature;
  }
  
  if (!isValid) {
    logger.warn('Invalid webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }
  
  next();
};

module.exports = { validateWebhook };