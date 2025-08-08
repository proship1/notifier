const formatMessage = (webhookData) => {
  const formatters = {
    default: (data) => {
      return JSON.stringify(data, null, 2);
    },
    
    order: (data) => {
      const message = data.message || data.text;
      const fullOrderId = data.eId || 'N/A';
      const orderId = fullOrderId !== 'N/A' ? fullOrderId.replace(/order-|user-/g, '').substring(0, 8) : 'N/A';
      const trackingNo = data.trackingNo || 'ไม่มี';
      
      // Get proper Thailand time
      const thailandTime = new Date().toLocaleString('th-TH', { 
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: 'numeric', 
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
      });
      
      let formattedMessage = `🚚 การแจ้งเตือนคำสั่งซื้อ\n` +
                            `📦 Order: ${orderId}\n` +
                            `📝 สถานะ: ${message}\n`;
      
      // Add tracking number if available
      if (trackingNo && trackingNo !== 'ไม่มี') {
        formattedMessage += `🏷️ Tracking: ${trackingNo}\n`;
      }
      
      // Add customer info if available (from ProShip API)
      if (data.customerName) {
        formattedMessage += `👤 ลูกค้า: ${data.customerName}\n`;
      }
      if (data.customerPhone) {
        formattedMessage += `📞 เบอร์โทร: ${data.customerPhone}\n`;
      }
      
      formattedMessage += `🕒 ${thailandTime}`;
      
      return formattedMessage;
    },
    
    github: (data) => {
      if (data.action && data.repository) {
        return `🔔 GitHub Event: ${data.action}\n` +
               `📦 Repository: ${data.repository.full_name}\n` +
               `👤 User: ${data.sender?.login || 'Unknown'}\n` +
               `📝 Details: ${data.pull_request?.title || data.issue?.title || 'N/A'}`;
      }
      return formatters.default(data);
    },
    
    stripe: (data) => {
      if (data.type && data.data) {
        return `💳 Stripe Event: ${data.type}\n` +
               `💰 Amount: ${data.data.object?.amount ? `$${(data.data.object.amount / 100).toFixed(2)}` : 'N/A'}\n` +
               `🆔 ID: ${data.data.object?.id || 'N/A'}`;
      }
      return formatters.default(data);
    },
    
    custom: (data, template) => {
      let message = template;
      const replaceTokens = (obj, prefix = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const token = prefix ? `${prefix}.${key}` : key;
          if (typeof value === 'object' && value !== null) {
            replaceTokens(value, token);
          } else {
            message = message.replace(new RegExp(`{{${token}}}`, 'g'), value || 'N/A');
          }
        }
      };
      replaceTokens(data);
      return message;
    }
  };
  
  // Handle nested JSON in text field or already processed data
  let processedData = webhookData;
  if (webhookData.text && typeof webhookData.text === 'string') {
    try {
      const parsedFromText = JSON.parse(webhookData.text);
      // Merge parsed data with any additional fields (like customerName, customerPhone)
      processedData = { ...parsedFromText, ...webhookData };
      // Remove the text field to avoid confusion
      delete processedData.text;
    } catch (e) {
      // If text is not JSON, keep original
    }
  }
  
  const template = process.env.MESSAGE_TEMPLATE;
  if (template) {
    return formatters.custom(processedData, template);
  }
  
  // Check for order notification
  if (processedData.eType === 'order' || processedData.trackingNo) {
    return formatters.order(processedData);
  }
  
  if (processedData.repository && processedData.action) {
    return formatters.github(processedData);
  }
  
  if (processedData.type && processedData.data) {
    return formatters.stripe(processedData);
  }
  
  return formatters.default(processedData);
};

module.exports = { formatMessage };