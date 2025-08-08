// Simulate the complete flow from webhook to LINE with ProShip API

const { formatMessage } = require('./src/utils/messageFormatter');
const { getUserApiKey } = require('./src/utils/userGroupRouter');

// Simulate webhook payload
const webhookPayload = {
  "text": "{\"message\":\"ติดปัญหาการจัดส่งผู้รับไม่รับสาย\",\"eType\":\"order\",\"eId\":\"order-4805bc50-6de1-11f0-a02e-4f4cc6f3beac1753947479189\",\"createdBy\":\"user-e8d394b0-bafb-11eb-ac73-d5dec46ffb141621687667067\",\"trackingNo\":\"TH43017JGAT66A\"}"
};

// Parse the nested JSON
const parsedData = JSON.parse(webhookPayload.text);

console.log('📥 Webhook received:\n');
console.log('Order ID:', parsedData.eId);
console.log('User ID:', parsedData.createdBy);
console.log('Tracking:', parsedData.trackingNo);
console.log('Message:', parsedData.message);

// Get user's API key
const apiKey = getUserApiKey(parsedData.createdBy);
console.log('\n🔑 API Key found:', apiKey ? 'Yes' : 'No');

// Simulate ProShip API response (what it would return)
const mockProShipResponse = {
  "id": parsedData.eId,
  "createdBy": parsedData.createdBy,
  "trackingNo": parsedData.trackingNo,
  "status": 1,
  "details": {
    "customer": {
      "name": "คุณสมชาย ใจดี",
      "phoneNo": "0891234567",
      "address": {
        "province": "กรุงเทพมหานคร",
        "district": "บางรัก"
      }
    }
  }
};

console.log('\n📦 ProShip API would return customer info:');
console.log('- Name:', mockProShipResponse.details.customer.name);
console.log('- Phone:', mockProShipResponse.details.customer.phoneNo);

// Create enhanced message with customer info
const enhancedData = {
  ...parsedData,
  customerName: mockProShipResponse.details.customer.name,
  customerPhone: mockProShipResponse.details.customer.phoneNo
};

// Format for LINE (current format)
console.log('\n📱 Current LINE message (without customer info):');
console.log('-------------------------------------------');
console.log(formatMessage(webhookPayload));

// Show enhanced format
console.log('\n📱 Enhanced LINE message (with customer info):');
console.log('-------------------------------------------');

const thailandTime = new Date().toLocaleString('th-TH', { 
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: 'numeric', 
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric'
});

const enhancedMessage = `🚚 การแจ้งเตือนคำสั่งซื้อ
📦 Order: ${parsedData.eId.replace(/order-/g, '').substring(0, 8)}
📝 สถานะ: ${parsedData.message}
🏷️ Tracking: ${parsedData.trackingNo}
👤 ลูกค้า: ${enhancedData.customerName}
📞 เบอร์โทร: ${enhancedData.customerPhone}
🕒 ${thailandTime}`;

console.log(enhancedMessage);
console.log('-------------------------------------------');

console.log('\n✅ Benefits:');
console.log('- Customer can be contacted directly');
console.log('- Better tracking of who ordered what');
console.log('- More complete information in LINE');