const https = require('https');
const logger = require('./logger');
const { getUserApiKey } = require('./userGroupRouter');

const fetchOrderDetails = async (orderId, userId) => {
  try {
    // Get user's API key
    const apiKey = getUserApiKey(userId);
    
    if (!apiKey) {
      logger.warn(`No API key found for user ${userId}`);
      return null;
    }
    
    logger.info(`Fetching ProShip order details for ${orderId}`);
    
    const orderData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.proship.me',
        path: `/orders/v1/orders/${orderId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      };
      
      https.get(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode !== 200) {
            logger.error(`ProShip API error: ${res.statusCode}`, { response: data });
            resolve(null);
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            logger.error('Failed to parse ProShip response', { error: e.message });
            resolve(null);
          }
        });
      }).on('error', (error) => {
        logger.error('ProShip API request failed', { error: error.message });
        resolve(null);
      });
    });
    
    if (orderData && orderData.details?.customer) {
      const customer = orderData.details.customer;
      
      // Extract customer info
      const customerName = customer.name || 'ไม่ระบุชื่อ';
      const customerPhone = customer.phoneNo || 'ไม่ระบุเบอร์';
      
      logger.info(`Customer info retrieved: ${customerName} - ${customerPhone}`);
      
      return {
        customerName,
        customerPhone,
        trackingNo: orderData.trackingNo || orderData.details?.trackingNo
      };
    }
    
    return null;
  } catch (error) {
    logger.error('Error fetching ProShip order', { error: error.message });
    return null;
  }
};

module.exports = {
  fetchOrderDetails
};