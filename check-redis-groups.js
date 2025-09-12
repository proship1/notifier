require('dotenv').config();
const redis = require('redis');

async function checkRedisGroups() {
  const client = redis.createClient({
    url: process.env.REDIS_URL
  });
  
  try {
    await client.connect();
    console.log('Connected to Redis');
    
    const allGroups = new Set();
    const userMappings = {};
    
    // Scan for user keys
    let cursor = 0;
    do {
      const result = await client.scan(cursor, {
        MATCH: 'user:*',
        COUNT: 100
      });
      
      cursor = result.cursor;
      const keys = result.keys;
      
      for (const key of keys) {
        const groupId = await client.get(key);
        if (groupId) {
          allGroups.add(groupId);
          const userId = key.replace('user:', '');
          if (!userMappings[groupId]) {
            userMappings[groupId] = [];
          }
          userMappings[groupId].push(userId);
        }
      }
    } while (cursor !== 0);
    
    // Scan for API keys
    cursor = 0;
    do {
      const result = await client.scan(cursor, {
        MATCH: 'apiKey:*',
        COUNT: 100
      });
      
      cursor = result.cursor;
      const keys = result.keys;
      
      for (const key of keys) {
        const apiData = await client.get(key);
        if (apiData) {
          try {
            const parsed = JSON.parse(apiData);
            if (parsed.groupId) {
              allGroups.add(parsed.groupId);
            }
          } catch (e) {
            // Not JSON
          }
        }
      }
    } while (cursor !== 0);
    
    console.log('\n=== ACTIVE GROUPS SUMMARY ===');
    console.log(`Total Active Groups: ${allGroups.size}`);
    console.log('\n=== GROUP DETAILS ===');
    
    for (const groupId of allGroups) {
      const users = userMappings[groupId] || [];
      console.log(`\nGroup ID: ${groupId}`);
      console.log(`  Mapped Users: ${users.length}`);
      if (users.length > 0) {
        console.log(`  User IDs: ${users.slice(0, 5).join(', ')}${users.length > 5 ? ` ... and ${users.length - 5} more` : ''}`);
      }
    }
    
    await client.quit();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkRedisGroups();