const formatMessage = (webhookData) => {
  const formatters = {
    default: (data) => {
      return JSON.stringify(data, null, 2);
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
  
  const template = process.env.MESSAGE_TEMPLATE;
  if (template) {
    return formatters.custom(webhookData, template);
  }
  
  if (webhookData.repository && webhookData.action) {
    return formatters.github(webhookData);
  }
  
  if (webhookData.type && webhookData.data) {
    return formatters.stripe(webhookData);
  }
  
  return formatters.default(webhookData);
};

module.exports = { formatMessage };