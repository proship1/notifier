const https = require('https');

// Test ProShip API integration
async function testProShipAPI() {
  // Your actual API key from the JSON
  const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImdpYnphMjUyODI1MjhAZ21haWwuY29tIiwiaWQiOiJ1c2VyLWU4ZDM5NGIwLWJhZmItMTFlYi1hYzczLWQ1ZGVjNDZmZmIxNDE2MjE2ODc2NjcwNjciLCJyb2xlIjoic2VsbGVyIiwidXNlcm5hbWUiOiIuIiwiYmFsYW5jZSI6MCwiaWF0IjoxNzU0NDcxMzYwfQ.AZK9cQCkmoweI5N266IvUXswxtzVFe1gp51pE-HaD_4';
  
  // Test order ID (real order from your system)
  const orderId = 'order-90bd5760-7349-11f0-9ce5-a5f5bce0b7501754542024662';
  
  console.log('🔍 Fetching order details from ProShip API...\n');
  console.log(`Order ID: ${orderId}\n`);
  
  try {
    // Call ProShip API
    const orderData = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.proship.me',
        path: `/orders/v1/orders/${orderId}`,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
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
            console.log(`❌ API Error: ${res.statusCode} ${res.statusMessage}`);
            console.log('Error details:', data);
            reject(new Error(`API returned ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
    
    // Extract customer info
    const customerName = orderData.details?.customer?.name || 'ไม่ระบุชื่อ';
    const customerPhone = orderData.details?.customer?.phoneNo || 'ไม่ระบุเบอร์';
    const trackingNo = orderData.trackingNo || orderData.details?.trackingNo || 'ไม่มี';
    const status = orderData.status || 1;
    
    console.log('✅ Order data received!\n');
    console.log('📦 Extracted Information:');
    console.log(`- Customer Name: ${customerName}`);
    console.log(`- Customer Phone: ${customerPhone}`);
    console.log(`- Tracking No: ${trackingNo}`);
    console.log(`- Status: ${status}\n`);
    
    // Simulate the enhanced LINE message
    console.log('📱 Enhanced LINE Message:');
    console.log('------------------------');
    
    const thailandTime = new Date().toLocaleString('th-TH', { 
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric'
    });
    
    const lineMessage = `🚚 การแจ้งเตือนคำสั่งซื้อ
📦 Order: ${orderId.substring(6, 14)}
📝 สถานะ: อัพเดตสถานะการจัดส่ง
🏷️ Tracking: ${trackingNo}
👤 ลูกค้า: ${customerName}
📞 เบอร์โทร: ${customerPhone}
🕒 ${thailandTime}`;
    
    console.log(lineMessage);
    console.log('------------------------\n');
    
    // Show how it integrates with webhook
    console.log('🔄 Integration with webhook:');
    console.log('When webhook receives notification with eId (order ID):');
    console.log('1. Extract order ID from webhook');
    console.log('2. Fetch order details from ProShip API');
    console.log('3. Add customer info to LINE message');
    console.log('4. Send enhanced message to LINE group');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run the test
testProShipAPI();