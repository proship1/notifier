const { initializeRedis, getRedisClient } = require('./src/utils/redisClient');
const logger = require('./src/utils/logger');

async function clearTrackingStats() {
  console.log('🧹 CLEARING TRACKING STATISTICS');
  console.log('=' .repeat(50));
  
  try {
    // Initialize Redis
    await initializeRedis();
    const redis = getRedisClient();
    
    if (!redis) {
      console.log('❌ Redis not available locally');
      console.log('ℹ️  Stats are stored in Fly.io Redis instance');
      console.log('ℹ️  Need to clear them when app is running');
      return;
    }
    
    console.log('✅ Connected to Redis');
    console.log('\n📊 Finding tracking-related keys...');
    
    // Get all tracking-related keys
    const patterns = [
      'tracking:*',           // Individual tracking numbers
      'tracking:stats:*',     // Daily statistics
      'tracking:duplicates:*' // Duplicate logs
    ];
    
    let totalDeleted = 0;
    
    for (const pattern of patterns) {
      console.log(`\nSearching for keys matching: ${pattern}`);
      const keys = await redis.keys(pattern);
      
      if (keys.length > 0) {
        console.log(`  Found ${keys.length} keys`);
        
        // Show sample of keys to be deleted
        if (keys.length <= 5) {
          keys.forEach(key => console.log(`    - ${key}`));
        } else {
          keys.slice(0, 3).forEach(key => console.log(`    - ${key}`));
          console.log(`    ... and ${keys.length - 3} more`);
        }
        
        // Delete the keys
        for (const key of keys) {
          await redis.del(key);
        }
        
        console.log(`  ✅ Deleted ${keys.length} keys`);
        totalDeleted += keys.length;
      } else {
        console.log(`  No keys found`);
      }
    }
    
    console.log('\n' + '=' .repeat(50));
    console.log('SUMMARY:');
    console.log(`✅ Total keys deleted: ${totalDeleted}`);
    
    if (totalDeleted > 0) {
      console.log('🎯 All tracking statistics have been cleared!');
      console.log('📝 The monitoring system will start fresh on next deployment');
    } else {
      console.log('ℹ️  No tracking data found to clear');
    }
    
    // Close Redis connection
    await redis.quit();
    console.log('\n✅ Redis connection closed');
    
  } catch (error) {
    console.error('❌ Error clearing stats:', error.message);
    console.log('\n💡 Note: Stats might be in Fly.io Redis instance');
    console.log('   To clear them, you need to:');
    console.log('   1. Start the app: fly scale count 2 -a webhook-line-notifier');
    console.log('   2. Run a clear stats endpoint or SSH into the instance');
  }
  
  process.exit(0);
}

clearTrackingStats();