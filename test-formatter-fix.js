const { formatMessage } = require('./src/utils/messageFormatter');

console.log('Testing formatter with customer data...\n');

// Simulate webhook data after processing (with customer info added)
const webhookDataWithCustomer = {
  text: '{"message":"ทดสอบระบบ ProShip API Integration","eType":"order","eId":"order-90bd5760-7349-11f0-9ce5-a5f5bce0b7501754542024662","createdBy":"user-e8d394b0-bafb-11eb-ac73-d5dec46ffb141621687667067","trackingNo":"JN497383275TH"}',
  message: 'ทดสอบระบบ ProShip API Integration',
  eType: 'order',
  eId: 'order-90bd5760-7349-11f0-9ce5-a5f5bce0b7501754542024662',
  createdBy: 'user-e8d394b0-bafb-11eb-ac73-d5dec46ffb141621687667067',
  trackingNo: 'JN497383275TH',
  customerName: 'นายมาลัย คงมั่น TEST',
  customerPhone: '0642654XXX'
};

console.log('=== Current formatter result ===');
const result = formatMessage(webhookDataWithCustomer);
console.log(result);

console.log('\n=== Expected result ===');
console.log(`🚚 การแจ้งเตือนคำสั่งซื้อ
📦 Order: 90bd5760
📝 สถานะ: ทดสอบระบบ ProShip API Integration
🏷️ Tracking: JN497383275TH
👤 ลูกค้า: นายมาลัย คงมั่น TEST
📞 เบอร์โทร: 0642654XXX
🕒 [time]`);

console.log('\n=== Test without text field (direct data) ===');
const directData = {
  message: 'ทดสอบระบบ ProShip API Integration',
  eType: 'order',
  eId: 'order-90bd5760-7349-11f0-9ce5-a5f5bce0b7501754542024662',
  trackingNo: 'JN497383275TH',
  customerName: 'นายมาลัย คงมั่น TEST',
  customerPhone: '0642654XXX'
};

const directResult = formatMessage(directData);
console.log(directResult);