const { formatMessage } = require('./src/utils/messageFormatter');

// Test your actual data
const testData = {
  "text": "{\"message\":\"ติดปัญหาการจัดส่งผู้รับไม่รับสาย\",\"eType\":\"order\",\"eId\":\"order-4805bc50-6de1-11f0-a02e-4f4cc6f3beac1753947479189\",\"createdBy\":\"user-88268000-5fb1-11f0-ae31-359a2b1a70581752387654656\",\"read\":0,\"id\":\"dea93d9d205f1427828e082d5354b3ba\",\"trackingNo\":\"TH43017JGAT66A\"}"
};

// Test without tracking number
const testDataNoTracking = {
  "text": "{\"message\":\"รอการจัดส่ง\",\"eType\":\"order\",\"eId\":\"order-1234567890-test\",\"createdBy\":\"user-test\"}"
};

console.log('=== NEW FORMAT WITH TRACKING & LINKS ===');
console.log(formatMessage(testData));
console.log('\n=== NEW FORMAT WITHOUT TRACKING ===');
console.log(formatMessage(testDataNoTracking));
console.log('\n=== OLD FORMAT ===');
console.log(JSON.stringify(testData, null, 2));