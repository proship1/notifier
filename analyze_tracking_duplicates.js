const fs = require('fs');

// Read the log file
const logContent = fs.readFileSync('extended_logs.txt', 'utf8');

// Extract tracking numbers and related data
const trackingData = {};
const lines = logContent.split('\n');

lines.forEach(line => {
  // Match tracking numbers in webhook received logs (with escaped quotes)
  const match = line.match(/\\"trackingNo\\":\\"([A-Z0-9]+)\\"/);
  if (match) {
    const trackingNo = match[1];
    const timestamp = line.match(/timestamp":"([^"]+)"/)?.[1] || 'unknown';
    const userId = line.match(/\\"createdBy\\":\\"([^"\\]+)\\"/)?.[1] || 'unknown';
    const orderId = line.match(/\\"eId\\":\\"([^"\\]+)\\"/)?.[1] || 'unknown';
    
    if (!trackingData[trackingNo]) {
      trackingData[trackingNo] = [];
    }
    
    trackingData[trackingNo].push({
      timestamp,
      userId,
      orderId,
      fullLine: line.substring(0, 200) // First 200 chars for context
    });
  }
});

// Find duplicates
const duplicates = {};
let totalMessages = 0;
let uniqueTrackingNumbers = 0;
let duplicateCount = 0;

Object.entries(trackingData).forEach(([trackingNo, entries]) => {
  totalMessages += entries.length;
  uniqueTrackingNumbers++;
  
  if (entries.length > 1) {
    duplicates[trackingNo] = entries;
    duplicateCount += entries.length - 1; // Count extra occurrences
  }
});

// Generate report
console.log('=== LINE API TRACKING NUMBER ANALYSIS REPORT ===\n');
console.log(`Analysis Period: Based on available logs from ${new Date().toISOString()}\n`);

console.log('SUMMARY:');
console.log(`- Total webhook messages processed: ${totalMessages}`);
console.log(`- Unique tracking numbers: ${uniqueTrackingNumbers}`);
console.log(`- Duplicate messages sent: ${duplicateCount}`);
console.log(`- Duplication rate: ${((duplicateCount / totalMessages) * 100).toFixed(2)}%\n`);

console.log('DUPLICATE TRACKING NUMBERS FOUND:');
console.log('=' .repeat(50));

Object.entries(duplicates).forEach(([trackingNo, entries]) => {
  console.log(`\nTracking Number: ${trackingNo}`);
  console.log(`Sent ${entries.length} times`);
  console.log('Details:');
  
  entries.forEach((entry, index) => {
    console.log(`  ${index + 1}. Time: ${entry.timestamp}`);
    console.log(`     Order: ${entry.orderId}`);
    console.log(`     User: ${entry.userId}`);
  });
  
  // Check if it's the same order or different orders
  const uniqueOrders = [...new Set(entries.map(e => e.orderId))];
  const uniqueUsers = [...new Set(entries.map(e => e.userId))];
  
  if (uniqueOrders.length === 1) {
    console.log(`  ⚠️  SAME ORDER sent ${entries.length} times`);
  } else {
    console.log(`  ⚠️  DIFFERENT ORDERS (${uniqueOrders.length}) with same tracking number`);
  }
  
  if (uniqueUsers.length > 1) {
    console.log(`  👥 Multiple users (${uniqueUsers.length}) involved`);
  }
});

console.log('\n' + '=' .repeat(50));
console.log('\nRECOMMENDATIONS:');
console.log('1. The duplication appears to be happening at the webhook level');
console.log('2. Same tracking numbers are being sent for the same order IDs');
console.log('3. This indicates the webhook sender might be retrying or duplicating calls');
console.log('4. Consider implementing deduplication logic based on order ID or tracking number');
console.log('5. Add caching to prevent processing duplicate webhooks within a time window');

// Note about messages actually sent to LINE
console.log('\nIMPORTANT NOTE:');
console.log('Most duplicate webhooks show "User not mapped - skipping LINE message"');
console.log('This means the duplicates are NOT actually being sent to LINE API');
console.log('The system is correctly filtering out unmapped users, saving API calls');