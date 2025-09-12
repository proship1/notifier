const axios = require('axios');

// Test configuration
const WEBHOOK_URL = 'http://localhost:3000/webhook';
const TEST_TRACKING_NO = `TEST${Date.now()}`;
const TEST_ORDER_ID = `order-test-${Date.now()}`;
const TEST_USER_ID = 'user-test-duplicate-blocking';

async function testDuplicateBlocking() {
  console.log('🧪 Testing Duplicate Tracking Number Blocking\n');
  console.log(`Test Tracking No: ${TEST_TRACKING_NO}`);
  console.log(`Test Order ID: ${TEST_ORDER_ID}`);
  console.log(`Test User ID: ${TEST_USER_ID}\n`);
  
  // First webhook call - should be accepted
  console.log('📤 Sending first webhook (should be accepted)...');
  try {
    const response1 = await axios.post(WEBHOOK_URL, {
      text: JSON.stringify({
        trackingNo: TEST_TRACKING_NO,
        eId: TEST_ORDER_ID,
        createdBy: TEST_USER_ID,
        status: 'shipped'
      })
    });
    
    console.log('✅ First webhook response:', response1.data);
    console.log('');
  } catch (error) {
    console.error('❌ First webhook failed:', error.response?.data || error.message);
    return;
  }
  
  // Wait 2 seconds
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Second webhook call with same tracking number - should be blocked
  console.log('📤 Sending duplicate webhook (should be blocked)...');
  try {
    const response2 = await axios.post(WEBHOOK_URL, {
      text: JSON.stringify({
        trackingNo: TEST_TRACKING_NO,
        eId: TEST_ORDER_ID,
        createdBy: TEST_USER_ID,
        status: 'shipped'
      })
    });
    
    console.log('📊 Duplicate webhook response:', response2.data);
    
    if (response2.data.isDuplicate) {
      console.log('✅ SUCCESS: Duplicate was correctly blocked!');
      console.log(`   - Occurrence count: ${response2.data.occurrenceCount}`);
      console.log(`   - Time since first: ${response2.data.timeSinceFirstMinutes} minutes`);
    } else {
      console.log('❌ FAILURE: Duplicate was not blocked!');
    }
  } catch (error) {
    console.error('❌ Second webhook failed:', error.response?.data || error.message);
  }
  
  console.log('\n');
  
  // Test with different order ID but same tracking number - should still be blocked
  console.log('📤 Sending duplicate tracking with different order ID (should be blocked)...');
  const differentOrderId = `${TEST_ORDER_ID}-different`;
  
  try {
    const response3 = await axios.post(WEBHOOK_URL, {
      text: JSON.stringify({
        trackingNo: TEST_TRACKING_NO,
        eId: differentOrderId,
        createdBy: TEST_USER_ID,
        status: 'shipped'
      })
    });
    
    console.log('📊 Different order ID response:', response3.data);
    
    if (response3.data.isDuplicate) {
      console.log('✅ SUCCESS: Duplicate tracking number blocked even with different order ID!');
      console.log(`   - Occurrence count: ${response3.data.occurrenceCount}`);
    } else {
      console.log('⚠️  WARNING: Same tracking number with different order ID was not blocked');
    }
  } catch (error) {
    console.error('❌ Third webhook failed:', error.response?.data || error.message);
  }
  
  console.log('\n🎯 Test Complete!');
}

// Run the test
testDuplicateBlocking().catch(console.error);