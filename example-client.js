const crypto = require('crypto');

// Your webhook configuration
const WEBHOOK_URL = 'https://webhook-line-notifier.fly.dev/webhook';
const WEBHOOK_SECRET = 'your-secret-key'; // Same as fly secrets WEBHOOK_SECRET

async function sendNotification(data) {
  const payload = JSON.stringify(data);
  
  // Generate HMAC SHA256 signature
  const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  const response = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-webhook-signature': signature
    },
    body: payload
  });
  
  return response.json();
}

// Example usage
sendNotification({
  event: 'Order Placed',
  orderId: '12345',
  amount: '$99.99',
  customer: 'John Doe'
}).then(result => {
  console.log('Notification sent:', result);
}).catch(error => {
  console.error('Error:', error);
});