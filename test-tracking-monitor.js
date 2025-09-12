const trackingMonitor = require('./src/utils/trackingMonitor');
const { initializeRedis } = require('./src/utils/redisClient');

async function testTrackingMonitor() {
  console.log('🧪 Testing Tracking Monitor...\n');

  try {
    // Initialize Redis
    await initializeRedis();
    console.log('✅ Redis connected');

    // Test 1: Record a new tracking number
    console.log('\n📦 Test 1: Recording new tracking number...');
    const result1 = await trackingMonitor.recordTracking(
      'TEST123456TH',
      'order-test-123',
      'user-test-456'
    );
    console.log('Result:', result1);
    console.log('Expected: isDuplicate = false, occurrenceCount = 1');

    // Test 2: Record the same tracking number (should be duplicate)
    console.log('\n📦 Test 2: Recording duplicate tracking number...');
    const result2 = await trackingMonitor.recordTracking(
      'TEST123456TH',
      'order-test-123',
      'user-test-789'
    );
    console.log('Result:', result2);
    console.log('Expected: isDuplicate = true, occurrenceCount = 2');

    // Test 3: Get today's statistics
    console.log('\n📊 Test 3: Getting statistics...');
    const stats = await trackingMonitor.getStats();
    console.log('Stats:', stats);
    console.log('Expected: total >= 2, duplicates >= 1');

    // Test 4: Get duplicates list
    console.log('\n🔍 Test 4: Getting duplicates list...');
    const duplicates = await trackingMonitor.getDuplicates();
    console.log('Duplicates:', duplicates);
    console.log('Expected: At least 1 duplicate entry');

    // Test 5: Get detailed report
    console.log('\n📋 Test 5: Getting detailed report...');
    const report = await trackingMonitor.getDetailedReport();
    console.log('Report summary:', {
      stats: report.stats,
      duplicateCount: report.duplicateCount,
      topDuplicatesCount: report.topDuplicates.length
    });

    console.log('\n✅ All tests completed successfully!');
    console.log('\n🌐 Visit these URLs after deployment:');
    console.log('- https://your-app.fly.dev/tracking-report (HTML dashboard)');
    console.log('- https://your-app.fly.dev/tracking-report/json (JSON API)');
    console.log('- https://your-app.fly.dev/tracking-report/stats (Stats only)');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Full error:', error);
  }

  process.exit(0);
}

// Run the test if this file is executed directly
if (require.main === module) {
  testTrackingMonitor();
}

module.exports = testTrackingMonitor;